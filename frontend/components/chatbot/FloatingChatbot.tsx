'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

interface FloatingChatbotProps {
  address: string;
}

interface ChatPart {
  text: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatPart[];
}

const QUICK_REPLIES = [
  '이 상권 매출 더 자세히 알고 싶어요',
  '경쟁점 대비 차별화 전략 뭐가 있나요?',
  '임대료 대비 수익성은요?',
];

export default function FloatingChatbot({ address }: FloatingChatbotProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      parts: [{ text: `${address} 리포트 기준으로 궁금한 점을 물어보세요.` }],
    },
  ]);

  const handleQuickReply = (text: string) => {
    if (isLoading) {
      return;
    }

    setInput(text);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();

    if (!trimmed || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      parts: [{ text: trimmed }],
    };
    const nextMessages: ChatMessage[] = [...messages, userMessage];

    setMessages([
      ...messages,
      userMessage,
      { role: 'model', parts: [{ text: '...' }] },
    ]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: nextMessages,
          address,
        }),
      });

      if (!response.ok) {
        throw new Error('chat request failed');
      }

      const payload = (await response.json()) as { reply?: string };
      const replyText = payload.reply?.trim() || '일시적 오류입니다.';

      setMessages([
        ...nextMessages,
        {
          role: 'model',
          parts: [{ text: replyText }],
        },
      ]);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: 'model',
          parts: [{ text: '일시적 오류입니다.' }],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className='fixed bottom-4 left-1/2 z-40 w-[calc(100%-1rem)] max-w-md -translate-x-1/2 rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-6'>
      <div className='border-b border-slate-200 px-4 py-3'>
        <p className='text-sm font-semibold text-slate-900'>AI 상권 도우미</p>
      </div>

      <div className='max-h-56 space-y-2 overflow-y-auto px-4 py-3'>
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-lg px-3 py-2 text-sm ${
              message.role === 'model'
                ? 'bg-slate-100 text-slate-800'
                : 'ml-auto w-fit bg-indigo-600 text-white'
            }`}
          >
            {message.parts[0]?.text ?? ''}
          </div>
        ))}
      </div>

      <div className='flex gap-2 overflow-x-auto px-4 pb-2'>
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply}
            type='button'
            onClick={() => handleQuickReply(reply)}
            disabled={isLoading}
            className='shrink-0 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:border-indigo-400 hover:text-indigo-700'
          >
            {reply}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className='flex gap-2 border-t border-slate-200 p-3'>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isLoading}
          placeholder='질문을 입력하세요'
          className='min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
        />
        <button
          type='submit'
          disabled={isLoading}
          className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400'
        >
          {isLoading ? '전송 중...' : '전송'}
        </button>
      </form>
    </section>
  );
}
