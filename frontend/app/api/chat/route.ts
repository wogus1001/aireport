import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

interface ChatPart {
  text: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatPart[];
}

interface ChatRequest {
  messages: ChatMessage[];
  address: string;
}

interface ChatResponse {
  reply: string;
}

const DEFAULT_CHAT_MODEL = 'gemini-2.5-flash';
const MAX_HISTORY_MESSAGES = 10;
const GEMINI_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_TOKENS = 768;
const MIN_REPLY_LENGTH = 18;
const ERROR_REPLY = '\uc77c\uc2dc\uc801 \uc624\ub958\uc785\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.';

function resolveChatModelName(rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) return DEFAULT_CHAT_MODEL;
  if (value === 'gemini-flash-latest') return 'gemini-2.5-flash';
  if (value === 'gemini-flash-lite-latest') return 'gemini-2.5-flash-lite';
  if (value === 'gemini-3.1-pro') return 'gemini-3.1-pro-preview';
  return value;
}

const CHAT_MODEL_NAME = resolveChatModelName(process.env.GEMINI_CHAT_MODEL?.trim());

function buildModelCandidates(preferred: string): string[] {
  const order = [
    preferred,
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite-001',
  ];
  return Array.from(new Set(order.filter(Boolean)));
}

function fallbackResponse(reply = ERROR_REPLY): NextResponse<ChatResponse> {
  return NextResponse.json({ reply }, { status: 200 });
}

function hasUsableGeminiKey(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  return normalized !== 'YOUR_GEMINI_API_KEY' && normalized !== 'YOUR_API_KEY';
}

function getMessageText(message: ChatMessage | undefined): string {
  if (!message) return '';
  return message.parts[0]?.text?.trim() ?? '';
}

function buildGeminiHistory(messages: ChatMessage[]): ChatMessage[] {
  const normalized: ChatMessage[] = [];

  for (const message of messages) {
    const text = getMessageText(message);
    if (!text) continue;

    const entry: ChatMessage = {
      role: message.role,
      parts: [{ text }],
    };

    const previous = normalized.at(-1);
    if (previous && previous.role === entry.role) {
      normalized[normalized.length - 1] = entry;
      continue;
    }

    normalized.push(entry);
  }

  const recent = normalized.slice(-MAX_HISTORY_MESSAGES);
  while (recent.length > 0 && recent[0]?.role !== 'user') {
    recent.shift();
  }

  return recent;
}

function toConversationTranscript(messages: ChatMessage[]): string {
  if (messages.length === 0) return '(no prior messages)';

  return messages
    .map((message) => {
      const speaker = message.role === 'user' ? 'User' : 'Assistant';
      return `${speaker}: ${getMessageText(message)}`;
    })
    .join('\n');
}

function buildPrompt(address: string, history: ChatMessage[], question: string): string {
  const transcript = toConversationTranscript(history);
  return [
    'You are a Korean business-district assistant for small-business owners.',
    'Respond ONLY in Korean.',
    'Write 2-4 complete sentences and keep them practical.',
    'Always include one concrete next action the user can do today.',
    'Do not output markdown or bullet lists.',
    '',
    `Address: ${address}`,
    '',
    '[Conversation History]',
    transcript,
    '',
    '[Latest User Question]',
    question,
  ].join('\n');
}

function buildRetryPrompt(basePrompt: string): string {
  return [
    basePrompt,
    '',
    'Your previous answer looked cut off.',
    'Rewrite again in Korean with 2-4 complete sentences.',
    'Do not stop mid-sentence.',
  ].join('\n');
}

