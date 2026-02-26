'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

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

const UI_TEXT = {
  title: 'AI \uc0c1\uad8c \ub3c4\uc6b0\ubbf8',
  placeholder: '\uc9c8\ubb38\uc744 \uc785\ub825\ud558\uc138\uc694',
  send: '\uc804\uc1a1',
  sending: '\uc804\uc1a1 \uc911...',
  loading: '...',
  welcomeSuffix: '\ub9ac\ud3ec\ud2b8 \uae30\uc900\uc73c\ub85c \uad81\uae08\ud55c \uc810\uc744 \ubb3c\uc5b4\ubcf4\uc138\uc694.',
  fallbackError: '\uc77c\uc2dc\uc801 \uc624\ub958\uc785\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.',
} as const;

const QUICK_REPLIES = [
  '\uc774 \uc0c1\uad8c \ub9e4\ucd9c \ub354 \uc790\uc138\ud788 \uc54c\uace0 \uc2f6\uc5b4\uc694',
  '\uacbd\uc7c1\uc810 \ub300\ube44 \ucc28\ubcc4\ud654 \uc804\ub7b5 \ubb50\uac00 \uc788\ub098\uc694?',
  '\uc784\ub300\ub8cc \ub300\ube44 \uc218\uc775\uc131\uc740\uc694?',
] as const;

export default function FloatingChatbot({ address }: FloatingChatbotProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      parts: [{ text: `${address} ${UI_TEXT.welcomeSuffix}` }],
    },
  ]);

  const quickReplyButtons = useMemo(
    () =>
      QUICK_REPLIES.map((reply) => (
        <button
          key={reply}
          type='button'
          onClick={() => {
            if (!isLoading) setInput(reply);
          }}
          disabled={isLoading}
          className='shrink-0 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:border-indigo-400 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50'
        >
          {reply}
        </button>
      )),
    [isLoading],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', parts: [{ text: trimmed }] };
    const nextMessages: ChatMessage[] = [...messages, userMessage];

    setMessages([...nextMessages, { role: 'model', parts: [{ text: UI_TEXT.loading }] }]);
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
      const replyText = payload.reply?.trim() || UI_TEXT.fallbackError;

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
          parts: [{ text: UI_TEXT.fallbackError }],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className='w-full rounded-2xl border border-slate-200 bg-white shadow-sm'>
      <div className='border-b border-slate-200 px-4 py-3'>
        <p className='text-sm font-semibold text-slate-900'>{UI_TEXT.title}</p>
      </div>

      <div className='max-h-56 space-y-2 overflow-y-auto px-4 py-3'>
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
              message.role === 'model'
                ? 'bg-slate-100 text-slate-800'
                : 'ml-auto w-fit max-w-[90%] bg-indigo-600 text-white'
            }`}
          >
            <p className='whitespace-pre-wrap break-words'>{message.parts[0]?.text ?? ''}</p>
          </div>
        ))}
      </div>

      <div className='flex gap-2 overflow-x-auto px-4 pb-2'>{quickReplyButtons}</div>

      <form onSubmit={handleSubmit} className='flex gap-2 border-t border-slate-200 p-3'>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isLoading}
          placeholder={UI_TEXT.placeholder}
          className='min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
        />
        <button
          type='submit'
          disabled={isLoading}
          className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400'
        >
          {isLoading ? UI_TEXT.sending : UI_TEXT.send}
        </button>
      </form>
    </section>
  );
}
