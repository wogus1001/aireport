'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';

interface LeadCaptureModalProps {
  isOpen: boolean;
  address: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface LeadResponse {
  success: boolean;
}

const PHONE_PATTERN = /^01[0-9]-\d{3,4}-\d{4}$/;

export default function LeadCaptureModal({
  isOpen,
  address,
  onClose,
  onSuccess,
}: LeadCaptureModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = useMemo(() => {
    return name.trim().length > 0 && PHONE_PATTERN.test(phone.trim());
  }, [name, phone]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (!isValid) {
      setErrorMessage('전화번호는 010-1234-5678 형식으로 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address,
        }),
      });

      if (!response.ok) {
        throw new Error('리드 저장 실패');
      }

      const result = (await response.json()) as LeadResponse;
      if (!result.success) {
        throw new Error('리드 저장 실패');
      }

      onSuccess();
      setName('');
      setPhone('');
    } catch {
      setErrorMessage('잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4'>
      <section className='w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6'>
        <div className='flex items-start justify-between'>
          <h2 className='text-lg font-bold text-slate-900'>리포트 잠금 해제</h2>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700'
            aria-label='모달 닫기'
          >
            ✕
          </button>
        </div>

        <p className='mt-2 text-sm text-slate-600'>이름과 연락처를 입력하면 심화 리포트가 열립니다.</p>

        <form onSubmit={handleSubmit} className='mt-5 space-y-3'>
          <label className='block'>
            <span className='mb-1 block text-sm font-medium text-slate-700'>이름</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className='w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
              placeholder='홍길동'
            />
          </label>

          <label className='block'>
            <span className='mb-1 block text-sm font-medium text-slate-700'>전화번호</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className='w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
              placeholder='010-1234-5678'
            />
          </label>

          {errorMessage ? <p className='text-sm text-rose-600'>{errorMessage}</p> : null}

          <button
            type='submit'
            disabled={isSubmitting}
            className='w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400'
          >
            {isSubmitting ? '처리 중...' : '잠금 해제'}
          </button>
        </form>
      </section>
    </div>
  );
}
