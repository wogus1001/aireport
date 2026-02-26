import type {
  ExtendedInsights,
  LockedData,
  PublicMetrics,
  RawLockedInputs,
  StoreBasicInfo,
} from '@/lib/types';

interface LockedSectionContext {
  public_metrics: PublicMetrics;
  raw_locked_inputs?: RawLockedInputs;
  extended_insights?: ExtendedInsights;
  store_basic_info?: StoreBasicInfo;
}

interface LockedSectionProps {
  data: LockedData;
  context: LockedSectionContext;
}

interface DiagnosisCard {
  title: string;
  score: number;
  grade: string;
  detail: string;
}

interface TrendChart {
  title: string;
  subtitle: string;
  values: number[];
}

const KR = {
  excellent: '\uc6b0\uc218',
  good: '\uc591\ud638',
  caution: '\uc8fc\uc758',
  risk: '\uc704\ud5d8',
  points: '\uc810',
  dashboard: '\uc2ec\ud654 \uc9c4\ub2e8 \ub300\uc2dc\ubcf4\ub4dc',
  basis: '\uacf5\uac1c\ub370\uc774\ud130 \uae30\ubc18',
  stability: '\uc0c1\uad8c \uc548\uc815\uc131',
  competition: '\uacbd\uc7c1 \ubd80\ub2f4\ub3c4',
  rentEfficiency: '\uc784\ub300 \ud6a8\uc728',
  demandFit: '\uc218\uc694\u00b7\uc811\uadfc \uc801\ud569\ub3c4',
  trendTitle: '\ucd94\uc138 \ubbf8\ub2c8 \ucc28\ud2b8',
  searchFlow: '\uac80\uc0c9\ub7c9 \ud750\ub984 \ucc28\ud2b8',
  searchFlowSub: '\ucd5c\uadfc \uc8fc\ucc28\ubcc4 \uad00\uc2ec\ub3c4 \ucd94\uc774',
  regionalFlow: '\uc9c0\uc5ed \ub9e4\ucd9c \ud750\ub984 \ucc28\ud2b8',
  regionalFlowSub: '\ubd84\uae30\ubcc4 \uacf5\uac1c\ub370\uc774\ud130 \ucd94\uc138',
  latestValue: '\ucd5c\uc2e0\uac12',
  riskAlert: '\ub9ac\uc2a4\ud06c \uc54c\ub9bc',
  top3: '\ucd94\ucc9c \uc2e4\ud589 \uc804\ub7b5 TOP 3',
  noTrend: '\uc0c1\uad8c \ucd94\uc138 \ub370\uc774\ud130 \uc81c\ud55c',
  noOpenClose: '\uac1c\uc5c5\u00b7\ud3d0\uc5c5 \ub370\uc774\ud130 \uc81c\ud55c',
  noComp: '\uacbd\uc7c1 \ub370\uc774\ud130 \uc81c\ud55c',
  noRent: '\uc784\ub300 \ub370\uc774\ud130 \uc81c\ud55c',
  noTarget: '\ud0c0\uac9f \ub370\uc774\ud130 \uc81c\ud55c',
  noParking: '\uc8fc\ucc28 \ub370\uc774\ud130 \uc81c\ud55c',
  noAccess: '\uc811\uadfc\uc131 \ub370\uc774\ud130 \uc81c\ud55c',
  noSearch: '\uac80\uc0c9 \ucd94\uc138 \ub370\uc774\ud130 \uc81c\ud55c',
  trendLabel: '\uc0c1\uad8c \ucd94\uc138',
  openCloseLabel: '\uac1c\uc5c5\u00b7\ud3d0\uc5c5',
  targetLabel: '\ud0c0\uac9f',
  parkingLabel: '\uc8fc\ucc28',
  accessLabel: '\uc811\uadfc\uc131',
  searchLabel: '\uac80\uc0c9 \ucd94\uc138',
  monthlyRentRatio: '\uc6d4\uc138 \ube44\uc728',
  rentPerArea: '\uba74\uc801\ub2f9 \uc6d4\uc138',
  wonPerSquareMeter: '\uc6d0/\u33a1',
} as const;

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPercent(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/([+-]?[0-9]+(?:\.[0-9]+)?)\s*%/);
  if (!match?.[1]) return null;
  return toNumber(match[1]);
}

function extractCount(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/([0-9][0-9,]*)\s*(?:\uac1c|\uac74)/);
  if (!match?.[1]) return null;
  return toNumber(match[1]);
}

function extractAccessibilityScore(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/\uc810\uc218\s*([0-9]+(?:\.[0-9]+)?)/);
  if (match?.[1]) return toNumber(match[1]);
  return toNumber(text);
}

function extractMonthlyRent(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/\uc6d4\uc138\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
  if (!match?.[1]) return null;
  return toNumber(match[1]);
}

function extractArea(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/\uba74\uc801\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
  if (!match?.[1]) return null;
  return toNumber(match[1]);
}

