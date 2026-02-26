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

const REPORT_CACHE_VERSION = 'report-v3';
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

function buildAddressKey(address: string): string {
  return encodeURIComponent(`${REPORT_CACHE_VERSION}:${address.trim()}`);
}

function normalizeText(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized === '?곗씠???놁쓬') {
    return null;
  }
  return normalized;
}

function extractRevenueText(source: string | undefined): string {
  const value = normalizeText(source);
  if (!value) {
    return '?뺤씤 ?꾩슂';
  }

  const matched = value.match(/[0-9][0-9,]*\s*留뚯썝/);
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
    facts.push(`- 寃??異붿꽭: ${searchTrend}`);
  }

  const mainTarget = normalizeText(payload.public_metrics.main_target);
  if (mainTarget) {
    facts.push(`- 二쇱슂 ?寃? ${mainTarget}`);
  }

  const competitor = normalizeText(payload.public_metrics.competitor_count);
  if (competitor) {
    facts.push(`- 寃쎌웳 媛뺣룄: ${competitor}`);
  }

  const parking = normalizeText(payload.public_metrics.parking_info);
  if (parking) {
    facts.push(`- 二쇱감/?묎렐?? ${parking}`);
  }

  const estimatedRevenue = normalizeText(payload.raw_locked_inputs.estimated_revenue_raw);
  if (estimatedRevenue) {
    facts.push(`- 留ㅼ텧 異붿젙 ?먯쿇媛? ${estimatedRevenue}`);
  }

  const trend = normalizeText(payload.raw_locked_inputs.commercial_trend_raw);
  if (trend) {
    facts.push(`- ?곴텒 蹂?? ${trend}`);
  }

  const openClose = normalizeText(payload.raw_locked_inputs.open_close_stats_raw);
  if (openClose) {
    facts.push(`- 媛쒖뾽/?먯뾽 吏?? ${openClose}`);
  }

  const rent = normalizeText(payload.raw_locked_inputs.rent_price_raw);
  if (rent) {
    facts.push(`- ?꾨? 議곌굔: ${rent}`);
  }

  const ageDistribution = normalizeText(payload.extended_insights?.sgis_age_distribution);
  if (ageDistribution) {
    facts.push(`- ?곕졊 遺꾪룷: ${ageDistribution}`);
  }

  const regionalTimeline = normalizeText(payload.extended_insights?.regional_trend_timeline);
  if (regionalTimeline) {
    facts.push(`- ?쒓퀎??異붿꽭: ${regionalTimeline}`);
  }

  const categoryBreakdown = normalizeText(payload.extended_insights?.sdsc_category_breakdown);
  if (categoryBreakdown) {
    facts.push(`- 諛섍꼍 ?낆쥌 援ъ꽦: ${categoryBreakdown}`);
  }

  const naverTrend = normalizeText(payload.extended_insights?.naver_trend_series);
  if (naverTrend) {
    facts.push(`- 寃?됰웾 ?쒓퀎?? ${naverTrend}`);
  }

  const kakaoAccessibility = normalizeText(payload.extended_insights?.kakao_accessibility_score);
  if (kakaoAccessibility) {
    facts.push(`- ?묎렐??吏?? ${kakaoAccessibility}`);
  }

  const storeName = normalizeText(payload.store_basic_info?.store_name);
  if (storeName) {
    facts.push(`- 留ㅻЪ紐? ${storeName}`);
  }

  const monthlySales = normalizeText(payload.store_basic_info?.monthly_avg_sales);
  if (monthlySales) {
    facts.push(`- 留ㅻЪ ?됯퇏 留ㅼ텧: ${monthlySales}`);
  }

  return facts.slice(0, 12);
}

