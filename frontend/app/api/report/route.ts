import { NextResponse } from 'next/server';
import {
  buildGeminiSystemPrompt,
  getGeminiModel,
  type GeminiReportRequest,
  type GeminiReportResponse,
} from '@/lib/gemini';
import type { LockedData, Strategy } from '@/lib/types';

interface CacheLookupResponse {
  hit: boolean;
  reportJson?: string;
  publicDataJson?: string;
}

const REPORT_CACHE_VERSION = 'report-v4';
const MIN_SUMMARY_LENGTH = 220;
const MIN_SUMMARY_SENTENCE_COUNT = 5;

function hasUsableGeminiKey(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (normalized === 'YOUR_GEMINI_API_KEY' || normalized === 'YOUR_API_KEY') {
    return false;
  }

  return true;
}

function parseGeminiJsonResponse(rawText: string): unknown {
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    const candidate = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  }
}

function isValidGeminiResponse(value: unknown): value is GeminiReportResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const parsed = value as Partial<GeminiReportResponse>;
  if (typeof parsed.summary !== 'string' || !parsed.locked_data) {
    return false;
  }

  const lockedData = parsed.locked_data;
  if (
    typeof lockedData.estimated_revenue !== 'string' ||
    typeof lockedData.risk_alert !== 'string' ||
    !Array.isArray(lockedData.top_3_strategies)
  ) {
    return false;
  }

  return lockedData.top_3_strategies.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof item.title === 'string' &&
      typeof item.description === 'string',
  );
}

function normalizeSpringBootUrl(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return value.trim().replace(/\/+$/, '');
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildAddressKey(payload: GeminiReportRequest): string {
  const fingerprintSource = JSON.stringify({
    address: payload.address.trim(),
    region: payload.region,
    public_metrics: payload.public_metrics,
    raw_locked_inputs: payload.raw_locked_inputs,
    extended_insights: payload.extended_insights,
    store_basic_info: payload.store_basic_info,
  });
  const fingerprint = hashString(fingerprintSource);
  return encodeURIComponent(`${REPORT_CACHE_VERSION}:${payload.address.trim()}:${fingerprint}`);
}

function normalizeText(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized === '데이터 없음') {
    return null;
  }
  return normalized;
}

function extractRevenueText(source: string | undefined): string {
  const value = normalizeText(source);
  if (!value) {
    return '확인 필요';
  }

  const matched = value.match(/[0-9][0-9,]*\s*만원/);
  if (matched && matched[0]) {
    return matched[0].replace(/\s+/g, '');
  }

  const firstSegment = value.split('/').map((segment) => segment.trim()).find((segment) => segment.length > 0);
  return firstSegment ?? value;
}

