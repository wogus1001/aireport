import type { LockedData } from '@/lib/types';

interface LockedSectionProps {
  data: LockedData;
}

export default function LockedSection({ data }: LockedSectionProps) {
  return (
    <div className='space-y-4'>
      <article className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
        <p className='text-sm font-medium text-slate-500'>예상 월 매출</p>
        <p className='mt-2 text-2xl font-bold text-slate-900'>{data.estimated_revenue}</p>
      </article>

      <article className='rounded-xl border border-rose-200 bg-rose-50 p-4'>
        <p className='text-sm font-medium text-rose-700'>리스크 알림</p>
        <p className='mt-2 text-sm leading-relaxed text-rose-800 sm:text-base'>{data.risk_alert}</p>
      </article>

      <article className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
        <h3 className='text-base font-semibold text-slate-900'>추천 실행 전략 TOP 3</h3>
        <ul className='mt-3 space-y-3'>
          {data.top_3_strategies.map((strategy) => (
            <li key={strategy.title} className='rounded-lg border border-slate-200 bg-white p-3'>
              <p className='text-sm font-semibold text-slate-900'>{strategy.title}</p>
              <p className='mt-1 text-sm leading-relaxed text-slate-700'>{strategy.description}</p>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