function buildFallbackSummary(payload: GeminiReportRequest): string {
  const facts = buildFactLines(payload);
  const factsText =
    facts.length > 0
      ? facts.slice(0, 6).join(' ')
      : '媛?⑺븳 ?몃? 吏?쒓? ?쒗븳?곸씠?댁꽌 怨듦컻 ?곗씠??湲곕컲??蹂댁닔???댁꽍???꾩슂?⑸땲??';

  const estimatedRevenue = extractRevenueText(payload.raw_locked_inputs.estimated_revenue_raw);
  const riskSource =
    normalizeText(payload.raw_locked_inputs.open_close_stats_raw) ??
    normalizeText(payload.raw_locked_inputs.commercial_trend_raw) ??
    '媛쒖뾽쨌?먯뾽 諛??곴텒 蹂?숈꽦';

  return [
    `${payload.address} 湲곗? ?곴텒? ?좊룞/?뚮퉬 ?뱀꽦怨?寃쎌웳 諛?꾨? ?④퍡 ?먭??댁빞 ?섎뒗 吏??엯?덈떎.`,
    `?듭떖 ?곗씠???붿빟: ${factsText}`,
    `?꾩옱 ?뺤씤 媛?ν븳 留ㅼ텧 愿??媛믪? ${estimatedRevenue} ?섏??대ŉ, ?대뒗 ?숈씪 ?낆쥌 ?됯퇏怨??꾨? 議곌굔???④퍡 鍮꾧탳???댁꽍?댁빞 ?⑸땲??`,
    `${riskSource} 愿?먯뿉???④린 蹂?숈꽦??議댁옱?섎?濡?珥덇린 8二??댁쁺 KPI瑜?蹂댁닔?곸쑝濡??ㅺ퀎?섎뒗 ?묎렐???덉쟾?⑸땲??`,
    '湲고쉶 ?붿씤? ?寃??곕졊? 吏묒쨷 援ш컙怨??묎렐??吏?쒕? 寃고빀???쒓컙?蹂??곹뭹/梨꾨꼸 理쒖쟻?붿뿉 ?덉뒿?덈떎.',
    '沅뚯옣 ?ㅽ뻾: 1) ?곸쐞 ?좎엯 ?쒓컙? ?곹뭹 ?ш뎄??2) 寃쎌웳?낆쥌 ?鍮?媛寃?援ъ꽦 李⑤퀎??3) 怨좎젙鍮??鍮??먯씡遺꾧린??二쇨컙 異붿쟻.',
  ].join(' ');
}

function buildFallbackLockedData(payload: GeminiReportRequest): LockedData {
  const estimatedRevenue = extractRevenueText(payload.raw_locked_inputs.estimated_revenue_raw);
  const riskAlert =
    normalizeText(payload.raw_locked_inputs.open_close_stats_raw) ??
    normalizeText(payload.raw_locked_inputs.commercial_trend_raw) ??
    '怨듦컻 ?곗씠?곗뿉???쒕졆???덉젙 ?좏샇媛 遺議깊빐 珥덇린 ?댁쁺 由ъ뒪??愿由ш? ?꾩슂?⑸땲??';

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
  if (trimmed.length >= MIN_SUMMARY_LENGTH && sentenceCount >= MIN_SUMMARY_SENTENCE_COUNT) {
    return trimmed;
  }

  const facts = buildFactLines(payload);
  const appendix =
    facts.length > 0
      ? ` 蹂댁셿 ?곗씠?? ${facts.slice(0, 5).join(' / ')}.`
      : '';
  const priority =
    ' 권장 실행: 1) 유입 시간대 분석 2) 메뉴/가격 최적화 3) 월별 손익 관리';
  return `${trimmed}${appendix}${priority}`.trim();
}

function replaceForbiddenTerms(text: string): string {
  return text
    .replace(/SGIS/gi, '인구통계')
    .replace(/에스지아이에스/gi, '인구통계')
    .replace(/실행\s*우선순위\s*:/gi, '권장 실행:');
}

function normalizeInlineText(text: string): string {
  return replaceForbiddenTerms(text).replace(/\s+/g, ' ').trim();
}

function normalizeSummaryText(text: string): string {
  const inline = normalizeInlineText(text);
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

Required JSON schema:
{
  "summary": "7-9 Korean sentences. Include at least 5 numeric facts from input. Include both risk and opportunity. Never use the term 'SGIS'. Last sentence must start with '沅뚯옣 ?ㅽ뻾:'",
  "locked_data": {
    "estimated_revenue": "single concise value in 留뚯썝 ?⑥쐞 when possible",
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
    const addressKey = buildAddressKey(normalizedPayload.address);

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

