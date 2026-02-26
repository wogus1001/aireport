'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function extractNsajangStoreId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  const matched = trimmed.match(/nsajang\.com\/search\/store\/(\d+)/i);
  return matched?.[1] ?? null;
}

export default function HomePage() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const [isResolvingStore, setIsResolvingStore] = useState(false);

  interface StoreResolveResponse {
    store_id?: string;
    address?: string;
    business_type?: string;
    rent?: string;
    deposit?: string;
    area?: string;
    message?: string;
  }

  function appendQueryValue(query: URLSearchParams, key: string, value: string | undefined) {
    if (!value) {
      return;
    }
    const trimmed = value.trim();
    if (trimmed) {
      query.set(key, trimmed);
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = inputValue.trim();

    if (!trimmedInput) {
      return;
    }

    const storeId = extractNsajangStoreId(trimmedInput);
    if (storeId) {
      setIsResolvingStore(true);
      setInputError('');

      try {
        const response = await fetch(`/api/nsajang/store/${encodeURIComponent(storeId)}`, {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = (await response.json()) as StoreResolveResponse;
        if (!response.ok || !payload.address) {
          setInputError(payload.message ?? '매물 정보를 불러오지 못했습니다. URL/ID를 확인해 주세요.');
          return;
        }

        const query = new URLSearchParams();
        appendQueryValue(query, 'store_id', payload.store_id);
        appendQueryValue(query, 'business_type', payload.business_type);
        appendQueryValue(query, 'rent', payload.rent);
        appendQueryValue(query, 'deposit', payload.deposit);
        appendQueryValue(query, 'area', payload.area);

        const queryString = query.toString();
        const targetUrl = `/report/${encodeURIComponent(payload.address)}${queryString ? `?${queryString}` : ''}`;
        router.push(targetUrl);
        return;
      } catch {
        setInputError('매물 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      } finally {
        setIsResolvingStore(false);
      }
    }

    setInputError('');
    const trimmedAddress = trimmedInput;
    router.push(`/report/${encodeURIComponent(trimmedAddress)}`);
  };

  const detectedStoreId = extractNsajangStoreId(inputValue);

  return (
    <main className='mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-16 sm:px-6'>
      <section className='rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-10'>
        <p className='text-sm font-medium text-indigo-600'>내일사장 상권분석 AI 컨설턴트</p>
        <h1 className='mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl'>
          주소 한 줄로 상권 리포트를 확인하세요
        </h1>
        <p className='mt-4 text-sm text-slate-600 sm:text-base'>
          예: 경기도 하남시 미사강변중앙로 180 또는 nsajang 매물 URL/ID
        </p>

        <form onSubmit={handleSubmit} className='mt-8 flex flex-col gap-3 sm:flex-row'>
          <input
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setInputError('');
            }}
            placeholder='분석할 주소 또는 nsajang 매물 URL/ID를 입력하세요'
            className='w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base'
            disabled={isResolvingStore}
          />
          <button
            type='submit'
            className='rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-indigo-300 sm:text-base'
            disabled={isResolvingStore}
          >
            {isResolvingStore ? '매물 조회 중...' : '리포트 생성'}
          </button>
        </form>
        {detectedStoreId ? (
          <p className='mt-3 text-sm text-amber-700'>
            매물 ID <span className='font-semibold'>{detectedStoreId}</span> 감지됨. 자동 연동을 시도합니다.
          </p>
        ) : null}
        {inputError ? <p className='mt-2 text-sm text-rose-700'>{inputError}</p> : null}
      </section>
    </main>
  );
}
