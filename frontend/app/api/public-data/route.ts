import { NextResponse } from 'next/server';
import {
  fetchCommercialTrend,
  fetchCompetitorCount,
  fetchDemographics,
  fetchEstimatedRevenue,
  fetchFranchiseChanges,
  fetchFranchiseRevenue,
  fetchKakaoAccessibilityScore,
  fetchNaverTrendSeries,
  fetchOpenCloseStats,
  fetchParkingInfo,
  fetchRegionalTrendTimeline,
  fetchSearchTrend,
  fetchSdscCategoryBreakdown,
  fetchSgisAgeDistribution,
  fetchSgisIndustryTop,
  geocode,
  publicApiFallbacks,
  detectRegion,
  SgisTokenExpiredError,
} from '@/lib/public-apis';
import type { ExtendedInsights, PublicMetrics, RawLockedInputs, Region } from '@/lib/types';

interface PublicDataResponse {
  public_metrics: PublicMetrics;
  raw_locked_inputs: RawLockedInputs;
  extended_insights: ExtendedInsights;
  region: Region;
}

interface SgisAuthResponse {
  result?: {
    accessToken?: string;
    accessTimeout?: string | number;
  };
  accessToken?: string;
  accessTimeout?: string | number;
}

interface CachedSgisToken {
  token: string;
  expiresAt: number;
}

const SGIS_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;
const SGIS_TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000;

let sgisTokenCache: CachedSgisToken | null = null;

function settledOrMissing(result: PromiseSettledResult<string | null>): string | null {
  if (result.status === 'fulfilled' && result.value !== null && result.value.trim().length > 0) {
    return result.value;
  }
  return null;
}

const MISSING = '데이터 없음';

function composeRentPriceRaw(rent: string, deposit: string, area: string): string {
  const rentText = rent.trim();
  const depositText = deposit.trim();
  const areaText = area.trim();

  if (!rentText && !depositText) {
    return publicApiFallbacks.rent_price_raw;
  }

  const parts: string[] = [];
  if (rentText) {
    parts.push(`월세 ${rentText}`);
  }
  if (depositText) {
    parts.push(`보증금 ${depositText}`);
  }
  if (areaText) {
    parts.push(`면적 ${areaText}`);
  }

  return parts.join(' / ');
}

function buildEmptyResponse(rent: string, deposit: string, area: string): PublicDataResponse {
  return {
    public_metrics: {
      search_trend: MISSING,
      main_target: MISSING,
      competitor_count: MISSING,
      parking_info: MISSING,
    },
    raw_locked_inputs: {
      estimated_revenue_raw: MISSING,
      commercial_trend_raw: MISSING,
      open_close_stats_raw: MISSING,
      rent_price_raw: composeRentPriceRaw(rent, deposit, area),
    },
    extended_insights: {
      sgis_age_distribution: MISSING,
      sgis_industry_top: MISSING,
      regional_trend_timeline: MISSING,
      sdsc_category_breakdown: MISSING,
      naver_trend_series: MISSING,
      kakao_accessibility_score: MISSING,
    },
    region: 'other',
  };
}

async function fetchSgisAccessToken(): Promise<string | null> {
  if (
    sgisTokenCache &&
    sgisTokenCache.expiresAt - Date.now() > SGIS_TOKEN_REFRESH_MARGIN_MS
  ) {
    return sgisTokenCache.token;
  }

  return requestSgisAccessToken(false);
}

async function refreshSgisAccessToken(): Promise<string | null> {
  return requestSgisAccessToken(true);
}