function extractFirstTwoNumbers(text: string | undefined): [number, number] | null {
  if (!text) return null;
  const numbers = (text.match(/[0-9]+(?:\.[0-9]+)?/g) ?? [])
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));
  if (numbers.length < 2) return null;
  return [numbers[0] ?? 0, numbers[1] ?? 0];
}

function extractSeries(text: string | undefined): number[] {
  if (!text) return [];
  const head = text.split('(')[0] ?? text;
  return (head.match(/[0-9]+(?:\.[0-9]+)?/g) ?? [])
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));
}

function extractManwonSeries(text: string | undefined): number[] {
  if (!text) return [];
  const out: number[] = [];
  const regex = /([0-9][0-9,]*(?:\.[0-9]+)?)\ub9cc\uc6d0/g;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const value = toNumber(match[1]);
    if (value !== null) out.push(value);
    match = regex.exec(text);
  }
  return out;
}

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function gradeFromScore(score: number): string {
  if (score >= 80) return KR.excellent;
  if (score >= 60) return KR.good;
  if (score >= 40) return KR.caution;
  return KR.risk;
}

function buildStabilityDiagnosis(raw: string | undefined, trend: string | undefined): DiagnosisCard {
  let score = 55;
  const trendPercent = extractPercent(trend);
  if (trendPercent !== null) {
    if (trendPercent >= 8) score += 20;
    else if (trendPercent >= 0) score += 10;
    else if (trendPercent <= -8) score -= 25;
    else score -= 12;
  }

  const openClose = extractFirstTwoNumbers(raw);
  if (openClose) {
    const open = openClose[0];
    const close = openClose[1];
    if (close > open) score -= 20;
    else score += 10;
  }

  const detail = [
    trend ? `${KR.trendLabel}: ${trend}` : KR.noTrend,
    raw ? `${KR.openCloseLabel}: ${raw}` : KR.noOpenClose,
  ].join(' / ');

  const normalized = clampScore(score);
  return {
    title: KR.stability,
    score: normalized,
    grade: gradeFromScore(normalized),
    detail,
  };
}

function buildCompetitionDiagnosis(competitor: string | undefined): DiagnosisCard {
  let score = 60;
  const density = extractPercent(competitor);
  const count = extractCount(competitor);

  if (density !== null) {
    if (density >= 10) score -= 25;
    else if (density >= 5) score -= 15;
    else if (density >= 2) score -= 8;
    else score += 8;
  }
  if (count !== null) {
    if (count >= 300) score -= 20;
    else if (count >= 150) score -= 12;
    else if (count >= 70) score -= 6;
    else if (count <= 30) score += 8;
  }

  const normalized = clampScore(score);
  return {
    title: KR.competition,
    score: normalized,
    grade: gradeFromScore(normalized),
    detail: competitor ?? KR.noComp,
  };
}

function buildRentDiagnosis(rentRaw: string | undefined, store: StoreBasicInfo | undefined): DiagnosisCard {
  let score = 55;
  const rent = extractMonthlyRent(rentRaw);
  const area = extractArea(rentRaw);
  const monthlySales = toNumber(store?.monthly_avg_sales);
  let detail = rentRaw ?? KR.noRent;

  if (rent !== null && monthlySales !== null && monthlySales > 0) {
    const ratio = (rent / monthlySales) * 100;
    if (ratio <= 12) score += 22;
    else if (ratio <= 18) score += 10;
    else if (ratio <= 25) score -= 8;
    else score -= 20;
    detail = `${detail} / ${KR.monthlyRentRatio} ${ratio.toFixed(1)}%`;
  } else if (rent !== null && area !== null && area > 0) {
    const rentPerArea = rent / area;
    if (rentPerArea <= 30000) score += 18;
    else if (rentPerArea <= 50000) score += 8;
    else if (rentPerArea <= 80000) score -= 8;
    else score -= 18;
    detail = `${detail} / ${KR.rentPerArea} ${Math.round(rentPerArea).toLocaleString('ko-KR')}${KR.wonPerSquareMeter}`;
  }

  const normalized = clampScore(score);
  return {
    title: KR.rentEfficiency,
    score: normalized,
    grade: gradeFromScore(normalized),
    detail,
  };
}

function buildDemandDiagnosis(
  mainTarget: string | undefined,
  parkingInfo: string | undefined,
  accessibility: string | undefined,
  naverTrend: string | undefined,
): DiagnosisCard {
  let score = 60;
  const access = extractAccessibilityScore(accessibility);
  if (access !== null) {
    if (access >= 85) score += 18;
    else if (access >= 70) score += 10;
    else if (access < 50) score -= 12;
  }

  const parkingCount = extractCount(parkingInfo);
  if (parkingCount !== null) {
    if (parkingCount >= 20) score += 12;
    else if (parkingCount >= 8) score += 6;
    else if (parkingCount <= 2) score -= 8;
  }

  const series = extractSeries(naverTrend);
  if (series.length >= 4) {
    const latest = series[series.length - 1] ?? 0;
    const base = series[0] ?? 0;
    const delta = latest - base;
    if (delta >= 10) score += 10;
    else if (delta <= -10) score -= 12;
  }

  const detail = [
    mainTarget ? `${KR.targetLabel}: ${mainTarget}` : KR.noTarget,
    parkingInfo ? `${KR.parkingLabel}: ${parkingInfo}` : KR.noParking,
    accessibility ? `${KR.accessLabel}: ${accessibility}` : KR.noAccess,
    naverTrend ? `${KR.searchLabel}: ${naverTrend}` : KR.noSearch,
  ].join(' / ');

  const normalized = clampScore(score);
  return {
    title: KR.demandFit,
    score: normalized,
    grade: gradeFromScore(normalized),
    detail,
  };
}

