'use client';

import { useEffect, useState } from 'react';
import FloatingChatbot from '@/components/chatbot/FloatingChatbot';
import LeadCaptureModal from '@/components/modal/LeadCaptureModal';
import LockedSection from '@/components/report/LockedSection';
import PublicSection from '@/components/report/PublicSection';
import ReportSkeleton from '@/components/report/ReportSkeleton';
import UnlockCTA from '@/components/report/UnlockCTA';
import type { GeminiReportResponse } from '@/lib/gemini';
import type { LockedData, Region, ReportData } from '@/lib/types';

interface ReportClientProps {
  address: string;
  reportData: ReportData;
  region?: Region;
}

const LOADING_SUMMARY = 'AI가 상권 요약을 생성하고 있습니다...';
const ERROR_SUMMARY = 'AI 요약 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.';

const LOADING_LOCKED_DATA: LockedData = {
  estimated_revenue: 'AI 분석 중...',
  risk_alert: '공개 데이터와 지역 특성을 분석하고 있습니다.',
  top_3_strategies: [
    {
      title: '전략 생성 중',
      description: '실제 상권 데이터 기반 전략을 생성하고 있습니다.',
    },
  ],
};

const ERROR_LOCKED_DATA: LockedData = {
  estimated_revenue: '분석 실패',
  risk_alert: 'AI 분석 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  top_3_strategies: [
    {
      title: '재시도 필요',
      description: '네트워크 상태를 확인한 뒤 페이지를 새로고침해 주세요.',
    },
  ],
};

export default function ReportClient({ address, reportData, region }: ReportClientProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [geminiResult, setGeminiResult] = useState<GeminiReportResponse | null>(null);
  const [isGeminiLoading, setIsGeminiLoading] = useState(true);
  const [hasGeminiError, setHasGeminiError] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadGemini() {
      setIsGeminiLoading(true);
      setHasGeminiError(false);
      setGeminiResult(null);

      if (!reportData.raw_locked_inputs) {
        setHasGeminiError(true);
        setIsGeminiLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            region,
            public_metrics: reportData.public_metrics,
            raw_locked_inputs: reportData.raw_locked_inputs,
            extended_insights: reportData.extended_insights,
            store_basic_info: reportData.store_basic_info,
          }),
        });

        if (!res.ok) {
          if (!cancelled) {
            setHasGeminiError(true);
          }
          return;
        }

        if (cancelled) {
          return;
        }

        const payload = (await res.json()) as Partial<GeminiReportResponse>;
        if (payload.summary && payload.locked_data && !cancelled) {
          setGeminiResult({
            summary: payload.summary,
            locked_data: payload.locked_data,
          });
        } else if (!cancelled) {
          setHasGeminiError(true);
        }
      } catch {
        if (!cancelled) {
          setHasGeminiError(true);
        }
      } finally {
        if (!cancelled) {
          setIsGeminiLoading(false);
        }
      }
    }

    loadGemini();

    return () => {
      cancelled = true;
    };
  }, [
    address,
    region,
    reportData.public_metrics,
    reportData.raw_locked_inputs,
    reportData.extended_insights,
    reportData.store_basic_info,
  ]);

  if (!isHydrated) {
    return <ReportSkeleton />;
  }

  const displaySummary = geminiResult?.summary
    ?? (isGeminiLoading ? LOADING_SUMMARY : hasGeminiError ? ERROR_SUMMARY : '');

  const displayLockedData = geminiResult?.locked_data
    ?? (isGeminiLoading ? LOADING_LOCKED_DATA : hasGeminiError ? ERROR_LOCKED_DATA : reportData.locked_data);

  const displayData: ReportData = {
    ...reportData,
    summary: displaySummary,
    locked_data: displayLockedData,
  };

  return (
    <main className='mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10'>
      <header className='rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-6'>
        <p className='text-xs font-semibold uppercase tracking-wide text-indigo-600'>분석 주소</p>
        <h1 className='mt-2 text-2xl font-bold text-slate-900 sm:text-3xl'>{address}</h1>
      </header>

      <PublicSection address={address} data={displayData} />

      <section className='rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-xl font-bold text-slate-900'>심화 분석 리포트</h2>
          <div className='flex items-center gap-2'>
            {isGeminiLoading ? (
              <span className='rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700'>
                AI 분석 중
              </span>
            ) : hasGeminiError ? (
              <span className='rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700'>
                AI 분석 실패
              </span>
            ) : null}
            {!isUnlocked ? (
              <span className='rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700'>
                잠금 상태
              </span>
            ) : null}
          </div>
        </div>

        <div className={isUnlocked ? '' : 'blur-sm pointer-events-none select-none'}>
          <LockedSection data={displayData.locked_data} />
        </div>

        {!isUnlocked ? <UnlockCTA onClick={() => setIsModalOpen(true)} /> : null}
      </section>

      <LeadCaptureModal
        isOpen={isModalOpen}
        address={address}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsUnlocked(true);
          setIsModalOpen(false);
        }}
      />

      {isUnlocked ? <FloatingChatbot address={address} /> : null}
    </main>
  );
}