async function requestSgisAccessToken(forceRefresh: boolean): Promise<string | null> {
  if (
    !forceRefresh &&
    sgisTokenCache &&
    sgisTokenCache.expiresAt - Date.now() > SGIS_TOKEN_REFRESH_MARGIN_MS
  ) {
    return sgisTokenCache.token;
  }

  const consumerKey = process.env.SGIS_CONSUMER_KEY;
  const consumerSecret = process.env.SGIS_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    sgisTokenCache = null;
    return null;
  }

  const url = `https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json?consumer_key=${encodeURIComponent(consumerKey)}&consumer_secret=${encodeURIComponent(consumerSecret)}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      if (forceRefresh) {
        sgisTokenCache = null;
      }
      return null;
    }

    const payload = (await response.json()) as SgisAuthResponse;
    const nextToken = payload.result?.accessToken ?? payload.accessToken ?? null;
    if (!nextToken) {
      if (forceRefresh) {
        sgisTokenCache = null;
      }
      return null;
    }

    const timeoutRaw = payload.result?.accessTimeout ?? payload.accessTimeout;
    const timeoutNumeric =
      typeof timeoutRaw === 'number'
        ? timeoutRaw
        : typeof timeoutRaw === 'string'
          ? Number(timeoutRaw)
          : Number.NaN;

    const expiresAt =
      Number.isFinite(timeoutNumeric) && timeoutNumeric > Date.now()
        ? timeoutNumeric
        : Date.now() + SGIS_TOKEN_TTL_MS;

    sgisTokenCache = {
      token: nextToken,
      expiresAt,
    };

    return nextToken;
  } catch {
    if (forceRefresh) {
      sgisTokenCache = null;
    }
    return null;
  }
}

function isTokenExpiredRejection(result: PromiseSettledResult<string | null>): boolean {
  return result.status === 'rejected' && result.reason instanceof SgisTokenExpiredError;
}

async function runWithSgisTokenRetry<T>(
  callback: (token: string) => Promise<T>,
): Promise<T | null> {
  const token = await fetchSgisAccessToken();
  if (!token) {
    return null;
  }

  try {
    return await callback(token);
  } catch (error) {
    if (!(error instanceof SgisTokenExpiredError)) {
      throw error;
    }

    const refreshedToken = await refreshSgisAccessToken();
    if (!refreshedToken) {
      return null;
    }

    return callback(refreshedToken);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address')?.trim() ?? '';
    const businessType = searchParams.get('business_type')?.trim() || '음식점';
    const rent = searchParams.get('rent')?.trim() ?? '';
    const deposit = searchParams.get('deposit')?.trim() ?? '';
    const area = searchParams.get('area')?.trim() ?? '';

    if (!address) {
      return NextResponse.json(buildEmptyResponse(rent, deposit, area), { status: 200 });
    }

    const resolvedSearchTrend = await fetchSearchTrend(businessType).catch(
      () => null,
    );

    const sgisResult = await runWithSgisTokenRetry(async (token) => {
      const location = await geocode(address, token);
      if (!location) {
        return null;
      }

      const results = await Promise.allSettled([
        fetchDemographics(location.adm_cd, token),
        fetchCompetitorCount(location.adm_cd, token, location.lat, location.lng, businessType),
        fetchParkingInfo(location.lat, location.lng),
        fetchEstimatedRevenue(location.adm_cd, businessType, address),
        fetchCommercialTrend(location.adm_cd, businessType, address),
        fetchFranchiseRevenue(location.adm_cd, businessType),
        fetchOpenCloseStats(location.lat, location.lng, address, businessType),
        fetchFranchiseChanges(location.adm_cd, businessType, address),
        fetchSgisAgeDistribution(location.adm_cd, token),
        fetchSgisIndustryTop(location.adm_cd, token),
        fetchRegionalTrendTimeline(location.adm_cd, businessType, address),
        fetchSdscCategoryBreakdown(location.lat, location.lng),
        fetchNaverTrendSeries(businessType),
        fetchKakaoAccessibilityScore(location.lat, location.lng),
      ]);

      if (results.some(isTokenExpiredRejection)) {
        throw new SgisTokenExpiredError();
      }

      return {
        location,
        results,
      };
    });

    if (!sgisResult) {
      const partial = buildEmptyResponse(rent, deposit, area);
      partial.public_metrics.search_trend = resolvedSearchTrend ?? MISSING;
      return NextResponse.json(partial, { status: 200 });
    }

    const { location, results } = sgisResult;

    const region = detectRegion(location.adm_cd, address);
    const response: PublicDataResponse = {
      region,
      public_metrics: {
        search_trend: resolvedSearchTrend ?? MISSING,
        main_target: settledOrMissing(results[0]) ?? MISSING,
        competitor_count: settledOrMissing(results[1]) ?? MISSING,
        parking_info: settledOrMissing(results[2]) ?? MISSING,
      },
      raw_locked_inputs: {
        estimated_revenue_raw:
          [settledOrMissing(results[3]), settledOrMissing(results[5])].filter(Boolean).join(' / ') || MISSING,
        commercial_trend_raw: settledOrMissing(results[4]) ?? MISSING,
        open_close_stats_raw:
          [settledOrMissing(results[6]), settledOrMissing(results[7])].filter(Boolean).join(' / ') || MISSING,
        rent_price_raw: composeRentPriceRaw(rent, deposit, area),
      },
      extended_insights: {
        sgis_age_distribution: settledOrMissing(results[8]) ?? MISSING,
        sgis_industry_top: settledOrMissing(results[9]) ?? MISSING,
        regional_trend_timeline: settledOrMissing(results[10]) ?? MISSING,
        sdsc_category_breakdown: settledOrMissing(results[11]) ?? MISSING,
        naver_trend_series: settledOrMissing(results[12]) ?? MISSING,
        kakao_accessibility_score: settledOrMissing(results[13]) ?? MISSING,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    const { searchParams } = new URL(request.url);
    const rent = searchParams.get('rent')?.trim() ?? '';
    const deposit = searchParams.get('deposit')?.trim() ?? '';
    const area = searchParams.get('area')?.trim() ?? '';
    return NextResponse.json(buildEmptyResponse(rent, deposit, area), { status: 200 });
  }
}
