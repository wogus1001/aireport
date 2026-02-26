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
  detectRegion,
} from '@/lib/public-apis';
import type { Region } from '@/lib/types';

interface FunctionResult {
  value: string | null;
  status: 'ok' | 'null' | 'error';
  error?: string;
}

interface DebugResponse {
  address: string;
  geocode: {
    adm_cd: string;
    lat: number;
    lng: number;
  } | null;
  region: Region | null;
  sgis_token: 'ok' | 'null';
  functions: Record<string, FunctionResult>;
}

interface SgisAuthResponse {
  result?: {
    accessToken?: string;
    accessTimeout?: string | number;
  };
  accessToken?: string;
  accessTimeout?: string | number;
}

async function issueDebugSgisToken(): Promise<string | null> {
  const consumerKey = process.env.SGIS_CONSUMER_KEY;
  const consumerSecret = process.env.SGIS_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    return null;
  }

  const url = `https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json?consumer_key=${encodeURIComponent(consumerKey)}&consumer_secret=${encodeURIComponent(consumerSecret)}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as SgisAuthResponse;
    return payload.result?.accessToken ?? payload.accessToken ?? null;
  } catch {
    return null;
  }
}

function toResult(settled: PromiseSettledResult<string | null>): FunctionResult {
  if (settled.status === 'rejected') {
    return {
      value: null,
      status: 'error',
      error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
    };
  }
  const val = settled.value;
  if (val === null || val.trim().length === 0) {
    return { value: null, status: 'null' };
  }
  return { value: val, status: 'ok' };
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address')?.trim() ?? '';
  const businessType = searchParams.get('business_type')?.trim() || '음식점';

  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 });
  }

  // 1. SGIS 토큰 발급 (캐시 없는 일회성 진단용)
  const sgisToken = await issueDebugSgisToken();

  if (!sgisToken) {
    const response: DebugResponse = {
      address,
      geocode: null,
      region: null,
      sgis_token: 'null',
      functions: {},
    };
    return NextResponse.json(response, { status: 200 });
  }

  // 2. Geocode
  const location = await geocode(address, sgisToken).catch(() => null);

  if (!location) {
    const response: DebugResponse = {
      address,
      geocode: null,
      region: null,
      sgis_token: 'ok',
      functions: {},
    };
    return NextResponse.json(response, { status: 200 });
  }

  const region = detectRegion(location.adm_cd, address);

  // 3. 각 함수 개별 실행
  const [
    searchTrendResult,
    demographicsResult,
    competitorCountResult,
    parkingInfoResult,
    estimatedRevenueResult,
    commercialTrendResult,
    openCloseStatsResult,
    franchiseRevenueResult,
    franchiseChangesResult,
    sgisAgeDistributionResult,
    sgisIndustryTopResult,
    regionalTrendTimelineResult,
    sdscCategoryBreakdownResult,
    naverTrendSeriesResult,
    kakaoAccessibilityScoreResult,
  ] = await Promise.allSettled([
    fetchSearchTrend(businessType),
    fetchDemographics(location.adm_cd, sgisToken),
    fetchCompetitorCount(location.adm_cd, sgisToken, location.lat, location.lng, businessType),
    fetchParkingInfo(location.lat, location.lng),
    fetchEstimatedRevenue(location.adm_cd, businessType, address),
    fetchCommercialTrend(location.adm_cd, businessType, address),
    fetchOpenCloseStats(location.lat, location.lng, address, businessType),
    fetchFranchiseRevenue(location.adm_cd, businessType),
    fetchFranchiseChanges(location.adm_cd, businessType, address),
    fetchSgisAgeDistribution(location.adm_cd, sgisToken),
    fetchSgisIndustryTop(location.adm_cd, sgisToken),
    fetchRegionalTrendTimeline(location.adm_cd, businessType, address),
    fetchSdscCategoryBreakdown(location.lat, location.lng),
    fetchNaverTrendSeries(businessType),
    fetchKakaoAccessibilityScore(location.lat, location.lng),
  ]);

  const response: DebugResponse = {
    address,
    geocode: {
      adm_cd: location.adm_cd,
      lat: location.lat,
      lng: location.lng,
    },
    region,
    sgis_token: 'ok',
    functions: {
      search_trend: toResult(searchTrendResult),
      demographics: toResult(demographicsResult),
      competitor_count: toResult(competitorCountResult),
      parking_info: toResult(parkingInfoResult),
      estimated_revenue: toResult(estimatedRevenueResult),
      commercial_trend: toResult(commercialTrendResult),
      open_close_stats: toResult(openCloseStatsResult),
      franchise_revenue: toResult(franchiseRevenueResult),
      franchise_changes: toResult(franchiseChangesResult),
      sgis_age_distribution: toResult(sgisAgeDistributionResult),
      sgis_industry_top: toResult(sgisIndustryTopResult),
      regional_trend_timeline: toResult(regionalTrendTimelineResult),
      sdsc_category_breakdown: toResult(sdscCategoryBreakdownResult),
      naver_trend_series: toResult(naverTrendSeriesResult),
      kakao_accessibility_score: toResult(kakaoAccessibilityScoreResult),
    },
  };

  return NextResponse.json(response, { status: 200 });
}
