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

const CHAT_MODEL_NAME = 'gemini-1.5-flash';
const ERROR_REPLY = '일시적 오류입니다. 다시 시도해주세요.';

const CHAT_SYSTEM_PROMPT = (address: string) =>
  `너는 ${address} 상권분석 전문가야. 사장님 관점에서 간결하고 실행 가능한 조언만 해. 3문장 이내로 답해.`;

function fallbackResponse(): NextResponse<ChatResponse> {
  return NextResponse.json({ reply: ERROR_REPLY }, { status: 200 });
}

function hasUsableGeminiKey(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return normalized !== 'YOUR_GEMINI_API_KEY' && normalized !== 'YOUR_API_KEY';
}

function getMessageText(message: ChatMessage | undefined): string {
  if (!message) {
    return '';
  }

  return message.parts[0]?.text?.trim() ?? '';
}

export async function POST(request: Request) {
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

    const history = messages.slice(0, -1).map((message) => ({
      role: message.role,
      parts: [{ text: getMessageText(message) }],
    }));

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: CHAT_MODEL_NAME });
    const chat = model.startChat({
      history,
      systemInstruction: CHAT_SYSTEM_PROMPT(address),
    });

    const result = await chat.sendMessage(lastMessageText);
    const reply = result.response.text().trim() || ERROR_REPLY;

    return NextResponse.json({ reply }, { status: 200 });
  } catch {
    return fallbackResponse();
  }
}