function buildDeterministicFallback(address: string, question: string): string {
  const lowerQuestion = question.toLowerCase();

  if (lowerQuestion.includes('\ub9e4\ucd9c')) {
    return `${address} \uae30\uc900\uc73c\ub85c \ub9e4\ucd9c \uad00\ub828 \uc218\uce58\ub97c \ubcf4\uc2e4 \ub54c\ub294 \uac80\uc0c9\ub7c9 \ucd94\uc138, \uacbd\uc7c1 \uac15\ub3c4, \uc784\ub300 \uc870\uac74\uc744 \ud568\uaed8 \ubcf4\ub294 \uac83\uc774 \uc911\uc694\ud569\ub2c8\ub2e4. \uc6b0\uc120 \ucd5c\uadfc 4\uc8fc \uac80\uc0c9\ub7c9\uacfc \ubc18\uacbd \ub0b4 \uacbd\uc7c1 \uc5c5\uc885 \ube44\uc911\uc744 \ube44\uad50\ud574 \uc9d1\uac1d \uac00\ub2a5\uc131\uc744 \ud655\uc778\ud574\ubcf4\uc138\uc694. \uc624\ub298\uc740 \ud575\uc2ec \ud0c0\uac9f 1\uac1c\uc640 \ud64d\ubcf4 \ucc44\ub110 1\uac1c\ub97c \uc815\ud574 \uc2e4\ud5d8 \uc6b4\uc601\uc744 \uc2dc\uc791\ud558\uc2dc\ub294 \uac83\uc744 \uad8c\uc7a5\ud569\ub2c8\ub2e4.`;
  }

  if (lowerQuestion.includes('\uacbd\uc7c1') || lowerQuestion.includes('\ucc28\ubcc4\ud654')) {
    return `${address} \uc0c1\uad8c\uc740 \uacbd\uc7c1 \ubc00\uc9d1\ub3c4\uc640 \uace0\uac1d \uc720\uc785 \ub3d9\uc120\uc744 \uac19\uc774 \ubcf4\uba74 \ucc28\ubcc4\ud654 \ud3ec\uc778\ud2b8\uac00 \ub610\ub835\ud574\uc9d1\ub2c8\ub2e4. \uacbd\uc7c1 \ub9e4\uc7a5\ub4e4\uc758 \uac00\uaca9\ub300\u00b7\ud0c0\uac9f \uc2dc\uac04\ub300\u00b7\uba54\ub274 \uad6c\uc131\uc744 \ube44\uad50\ud574 \ube48\uacf5\uac04 1\uac00\uc9c0\ub97c \ucc3e\ub294 \uac83\uc774 \ud6a8\uacfc\uc801\uc785\ub2c8\ub2e4. \uc624\ub298\uc740 \uacbd\uc7c1 \ub9e4\uc7a5 3\uacf3\ub9cc \uc815\ud574 \ud504\ub85c\ubaa8\uc158 \ubb38\uad6c\uc640 \ud310\ub9e4 \ud3ec\uc778\ud2b8\ub97c \ube44\uad50 \uc815\ub9ac\ud574\ubcf4\uc138\uc694.`;
  }

  if (lowerQuestion.includes('\uc784\ub300\ub8cc') || lowerQuestion.includes('\uc218\uc775\uc131')) {
    return `${address} \uae30\uc900\uc73c\ub85c \uc218\uc775\uc131\uc744 \ubcf4\uc2e4 \ub54c\ub294 \uc6d4\uc138\u00b7\ubcf4\uc99d\uae08\u00b7\uba74\uc801 \ub300\ube44 \uace0\uc815\ube44 \ube44\uc911\uc744 \uba3c\uc800 \ud655\uc778\ud558\uc154\uc57c \ud569\ub2c8\ub2e4. \ub9e4\ucd9c \ubcc0\ub3d9\uc774 \uc788\uc5b4\ub3c4 \ubc84\ud2f8 \uc218 \uc788\ub3c4\ub85d \uc6d4 \uace0\uc815\ube44 \ud55c\ub3c4\ub97c \uba3c\uc800 \uc815\ud558\ub294 \uac83\uc774 \uc548\uc804\ud569\ub2c8\ub2e4. \uc624\ub298\uc740 \ucd5c\uc18c 3\uac1c \uc6d4 \ub9e4\ucd9c \uc2dc\ub098\ub9ac\uc624\ub97c \uc791\uc131\ud574 \uc190\uc775\ubd84\uae30\uc810\uc744 \uacc4\uc0b0\ud574\ubcf4\uc138\uc694.`;
  }

  return `${address} \uae30\uc900\uc73c\ub85c \uc0c1\uad8c\uc744 \ubd84\uc11d\ud558\uba74 \uc218\uc694, \uacbd\uc7c1, \ube44\uc6a9 \uc694\uc18c\ub97c \ud568\uaed8 \ubcf4\ub294 \uac83\uc774 \ud575\uc2ec\uc785\ub2c8\ub2e4. \ud604\uc7ac \uc9c8\ubb38\uc740 \uc2e4\ud589 \uc804\ub7b5\uacfc \uc5f0\uacb0\ud558\ub294 \uac83\uc774 \uc88b\uc73c\ubbc0\ub85c \ubaa9\ud45c \uace0\uac1d\uce35\uacfc \ud575\uc2ec \uc0c1\ud488\uc744 \uba3c\uc800 \uace0\uc815\ud574\ubcf4\uc138\uc694. \uc624\ub298\uc740 \ud55c \uac00\uc9c0 \uc2e4\ud5d8 \ud504\ub85c\ubaa8\uc158\uc744 \uc815\ud558\uace0 \ubc18\uc751 \uc9c0\ud45c\ub97c \ud655\uc778\ud574 \ub2e4\uc74c \uc758\uc0ac\uacb0\uc815\uc5d0 \ubc18\uc601\ud558\uc2dc\uae38 \uad8c\uc7a5\ub4dc\ub9bd\ub2c8\ub2e4.`;
}

