import type { ReportData } from '@/lib/types';

interface PublicSectionProps {
  address: string;
  data: ReportData;
}

interface LabeledValue {
  label: string;
  value: string;
}

interface SummaryContent {
  points: string[];
  recommendation: string | null;
}

function formatNumberText(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const numeric = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) {
    return value;
  }

  return new Intl.NumberFormat('ko-KR').format(numeric);
}

function formatWon(value: string | undefined): string {
  const formatted = formatNumberText(value);
  return formatted ? `${formatted}원` : '';
}

function formatArea(value: string | undefined): string {
  const formatted = formatNumberText(value);
  return formatted ? `${formatted}㎡` : '';
}

function parseCoordinate(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildMapEmbedUrl(lat: number, lng: number): string {
  const delta = 0.0035;
  const left = (lng - delta).toFixed(6);
  const bottom = (lat - delta).toFixed(6);
  const right = (lng + delta).toFixed(6);
  const top = (lat + delta).toFixed(6);
  const marker = `${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${marker}`;
}

function buildKakaoMapLink(address: string, lat: number, lng: number): string {
  return `https://map.kakao.com/link/map/${encodeURIComponent(address)},${lat},${lng}`;
}

function keepTruthyItems(items: LabeledValue[]): LabeledValue[] {
  return items.filter((item) => item.value.trim().length > 0);
}

function isMeaningfulValue(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.toLowerCase() === 'n/a') {
    return false;
  }

  return !trimmed.includes('데이터 없음');
}

function sanitizeDisplayText(value: string): string {
  return value
    .replace(/SGIS/gi, '인구통계')
    .replace(/에스지아이에스/gi, '인구통계')
    .replace(/실행\s*우선순위\s*:/gi, '권장 실행:')
    .trim();
}

function parseSummaryContent(summary: string): SummaryContent {
  const normalized = sanitizeDisplayText(summary).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { points: [], recommendation: null };
  }

  const recommendationIndex = normalized.indexOf('권장 실행:');
  const recommendation =
    recommendationIndex >= 0
      ? normalized.slice(recommendationIndex).trim()
      : null;
  const mainPart =
    recommendationIndex >= 0
      ? normalized.slice(0, recommendationIndex).trim()
      : normalized;

  const points = (mainPart.match(/[^.!?]+[.!?]?/g) ?? [mainPart])
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    points,
    recommendation,
  };
}