function buildDiagnoses(context: LockedSectionContext): DiagnosisCard[] {
  return [
    buildStabilityDiagnosis(
      context.raw_locked_inputs?.open_close_stats_raw,
      context.raw_locked_inputs?.commercial_trend_raw,
    ),
    buildCompetitionDiagnosis(context.public_metrics.competitor_count),
    buildRentDiagnosis(context.raw_locked_inputs?.rent_price_raw, context.store_basic_info),
    buildDemandDiagnosis(
      context.public_metrics.main_target,
      context.public_metrics.parking_info,
      context.extended_insights?.kakao_accessibility_score,
      context.extended_insights?.naver_trend_series,
    ),
  ];
}

function buildTrendCharts(context: LockedSectionContext): TrendChart[] {
  const charts: TrendChart[] = [];

  const naver = extractSeries(context.extended_insights?.naver_trend_series);
  if (naver.length >= 3) {
    charts.push({
      title: KR.searchFlow,
      subtitle: KR.searchFlowSub,
      values: naver.slice(-6),
    });
  }

  const regional = extractManwonSeries(context.extended_insights?.regional_trend_timeline);
  if (regional.length >= 3) {
    charts.push({
      title: KR.regionalFlow,
      subtitle: KR.regionalFlowSub,
      values: regional.slice(-6),
    });
  }

  return charts;
}

function buildPolylinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function Sparkline({ values }: { values: number[] }) {
  const width = 220;
  const height = 64;
  const points = buildPolylinePoints(values, width, height);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className='h-16 w-full'>
      <polyline
        fill='none'
        stroke='rgb(79 70 229)'
        strokeWidth='2.5'
        strokeLinejoin='round'
        strokeLinecap='round'
        points={points}
      />
    </svg>
  );
}

export default function LockedSection({ data, context }: LockedSectionProps) {
  const diagnoses = buildDiagnoses(context);
  const charts = buildTrendCharts(context);

  return (
    <div className='space-y-4'>
      <article className='rounded-2xl border border-indigo-200 bg-gradient-to-br from-white via-indigo-50/60 to-sky-50/80 p-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-base font-semibold text-slate-900'>{KR.dashboard}</h3>
          <span className='rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700'>
            {KR.basis}
          </span>
        </div>
        <div className='mt-3 grid gap-3 sm:grid-cols-2'>
          {diagnoses.map((item) => (
            <article key={item.title} className='rounded-xl border border-white/80 bg-white/90 p-3 shadow-sm'>
              <div className='flex items-center justify-between gap-2'>
                <p className='text-sm font-semibold text-slate-900'>{item.title}</p>
                <span className='rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700'>
                  {item.grade} {item.score}
                  {KR.points}
                </span>
              </div>
              <div className='mt-2 h-2 overflow-hidden rounded-full bg-slate-100'>
                <div
                  className='h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500'
                  style={{ width: `${item.score}%` }}
                />
              </div>
              <p className='mt-2 text-xs leading-relaxed text-slate-600'>{item.detail}</p>
            </article>
          ))}
        </div>
      </article>

      {charts.length > 0 ? (
        <article className='rounded-2xl border border-slate-200 bg-slate-50/70 p-4'>
          <h3 className='text-base font-semibold text-slate-900'>{KR.trendTitle}</h3>
          <div className='mt-3 grid gap-3 sm:grid-cols-2'>
            {charts.map((chart) => (
              <div key={chart.title} className='rounded-xl border border-slate-200 bg-white p-3'>
                <p className='text-sm font-semibold text-slate-900'>{chart.title}</p>
                <p className='mt-0.5 text-xs text-slate-500'>{chart.subtitle}</p>
                <div className='mt-3'>
                  <Sparkline values={chart.values} />
                </div>
                <p className='mt-2 text-xs text-slate-500'>
                  {KR.latestValue} {chart.values[chart.values.length - 1]?.toLocaleString('ko-KR')}
                </p>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      <article className='rounded-xl border border-rose-200 bg-rose-50 p-4'>
        <p className='text-sm font-medium text-rose-700'>{KR.riskAlert}</p>
        <p className='mt-2 text-sm leading-relaxed text-rose-800 sm:text-base'>{data.risk_alert}</p>
      </article>

      <article className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
        <h3 className='text-base font-semibold text-slate-900'>{KR.top3}</h3>
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