function isReplyIncomplete(reply: string): boolean {
  const trimmed = reply.trim();
  if (!trimmed) return true;
  if (trimmed.length < MIN_REPLY_LENGTH) return true;

  const hangulCount = (trimmed.match(/[\uac00-\ud7a3]/g) ?? []).length;
  if (hangulCount < 4) return true;

  const hasTerminalPunctuation = /[.!?]\s*$/.test(trimmed);
  if (!hasTerminalPunctuation && trimmed.length < 40) return true;

  return false;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, tag: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${tag}-timeout`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function generateReply(modelName: string, apiKey: string, prompt: string): Promise<{
  reply: string;
  finishReason: string | undefined;
}> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });

  const result = await withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS, 'gemini-chat');
  const reply = result.response.text().trim();
  const finishReason = result.response.candidates?.[0]?.finishReason as string | undefined;
  return { reply, finishReason };
}

async function generateReplyWithFallback(
  preferredModel: string,
  apiKey: string,
  prompt: string,
): Promise<{
  reply: string;
  finishReason: string | undefined;
}> {
  const candidates = buildModelCandidates(preferredModel);
  let lastError: unknown = null;

  for (const modelName of candidates) {
    try {
      return await generateReply(modelName, apiKey, prompt);
    } catch (error) {
      lastError = error;
      const message = String((error as { message?: unknown })?.message ?? '');
      const shouldTryNext =
        message.includes('404') ||
        message.includes('not found') ||
        message.includes('no longer available');
      if (!shouldTryNext) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('no-model-available');
}

export async function POST(request: Request): Promise<NextResponse<ChatResponse>> {
  try {
    const payload = (await request.json()) as Partial<ChatRequest>;
    const address = payload.address?.trim() ?? '';
    const messages = payload.messages;

    if (!address || !messages || !Array.isArray(messages) || messages.length === 0) {
      return fallbackResponse();
    }

    const lastMessage = messages.at(-1);
    const question = getMessageText(lastMessage);
    if (!lastMessage || lastMessage.role !== 'user' || !question) {
      return fallbackResponse();
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!hasUsableGeminiKey(apiKey)) {
      return fallbackResponse();
    }

    const history = buildGeminiHistory(messages.slice(0, -1));
    const prompt = buildPrompt(address, history, question);

    let generated = await generateReplyWithFallback(CHAT_MODEL_NAME, apiKey, prompt);
    let reply = generated.reply || ERROR_REPLY;

    if (isReplyIncomplete(reply) || generated.finishReason === 'MAX_TOKENS') {
      const retryPrompt = buildRetryPrompt(prompt);
      generated = await generateReplyWithFallback(CHAT_MODEL_NAME, apiKey, retryPrompt);
      reply = generated.reply || reply;
    }

    if (isReplyIncomplete(reply)) {
      reply = buildDeterministicFallback(address, question);
    }

    return NextResponse.json({ reply }, { status: 200 });
  } catch (error: unknown) {
    console.error('[api/chat] Gemini call failed:', error);
    return fallbackResponse();
  }
}