export default function PublicSection({ address, data }: PublicSectionProps) {
  const storeInfo = data.store_basic_info;
  const summary = parseSummaryContent(data.summary);

  const metricItems: LabeledValue[] = [
    { label: '검색 트렌드', value: sanitizeDisplayText(data.public_metrics.search_trend) },
    { label: '주요 타겟', value: sanitizeDisplayText(data.public_metrics.main_target) },
    { label: '경쟁 강도', value: sanitizeDisplayText(data.public_metrics.competitor_count) },
    { label: '주차 정보', value: sanitizeDisplayText(data.public_metrics.parking_info) },
  ];

  const tradeInfoItems: LabeledValue[] = storeInfo
    ? keepTruthyItems([
        { label: '보증금', value: formatWon(storeInfo.deposit) },
        { label: '월세', value: formatWon(storeInfo.rent) },
        { label: '권리금', value: formatWon(storeInfo.premium) },
        { label: '월평균 매출', value: formatWon(storeInfo.monthly_avg_sales) },
        { label: '협의 가능 여부', value: storeInfo.negotiable ?? '' },
      ])
    : [];

  const detailedInfoItems: LabeledValue[] = storeInfo
    ? keepTruthyItems([
        { label: '매물명', value: storeInfo.store_name ?? '' },
        {
          label: '업종',
          value: storeInfo.business_type ?? storeInfo.sub_category_name ?? storeInfo.main_category_name ?? '',
        },
        { label: '전용면적', value: formatArea(storeInfo.area) },
        { label: '층수', value: storeInfo.floor ? `${storeInfo.floor}층` : '' },
        { label: '운영기간', value: storeInfo.operation_period_months ? `${storeInfo.operation_period_months}개월` : '' },
        { label: '영업 상태', value: storeInfo.operation_status_label ?? '' },
        { label: '직원 수', value: storeInfo.worker_count_label ?? '' },
        { label: '주차 가능', value: storeInfo.parking_count_label ?? '' },
        { label: '화장실', value: storeInfo.restroom_type_label ?? '' },
        { label: '전화번호', value: storeInfo.phone ?? '' },
        { label: '상세주소', value: storeInfo.address_detail ?? '' },
      ])
    : [];

  const rawSourceItems: LabeledValue[] = data.raw_locked_inputs
    ? keepTruthyItems([
        { label: '예상 매출 원천값', value: sanitizeDisplayText(data.raw_locked_inputs.estimated_revenue_raw) },
        { label: '상권 변화 원천값', value: sanitizeDisplayText(data.raw_locked_inputs.commercial_trend_raw) },
        { label: '개업·폐업 원천값', value: sanitizeDisplayText(data.raw_locked_inputs.open_close_stats_raw) },
        { label: '임대 조건 원천값', value: sanitizeDisplayText(data.raw_locked_inputs.rent_price_raw) },
      ]).filter((item) => isMeaningfulValue(item.value))
    : [];

  const descriptionText = (storeInfo?.description ?? '').trim();
  const lat = parseCoordinate(storeInfo?.latitude);
  const lng = parseCoordinate(storeInfo?.longitude);
  const hasCoordinates = lat !== null && lng !== null;
  const mapEmbedUrl = hasCoordinates ? buildMapEmbedUrl(lat, lng) : '';
  const kakaoMapLink = hasCoordinates ? buildKakaoMapLink(address, lat, lng) : '';

  const insightItems: LabeledValue[] = data.extended_insights
    ? keepTruthyItems([
        { label: '인구통계 연령 분포', value: sanitizeDisplayText(data.extended_insights.sgis_age_distribution) },
        { label: '인구통계 업종 TOP 5', value: sanitizeDisplayText(data.extended_insights.sgis_industry_top) },
        { label: '지역 상권 추세', value: sanitizeDisplayText(data.extended_insights.regional_trend_timeline) },
        { label: '반경 500m 업종 비중', value: sanitizeDisplayText(data.extended_insights.sdsc_category_breakdown) },
        { label: '네이버 검색량 추세', value: sanitizeDisplayText(data.extended_insights.naver_trend_series) },
        { label: '카카오 접근성 점수', value: sanitizeDisplayText(data.extended_insights.kakao_accessibility_score) },
      ])
    : [];

  return (
    <section className='rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-6'>
      <h2 className='text-xl font-bold text-slate-900'>공개 리포트 요약</h2>
      <p className='mt-2 text-xs text-slate-500'>기준 주소: {address}</p>

      <div className='mt-4 space-y-2'>
        {summary.points.map((point, index) => (
          <article key={`${index + 1}-${point}`} className='flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <span className='mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white'>
              {index + 1}
            </span>
            <p className='text-sm leading-relaxed text-slate-800'>{point}</p>
          </article>
        ))}
      </div>

      {summary.recommendation ? (
        <article className='mt-4 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4'>
          <p className='text-sm font-semibold leading-relaxed text-indigo-900'>{summary.recommendation}</p>
        </article>
      ) : null}

      {tradeInfoItems.length > 0 ? (
        <div className='mt-6'>
          <h3 className='text-base font-semibold text-slate-900'>거래 관련 정보</h3>
          <div className='mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {tradeInfoItems.map((item) => (
              <article key={item.label} className='rounded-xl border border-emerald-100 bg-emerald-50/70 p-4'>
                <p className='text-xs font-medium text-emerald-700'>{item.label}</p>
                <p className='mt-2 text-sm font-semibold text-slate-900'>{item.value}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {detailedInfoItems.length > 0 || descriptionText ? (
        <div className='mt-6'>
          <h3 className='text-base font-semibold text-slate-900'>매물 상세정보</h3>
          <div className='mt-3 grid gap-3 sm:grid-cols-2'>
            {detailedInfoItems.map((item) => (
              <article key={item.label} className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
                <p className='text-xs font-medium text-slate-500'>{item.label}</p>
                <p className='mt-2 text-sm font-semibold text-slate-900'>{item.value}</p>
              </article>
            ))}
            {descriptionText ? (
              <article className='rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2'>
                <p className='text-xs font-medium text-slate-500'>매물 설명</p>
                <p className='mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-slate-800'>
                  {descriptionText}
                </p>
              </article>
            ) : null}
          </div>
        </div>
      ) : null}

      {storeInfo ? (
        <div className='mt-6'>
          <h3 className='text-base font-semibold text-slate-900'>위치 지도</h3>
          {hasCoordinates ? (
            <div className='mt-3 overflow-hidden rounded-xl border border-slate-200'>
              <iframe
                title='매물 위치 지도'
                src={mapEmbedUrl}
                className='h-72 w-full'
                loading='lazy'
                referrerPolicy='no-referrer-when-downgrade'
              />
            </div>
          ) : (
            <p className='mt-3 text-sm text-slate-600'>좌표 정보가 없어 지도를 표시할 수 없습니다.</p>
          )}
          {hasCoordinates ? (
            <a
              href={kakaoMapLink}
              target='_blank'
              rel='noreferrer'
              className='mt-3 inline-flex rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100'
            >
              카카오맵에서 보기
            </a>
          ) : null}
        </div>
      ) : null}

      <div className='mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {metricItems.map((metric) => (
          <article key={metric.label} className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
            <p className='text-xs font-medium text-slate-500'>{metric.label}</p>
            <p className='mt-2 text-base font-semibold text-slate-900'>{metric.value}</p>
          </article>
        ))}
      </div>

      {rawSourceItems.length > 0 ? (
        <div className='mt-6'>
          <h3 className='text-base font-semibold text-slate-900'>주소 기반 원천 데이터</h3>
          <div className='mt-3 grid gap-3 sm:grid-cols-2'>
            {rawSourceItems.map((item) => (
              <article key={item.label} className='rounded-xl border border-cyan-100 bg-cyan-50/70 p-4'>
                <p className='text-xs font-medium text-cyan-800'>{item.label}</p>
                <p className='mt-2 text-sm leading-relaxed text-slate-800'>{item.value}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {insightItems.length > 0 ? (
        <div className='mt-6'>
          <h3 className='text-base font-semibold text-slate-900'>추가 상권 인사이트</h3>
          <div className='mt-3 grid gap-3 sm:grid-cols-2'>
            {insightItems.map((insight) => (
              <article key={insight.label} className='rounded-xl border border-indigo-100 bg-indigo-50/70 p-4'>
                <p className='text-xs font-medium text-indigo-700'>{insight.label}</p>
                <p className='mt-2 text-sm leading-relaxed text-slate-800'>{insight.value}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
