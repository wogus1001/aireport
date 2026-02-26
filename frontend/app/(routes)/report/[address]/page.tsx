import { headers } from 'next/headers';
import ReportClient from './ReportClient';
import type {
  ExtendedInsights,
  PublicMetrics,
  RawLockedInputs,
  Region,
  ReportData,
  StoreBasicInfo,
} from '@/lib/types';

const MOCK_PUBLIC_METRICS: PublicMetrics = {
  search_trend: '검색 관심도 상승 중',
  main_target: '30대 여성 (41%)',
  competitor_count: '카페 23개',
  parking_info: '주차장 2개소',
};

const MOCK_RAW_LOCKED_INPUTS: RawLockedInputs = {
  estimated_revenue_raw: '3,200만원 / 업종 평균 2,800만원',
  commercial_trend_raw: '상권 안정 단계',
  open_close_stats_raw: '폐업 7건/개업 4건 / 가맹점 변동 데이터 없음',
  rent_price_raw: '임대 정보 없음',
};

const API_TIMEOUT_MS = 25000;

interface ReportPageProps {
  params: {
    address: string;
  };
  searchParams?: {
    address?: string | string[];
    store_id?: string | string[];
    business_type?: string | string[];
    rent?: string | string[];
    deposit?: string | string[];
    area?: string | string[];
  };
}

interface PublicDataApiResponse {
  public_metrics: PublicMetrics;
  raw_locked_inputs: RawLockedInputs;
  extended_insights?: ExtendedInsights;
  region?: Region;
}

interface NsajangStoreApiResponse {
  store_id: string;
  address: string;
  store_name?: string;
  business_type?: string;
  main_category_name?: string;
  sub_category_name?: string;
  address_detail?: string;
  rent?: string;
  deposit?: string;
  area?: string;
  floor?: string;
  monthly_avg_sales?: string;
  premium?: string;
  takeover_amount?: string;
  latitude?: string;
  longitude?: string;
  negotiable?: string;
  operation_period_months?: string;
  operation_status_label?: string;
  worker_count_label?: string;
  parking_count_label?: string;
  restroom_type_label?: string;
  phone?: string;
  description?: string;
}

function decodeAddress(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function composeRentFallback(rent: string, deposit: string, area: string): string {
  const rentText = rent.trim();
  const depositText = deposit.trim();
  const areaText = area.trim();

  if (!rentText && !depositText) {
    return '임대 정보 없음';
  }

  const chunks: string[] = [];
  if (rentText) {
    chunks.push(`월세 ${rentText}`);
  }
  if (depositText) {
    chunks.push(`보증금 ${depositText}`);
  }
  if (areaText) {
    chunks.push(`면적 ${areaText}`);
  }

  return chunks.join(' / ');
}

async function fetchPublicData(
  address: string,
  businessType: string,
  rent: string,
  deposit: string,
  area: string,
  baseUrl: string,
): Promise<PublicDataApiResponse> {
  const query = new URLSearchParams({ address });

  if (businessType.trim()) {
    query.set('business_type', businessType.trim());
  }
  if (rent.trim()) {
    query.set('rent', rent.trim());
  }
  if (deposit.trim()) {
    query.set('deposit', deposit.trim());
  }
  if (area.trim()) {
    query.set('area', area.trim());
  }

  const url = `${baseUrl}/api/public-data?${query.toString()}`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error('public-data fetch failed');
    }

    const payload = (await response.json()) as Partial<PublicDataApiResponse>;
    if (!payload.public_metrics || !payload.raw_locked_inputs) {
      throw new Error('invalid public-data payload');
    }

    return {
      public_metrics: payload.public_metrics,
      raw_locked_inputs: payload.raw_locked_inputs,
      extended_insights: payload.extended_insights,
      region: payload.region,
    };
  } catch {
    return {
      public_metrics: MOCK_PUBLIC_METRICS,
      raw_locked_inputs: {
        ...MOCK_RAW_LOCKED_INPUTS,
        rent_price_raw: composeRentFallback(rent, deposit, area),
      },
    };
  }
}

async function fetchStoreBasicInfo(
  storeId: string,
  baseUrl: string,
): Promise<StoreBasicInfo | undefined> {
  const normalizedStoreId = storeId.trim();
  if (!/^\d+$/.test(normalizedStoreId)) {
    return undefined;
  }

  try {
    const response = await fetch(`${baseUrl}/api/nsajang/store/${encodeURIComponent(normalizedStoreId)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as Partial<NsajangStoreApiResponse>;
    if (!payload.store_id) {
      return undefined;
    }

    return {
      source: 'nsajang',
      store_id: payload.store_id,
      store_name: payload.store_name,
      business_type: payload.business_type,
      main_category_name: payload.main_category_name,
      sub_category_name: payload.sub_category_name,
      address_detail: payload.address_detail,
      rent: payload.rent,
      deposit: payload.deposit,
      area: payload.area,
      floor: payload.floor,
      monthly_avg_sales: payload.monthly_avg_sales,
      premium: payload.premium,
      takeover_amount: payload.takeover_amount,
      latitude: payload.latitude,
      longitude: payload.longitude,
      negotiable: payload.negotiable,
      operation_period_months: payload.operation_period_months,
      operation_status_label: payload.operation_status_label,
      worker_count_label: payload.worker_count_label,
      parking_count_label: payload.parking_count_label,
      restroom_type_label: payload.restroom_type_label,
      phone: payload.phone,
      description: payload.description,
    };
  } catch {
    return undefined;
  }
}

function resolveBaseUrl(): string {
  const fallbackBaseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const headerStore = headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');

  if (!host) {
    return fallbackBaseUrl;
  }

  const forwardedProto = headerStore.get('x-forwarded-proto');
  const protocol =
    forwardedProto ?? (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  return `${protocol}://${host}`;
}

export default async function ReportPage({ params, searchParams }: ReportPageProps) {
  const pathAddress = decodeAddress(params.address);
  const queryAddress = firstParam(searchParams?.address).trim();
  const address = queryAddress || pathAddress;
  const storeId = firstParam(searchParams?.store_id).trim();

  const businessType = firstParam(searchParams?.business_type).trim() || '음식점';
  const rent = firstParam(searchParams?.rent);
  const deposit = firstParam(searchParams?.deposit);
  const area = firstParam(searchParams?.area);
  const baseUrl = resolveBaseUrl();

  const [publicData, storeBasicInfo] = await Promise.all([
    fetchPublicData(
      address,
      businessType,
      rent,
      deposit,
      area,
      baseUrl,
    ),
    fetchStoreBasicInfo(storeId, baseUrl),
  ]);
  const { public_metrics, raw_locked_inputs, extended_insights, region } = publicData;

  const reportData: ReportData = {
    summary: '',
    public_metrics,
    locked_data: {
      estimated_revenue: '',
      risk_alert: '',
      top_3_strategies: [],
    },
    raw_locked_inputs,
    extended_insights,
    store_basic_info: storeBasicInfo,
  };

  return <ReportClient address={address} reportData={reportData} region={region} />;
}