function countSentences(text: string): number {
  return text
    .split(/[\.\!\?]\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

function isNumericOnlySentence(text: string): boolean {
  const compact = text.replace(/\s+/g, '').replace(/[.!?]+$/g, '');
  return /^\d+(?:[.,]\d+)?%?$/.test(compact);
}

function hasFragmentedSummary(text: string): boolean {
  const parts = text
    .split(/[\.\!\?]\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return true;

  const numericOnlyCount = parts.filter((part) => isNumericOnlySentence(part)).length;
  const shortCount = parts.filter((part) => part.length < 18).length;
  return numericOnlyCount > 0 || shortCount >= Math.ceil(parts.length / 2);
}

function stripNumericOnlySentences(text: string): string {
  const parts = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const filtered = parts.filter((part) => !isNumericOnlySentence(part));
  return filtered.join(' ');
}

function normalizeStrategies(strategies: Strategy[] | undefined, context: GeminiReportRequest): Strategy[] {
  const clean =
    strategies?.filter(
      (strategy) =>
        strategy &&
        strategy.title.trim().length > 0 &&
        strategy.description.trim().length > 0,
    ) ?? [];

  if (clean.length >= 3) {
    return clean.slice(0, 3);
  }

  const fallback: Strategy[] = [
    {
      title: '상권 실수요 집중 시간대 공략',
      description:
        '주소 인근 타겟과 유입 패턴을 기준으로 피크타임 전용 상품과 프로모션을 구성해 객단가와 회전율을 높이세요.',
    },
    {
      title: '경쟁 업종 대비 차별 포지셔닝',
      description:
        '경쟁 밀도와 개업·폐업 흐름을 반영해 가격대, 상품 구성, 채널 운영 전략을 4주 단위로 점검하세요.',
    },
    {
      title: '고정비 대비 손익 관리',
      description:
        `임대 조건(${extractRevenueText(context.raw_locked_inputs.rent_price_raw)})과 매출 흐름을 연결해 손익분기점 달성 시나리오를 관리하세요.`,
    },
  ];

  const merged = [...clean];
  for (const item of fallback) {
    if (merged.length >= 3) {
      break;
    }
    const exists = merged.some((strategy) => strategy.title === item.title);
    if (!exists) {
      merged.push(item);
    }
  }
  return merged.slice(0, 3);
}

function buildFactLines(payload: GeminiReportRequest): string[] {
  const facts: string[] = [];

  const searchTrend = normalizeText(payload.public_metrics.search_trend);
  if (searchTrend) {
    facts.push(`- 검색 트렌드: ${searchTrend}`);
  }

  const mainTarget = normalizeText(payload.public_metrics.main_target);
  if (mainTarget) {
    facts.push(`- 주요 타겟: ${mainTarget}`);
  }

  const competitor = normalizeText(payload.public_metrics.competitor_count);
  if (competitor) {
    facts.push(`- 경쟁 강도: ${competitor}`);
  }

  const parking = normalizeText(payload.public_metrics.parking_info);
  if (parking) {
    facts.push(`- 주차/접근성: ${parking}`);
  }

  const estimatedRevenue = normalizeText(payload.raw_locked_inputs.estimated_revenue_raw);
  if (estimatedRevenue) {
    facts.push(`- 유사 업종 월 매출 참고치: ${estimatedRevenue}`);
  }

  const trend = normalizeText(payload.raw_locked_inputs.commercial_trend_raw);
  if (trend) {
    facts.push(`- 상권 추세: ${trend}`);
  }

  const openClose = normalizeText(payload.raw_locked_inputs.open_close_stats_raw);
  if (openClose) {
    facts.push(`- 개업/폐업 지표: ${openClose}`);
  }

  const rent = normalizeText(payload.raw_locked_inputs.rent_price_raw);
  if (rent) {
    facts.push(`- 임대 조건: ${rent}`);
  }

  const ageDistribution = normalizeText(payload.extended_insights?.sgis_age_distribution);
  if (ageDistribution) {
    facts.push(`- 연령 분포: ${ageDistribution}`);
  }

  const regionalTimeline = normalizeText(payload.extended_insights?.regional_trend_timeline);
  if (regionalTimeline) {
    facts.push(`- 지역 추세: ${regionalTimeline}`);
  }

  const categoryBreakdown = normalizeText(payload.extended_insights?.sdsc_category_breakdown);
  if (categoryBreakdown) {
    facts.push(`- 반경 업종 구성: ${categoryBreakdown}`);
  }

  const naverTrend = normalizeText(payload.extended_insights?.naver_trend_series);
  if (naverTrend) {
    facts.push(`- 검색량 추세: ${naverTrend}`);
  }

  const kakaoAccessibility = normalizeText(payload.extended_insights?.kakao_accessibility_score);
  if (kakaoAccessibility) {
    facts.push(`- 접근성 점수: ${kakaoAccessibility}`);
  }

  const storeName = normalizeText(payload.store_basic_info?.store_name);
  if (storeName) {
    facts.push(`- 매물명: ${storeName}`);
  }

  const monthlySales = normalizeText(payload.store_basic_info?.monthly_avg_sales);
  if (monthlySales) {
    facts.push(`- 매물 월 매출: ${monthlySales}`);
  }

  return facts.slice(0, 12);
}

function buildFallbackSummary(payload: GeminiReportRequest): string {
  const estimatedRevenue = extractRevenueText(payload.raw_locked_inputs.estimated_revenue_raw);
  const searchTrend =
    normalizeText(payload.public_metrics.search_trend) ?? '검색량 추세 데이터가 제한적입니다';
  const mainTarget =
    normalizeText(payload.public_metrics.main_target) ?? '주요 타겟 데이터가 제한적입니다';
  const competitor =
    normalizeText(payload.public_metrics.competitor_count) ?? '경쟁 강도 데이터가 제한적입니다';
  const parking =
    normalizeText(payload.public_metrics.parking_info) ?? '주차/접근성 데이터가 제한적입니다';
  const trend =
    normalizeText(payload.raw_locked_inputs.commercial_trend_raw) ?? '상권 추세 데이터가 제한적입니다';
  const openClose =
    normalizeText(payload.raw_locked_inputs.open_close_stats_raw) ?? '개업·폐업 데이터가 제한적입니다';
  const rent =
    normalizeText(payload.raw_locked_inputs.rent_price_raw) ?? '임대 조건 데이터가 제한적입니다';
  const timeline =
    normalizeText(payload.extended_insights?.regional_trend_timeline) ?? '지역 추세 타임라인 데이터가 제한적입니다';
  const accessibility =
    normalizeText(payload.extended_insights?.kakao_accessibility_score) ?? '접근성 점수 데이터가 제한적입니다';

  return [
    `${payload.address} 기준 공개 데이터를 종합하면 기회와 리스크가 함께 존재하는 상권입니다.`,
    `검색 흐름은 "${searchTrend}"로 확인되며, 주요 고객층은 "${mainTarget}"로 요약됩니다.`,
    `경쟁 강도는 "${competitor}"로 파악되어 업종 차별화 전략이 필요합니다.`,
    `유사 업종 월 매출 참고치는 ${estimatedRevenue} 수준으로 확인되며, 실제 매장 매출과는 구분해 해석해야 합니다.`,
    `임대 조건은 "${rent}"이고, 상권 추세는 "${trend}"로 나타납니다.`,
    `개업·폐업 흐름은 "${openClose}"이며, 최근 지역 타임라인은 "${timeline}"입니다.`,
    `접근성 및 방문 편의 측면에서는 "${parking}"와 "${accessibility}" 정보를 함께 검토하는 것이 유효합니다.`,
    '권장 실행: 초기 4주 동안 유입 채널별 전환율과 객단가를 주간 단위로 점검하고, 경쟁 업종 대비 가격·상품·운영시간 차별화를 동시에 적용하세요.',
  ].join(' ');
}

function buildFallbackLockedData(payload: GeminiReportRequest): LockedData {
  const estimatedRevenue = extractRevenueText(payload.raw_locked_inputs.estimated_revenue_raw);
  const riskAlert =
    normalizeText(payload.raw_locked_inputs.open_close_stats_raw) ??
    normalizeText(payload.raw_locked_inputs.commercial_trend_raw) ??
    '공개 데이터 기준 변동성 신호가 불충분하므로 초기 운영 리스크를 보수적으로 관리해야 합니다.';

  return {
    estimated_revenue: estimatedRevenue,
    risk_alert: riskAlert,
    top_3_strategies: normalizeStrategies(undefined, payload),
  };
}

function ensureSummaryQuality(summary: string, payload: GeminiReportRequest): string {
  const trimmed = summary.trim();
  if (!trimmed) {
    return buildFallbackSummary(payload);
  }

  const sentenceCount = countSentences(trimmed);
  if (
    trimmed.length >= MIN_SUMMARY_LENGTH &&
    sentenceCount >= MIN_SUMMARY_SENTENCE_COUNT &&
    !hasFragmentedSummary(trimmed)
  ) {
    return trimmed;
  }

  return buildFallbackSummary(payload);
}

function replaceForbiddenTerms(text: string): string {
  return text
    .replace(/SGIS/gi, '인구통계')
    .replace(/에스지아이에스/gi, '인구통계')
    .replace(/실행\s*우선순위\s*:/gi, '권장 실행:');
}

function normalizeInlineText(text: string): string {
  return replaceForbiddenTerms(text)
    .replace(/예상\s*월\s*매출/gi, '유사 업종 월 매출 참고치')
    .replace(/월\s*평균\s*매출/gi, '유사 업종 월 매출 참고치')
    .replace(/매출\s*추정(?:치)?/gi, '유사 업종 월 매출 참고치')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSummaryText(text: string): string {
  const inline = normalizeInlineText(stripNumericOnlySentences(text));
  const withLineBreaks = inline.replace(/([.!?])\s+/g, '$1\n');
  return withLineBreaks.replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeGeminiResponse(
  report: GeminiReportResponse,
  payload: GeminiReportRequest,
): GeminiReportResponse {
  const qualitySummary = ensureSummaryQuality(report.summary, payload);

  return {
    summary: normalizeSummaryText(qualitySummary),
    locked_data: {
      estimated_revenue: normalizeInlineText(
        normalizeText(report.locked_data.estimated_revenue)
          ?? extractRevenueText(payload.raw_locked_inputs.estimated_revenue_raw),
      ),
      risk_alert: normalizeInlineText(
        normalizeText(report.locked_data.risk_alert)
          ?? buildFallbackLockedData(payload).risk_alert,
      ),
      top_3_strategies: normalizeStrategies(report.locked_data.top_3_strategies, payload).map((strategy) => ({
        title: normalizeInlineText(strategy.title),
        description: normalizeInlineText(strategy.description),
      })),
    },
  };
}

function fallbackResponse(
  reason: string,
  payload?: GeminiReportRequest,
): NextResponse<GeminiReportResponse> {
  const fallbackPayload: GeminiReportRequest =
    payload ??
    ({
      address: '주소 정보 없음',
      region: undefined,
      public_metrics: {
        search_trend: '데이터 없음',
        main_target: '데이터 없음',
        competitor_count: '데이터 없음',
        parking_info: '데이터 없음',
      },
      raw_locked_inputs: {
        estimated_revenue_raw: '데이터 없음',
        commercial_trend_raw: '데이터 없음',
        open_close_stats_raw: '데이터 없음',
        rent_price_raw: '데이터 없음',
      },
      extended_insights: undefined,
      store_basic_info: undefined,
    } satisfies GeminiReportRequest);

  const fallbackReport: GeminiReportResponse = {
    summary: buildFallbackSummary(fallbackPayload),
    locked_data: buildFallbackLockedData(fallbackPayload),
  };

  return NextResponse.json(fallbackReport, {
    status: 200,
    headers: {
      'x-report-source': 'fallback',
      'x-report-fallback-reason': reason,
    },
  });
}

async function getCachedReport(
  springBootUrl: string,
  addressKey: string,
): Promise<GeminiReportResponse | null> {
  try {
    const response = await fetch(`${springBootUrl}/api/v1/cache/${addressKey}`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Partial<CacheLookupResponse>;
    if (!payload.hit || !payload.reportJson) {
      return null;
    }

    const parsed = JSON.parse(payload.reportJson) as unknown;
    return isValidGeminiResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function saveCache(
  springBootUrl: string,
  addressKey: string,
  report: GeminiReportResponse,
  requestPayload: GeminiReportRequest,
): Promise<void> {
  try {
    await fetch(`${springBootUrl}/api/v1/cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addressKey,
        reportJson: JSON.stringify(report),
        publicDataJson: JSON.stringify({
          public_metrics: requestPayload.public_metrics,
          raw_locked_inputs: requestPayload.raw_locked_inputs,
          extended_insights: requestPayload.extended_insights,
          store_basic_info: requestPayload.store_basic_info,
        }),
      }),
    });
  } catch {
    // Cache write failure should not fail report response.
  }
}

function toGeminiPrompt(payload: GeminiReportRequest, systemPrompt: string): string {
  const userData = JSON.stringify(
    {
      address: payload.address,
      region: payload.region,
      public_metrics: payload.public_metrics,
      raw_locked_inputs: payload.raw_locked_inputs,
      extended_insights: payload.extended_insights,
      store_basic_info: payload.store_basic_info,
    },
    null,
    2,
  );

  return `${systemPrompt}

Return ONLY valid JSON. No markdown, no backticks.
Write all natural-language values in Korean.
Do not use these terms: "예상 월 매출", "월 평균 매출", "매출 추정".
Use this exact term instead: "유사 업종 월 매출 참고치".
Reflect that it is a public-data-based reference value, not actual store sales.

Required JSON schema:
{
  "summary": "7-9 Korean sentences. Include at least 5 numeric facts from input. Include both risk and opportunity. Never use the term 'SGIS'. Last sentence must start with '권장 실행:'",
  "locked_data": {
    "estimated_revenue": "single concise value in 만원 단위 when possible",
    "risk_alert": "one concrete risk sentence tied to input data",
    "top_3_strategies": [
      { "title": "string", "description": "string" },
      { "title": "string", "description": "string" },
      { "title": "string", "description": "string" }
    ]
  }
}

Input JSON:
${userData}`;
}

export async function POST(request: Request) {
  let normalizedPayload: GeminiReportRequest | null = null;

  try {
    const payload = (await request.json()) as Partial<GeminiReportRequest>;
    if (!payload.address || !payload.raw_locked_inputs || !payload.public_metrics) {
      return fallbackResponse('invalid-payload');
    }

    normalizedPayload = {
      address: payload.address,
      region: payload.region,
      raw_locked_inputs: payload.raw_locked_inputs,
      public_metrics: payload.public_metrics,
      extended_insights: payload.extended_insights,
      store_basic_info: payload.store_basic_info,
    };

    const springBootUrl = normalizeSpringBootUrl(process.env.SPRING_BOOT_URL);
    const addressKey = buildAddressKey(normalizedPayload);

    if (springBootUrl) {
      const cachedReport = await getCachedReport(springBootUrl, addressKey);
      if (cachedReport) {
        const normalizedCached = normalizeGeminiResponse(cachedReport, normalizedPayload);
        return NextResponse.json(normalizedCached, {
          status: 200,
          headers: {
            'x-report-source': 'cache',
          },
        });
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!hasUsableGeminiKey(apiKey)) {
      return fallbackResponse('missing-api-key', normalizedPayload);
    }

    const model = getGeminiModel(apiKey);
    const systemPrompt = buildGeminiSystemPrompt(normalizedPayload.region);
    const result = await model.generateContent(toGeminiPrompt(normalizedPayload, systemPrompt));
    const text = result.response.text();
    const parsed = parseGeminiJsonResponse(text);

    if (!isValidGeminiResponse(parsed)) {
      return fallbackResponse('invalid-gemini-json', normalizedPayload);
    }

    const normalizedReport = normalizeGeminiResponse(parsed, normalizedPayload);

    if (springBootUrl) {
      await saveCache(springBootUrl, addressKey, normalizedReport, normalizedPayload);
    }

    return NextResponse.json(normalizedReport, {
      status: 200,
      headers: {
        'x-report-source': 'gemini',
      },
    });
  } catch {
    return fallbackResponse('gemini-request-failed', normalizedPayload ?? undefined);
  }
}

