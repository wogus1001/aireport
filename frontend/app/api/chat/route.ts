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
const MAX_HISTORY_MESSAGES = 8;
const GEMINI_TIMEOUT_MS = 10000;
const ERROR_REPLY = '일시적 오류입니다. 다시 시도해주세요.';

function resolveChatModelName(rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) return DEFAULT_CHAT_MODEL;

  // Legacy alias compatibility.
  if (value === 'gemini-flash-latest') return DEFAULT_CHAT_MODEL;
  return value;
}

const CHAT_MODEL_NAME = resolveChatModelName(process.env.GEMINI_CHAT_MODEL?.trim());

function fallbackResponse(): NextResponse<ChatResponse> {
  return NextResponse.json({ reply: ERROR_REPLY }, { status: 200 });
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
  while (recent.length > 0 && recent[0].role !== 'user') {
    recent.shift();
  }

  return recent;
}

function toConversationTranscript(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return '(이전 대화 없음)';
  }

  return messages
    .map((message) => {
      const speaker = message.role === 'user' ? '사용자' : 'AI';
      return `${speaker}: ${getMessageText(message)}`;
    })
    .join('\n');
}

function buildPrompt(address: string, history: ChatMessage[], question: string): string {
  const transcript = toConversationTranscript(history);
  return [
    `${address} 기준 상권 분석 도우미로 답변해.`,
    '답변 규칙: 한국어, 3문장 이내, 핵심 수치 우선.',
    '',
    '[이전 대화]',
    transcript,
    '',
    '[현재 질문]',
    question,
  ].join('\n');
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

export async function POST(request: Request): Promise<NextResponse<ChatResponse>> {
  try {
    const payload = (await request.json()) as Partial<ChatRequest>;
    const address = payload.address?.trim() ?? '';
    const messages = payload.messages;

    if (!address || !messages || !Array.isArray(messages) || messages.length === 0) {
      return fallbackResponse();
    }

    const lastMessage = messages.at(-1);
    const lastMessageText = getMessageText(lastMessage);
    if (!lastMessage || lastMessage.role !== 'user' || !lastMessageText) {
      return fallbackResponse();
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!hasUsableGeminiKey(apiKey)) {
      return fallbackResponse();
    }

    const history = buildGeminiHistory(messages.slice(0, -1));
    const prompt = buildPrompt(address, history, lastMessageText);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: CHAT_MODEL_NAME,
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 220,
      },
    });

    const result = await withTimeout(model.generateContent(prompt), GEMINI_TIMEOUT_MS, 'gemini-chat');
    const reply = result.response.text().trim() || ERROR_REPLY;
    return NextResponse.json({ reply }, { status: 200 });
  } catch (error: unknown) {
    console.error('[api/chat] Gemini call failed:', error);
    return fallbackResponse();
  }
}
