import { NextResponse } from 'next/server';

interface NsajangSaleFranchise {
  saleFranchiseId?: string | number;
  franchiseName?: string;
  placeName?: string;
  address?: string;
  detailAddress?: string;
  mainCategoryName?: string;
  subCategoryName?: string;
  monthlyRent?: string | number;
  deposit?: string | number;
  exclusiveArea?: string | number;
  floor?: string | number;
  monthlyAvgSales?: string | number;
  premium?: string | number;
  takeoverAmount?: string | number;
  latitude?: string | number;
  longitude?: string | number;
  negotiable?: boolean;
  operationPeriod?: string | number;
  phone?: string;
  description?: string;
  operationStatus?: {
    label?: string;
  };
  workerCnt?: {
    label?: string;
  };
  parkingCnt?: {
    label?: string;
  };
  restroomType?: {
    label?: string;
  };
}

interface NsajangResponseEnvelope {
  result?: boolean;
  response?: {
    saleFranchise?: NsajangSaleFranchise;
  };
}

interface StoreResolveResponse {
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

const NSAJANG_API_BASE_URL = 'https://nsajang.com';
const REQUEST_TIMEOUT_MS = 15000;

function readString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

function readNumberLike(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

function readLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const label = (value as { label?: unknown }).label;
  return typeof label === 'string' && label.trim() ? label.trim() : null;
}

function toStoreResolveResponse(payload: unknown, storeId: string): StoreResolveResponse | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const typed = payload as NsajangResponseEnvelope;
  const sale = typed.response?.saleFranchise;
  if (!sale) {
    return null;
  }

  const address = readString(sale.address);
  if (!address) {
    return null;
  }

  const businessType = readString(sale.subCategoryName) ?? readString(sale.mainCategoryName) ?? undefined;
  const storeName = readString(sale.franchiseName) ?? readString(sale.placeName) ?? undefined;
  const mainCategoryName = readString(sale.mainCategoryName) ?? undefined;
  const subCategoryName = readString(sale.subCategoryName) ?? undefined;
  const addressDetail = readString(sale.detailAddress) ?? undefined;
  const rent = readNumberLike(sale.monthlyRent) ?? undefined;
  const deposit = readNumberLike(sale.deposit) ?? undefined;
  const area = readNumberLike(sale.exclusiveArea) ?? undefined;
  const floor = readNumberLike(sale.floor) ?? undefined;
  const monthlyAvgSales = readNumberLike(sale.monthlyAvgSales) ?? undefined;
  const premium = readNumberLike(sale.premium) ?? undefined;
  const takeoverAmount = readNumberLike(sale.takeoverAmount) ?? undefined;
  const latitude = readNumberLike(sale.latitude) ?? undefined;
  const longitude = readNumberLike(sale.longitude) ?? undefined;
  const operationPeriodMonths = readNumberLike(sale.operationPeriod) ?? undefined;
  const operationStatusLabel = readLabel(sale.operationStatus) ?? undefined;
  const workerCountLabel = readLabel(sale.workerCnt) ?? undefined;
  const parkingCountLabel = readLabel(sale.parkingCnt) ?? undefined;
  const restroomTypeLabel = readLabel(sale.restroomType) ?? undefined;
  const phone = readString(sale.phone) ?? undefined;
  const description = readString(sale.description) ?? undefined;
  const negotiable =
    typeof sale.negotiable === 'boolean'
      ? sale.negotiable
        ? '협의 가능'
        : '협의 불가'
      : undefined;

  return {
    store_id: storeId,
    address,
    store_name: storeName,
    business_type: businessType,
    main_category_name: mainCategoryName,
    sub_category_name: subCategoryName,
    address_detail: addressDetail,
    rent,
    deposit,
    area,
    floor,
    monthly_avg_sales: monthlyAvgSales,
    premium,
    takeover_amount: takeoverAmount,
    latitude,
    longitude,
    negotiable,
    operation_period_months: operationPeriodMonths,
    operation_status_label: operationStatusLabel,
    worker_count_label: workerCountLabel,
    parking_count_label: parkingCountLabel,
    restroom_type_label: restroomTypeLabel,
    phone,
    description,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const storeId = params.id?.trim() ?? '';
  if (!/^\d+$/.test(storeId)) {
    return NextResponse.json(
      { message: '유효한 nsajang 매물 ID가 필요합니다.' },
      { status: 400 },
    );
  }

  const upstreamUrl = `${NSAJANG_API_BASE_URL}/api/search/store/${storeId}`;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { message: 'nsajang 매물 조회에 실패했습니다.' },
        { status: 502 },
      );
    }

    const payload = (await upstreamResponse.json()) as unknown;
    const resolved = toStoreResolveResponse(payload, storeId);
    if (!resolved) {
      return NextResponse.json(
        { message: '매물 데이터 형식이 올바르지 않습니다.' },
        { status: 502 },
      );
    }

    return NextResponse.json(resolved, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: 'nsajang 매물 조회 중 오류가 발생했습니다.' },
      { status: 502 },
    );
  }
}
