
import type { Region } from '@/lib/types';

export interface GeocodeResult { lat: number; lng: number; adm_cd: string }

interface SgisEnvelope {
  errCd?: number | string;
  result?: Array<Record<string, unknown>> | { resultdata?: Array<Record<string, unknown>> };
}
interface KakaoAddressResponse { documents?: Array<{ x?: string; y?: string }> }
interface KakaoCategoryResponse { meta?: { total_count?: number }; documents?: Array<{ x?: string; y?: string }> }
interface NaverTrendResponse { results?: Array<{ data?: Array<{ ratio?: number }> }> }
interface GyeonggiRow {
  STD_YY?: string | number;
  QU_NM?: string | number;
  BIZDIST_NM?: string;
  CLASS_CD_NM?: string;
  AMT?: string | number;
  NOC?: string | number;
}
interface GyeonggiResponse { TBGGESTDEVALLSTM?: Array<{ row?: GyeonggiRow[] }> }
interface Rule { label: string; keywords: string[]; sgis: string[]; kakao: string[] }

const RULES: Rule[] = [
  { label: '카페', keywords: ['카페', '커피', '디저트', '베이커리', '브런치카페'], sgis: ['카페', '커피', '제과', '빵', '디저트'], kakao: ['CE7', 'FD6'] },
  { label: '한식', keywords: ['한식', '국밥', '백반', '고깃집', '갈비', '삼겹살'], sgis: ['한식', '백반', '고기', '갈비'], kakao: ['FD6'] },
  { label: '중식', keywords: ['중식', '중국집', '짜장', '짬뽕', '마라'], sgis: ['중식', '중국'], kakao: ['FD6'] },
  { label: '일식', keywords: ['일식', '초밥', '스시', '돈카츠', '라멘', '우동'], sgis: ['일식', '스시', '초밥', '돈까스'], kakao: ['FD6'] },
  { label: '양식', keywords: ['양식', '서양식', '레스토랑', '파스타', '스테이크', '피자', '브런치'], sgis: ['양식', '레스토랑', '파스타', '스테이크', '피자'], kakao: ['FD6'] },
  { label: '분식', keywords: ['분식', '떡볶이', '김밥', '순대', '튀김'], sgis: ['분식', '떡볶이', '김밥'], kakao: ['FD6'] },
  { label: '치킨/패스트푸드', keywords: ['치킨', '햄버거', '패스트푸드', '샌드위치'], sgis: ['치킨', '패스트', '햄버거'], kakao: ['FD6'] },
  { label: '주점', keywords: ['술집', '주점', '호프', '이자카야', '와인바', '포차'], sgis: ['주점', '호프', '이자카야', '와인'], kakao: ['FD6'] },
  { label: '교육', keywords: ['교육', '학원', '교습', '공부방', '과외', '요가', '필라테스', '스튜디오', '레슨', '독서실'], sgis: ['교육', '학원', '교습', '요가', '필라테스', '스튜디오', '레슨'], kakao: ['AC5', 'PS3', 'SC4', 'CT1'] },
  { label: '의료', keywords: ['병원', '의원', '치과', '한의원', '약국', '클리닉', '피부과', '정형외과'], sgis: ['병원', '의원', '치과', '약국', '클리닉', '의료'], kakao: ['HP8', 'PM9'] },
  { label: '뷰티', keywords: ['미용실', '네일', '왁싱', '피부관리', '마사지', '뷰티'], sgis: ['미용', '네일', '피부', '뷰티'], kakao: [] },
  { label: '유통', keywords: ['편의점', '마트', '슈퍼', '소매', '잡화', '리테일', '생활용품'], sgis: ['편의점', '마트', '슈퍼', '소매', '잡화', '유통'], kakao: ['CS2', 'MT1'] },
  { label: '부동산', keywords: ['부동산', '중개', '공인중개', '중개업'], sgis: ['부동산', '중개'], kakao: ['AG2'] },
  { label: '숙박', keywords: ['숙박', '호텔', '모텔', '게스트하우스', '펜션'], sgis: ['숙박', '호텔', '모텔'], kakao: ['AD5'] },
  { label: '음식점', keywords: ['음식', '식당', '외식', '다이닝', '푸드'], sgis: ['음식', '식당', '외식', '레스토랑'], kakao: ['FD6', 'CE7'] },
];
const DEFAULT_RULE: Rule = { label: '생활업종', keywords: [], sgis: ['음식', '카페', '교육', '소매', '서비스'], kakao: ['FD6', 'CE7', 'AC5', 'CS2', 'CT1'] };

const TMO = 6500;
const MIN_REVENUE_SAMPLE = 20;
const SEOUL_REVENUE_MAX_ROWS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const SHORT_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const seoulCache = new Map<string, CacheEntry<Promise<Array<Record<string, unknown>> | null>>>();
const ggCache = new Map<string, CacheEntry<Promise<GyeonggiRow[] | null>>>();
const timelineCache = new Map<string, CacheEntry<string | null>>();
const sdscCache = new Map<string, CacheEntry<string | null>>();
const trendCache = new Map<string, CacheEntry<string | null>>();
const accessCache = new Map<string, CacheEntry<string | null>>();

export const publicApiFallbacks = {
  search_trend: '검색 추세 데이터 없음',
  main_target: '타겟 데이터 없음',
  competitor_count: '경쟁 데이터 없음',
  parking_info: '주차 데이터 없음',
  estimated_revenue_raw: '매출 데이터 없음',
  commercial_trend_raw: '상권 변화 데이터 없음',
  open_close_stats_raw: '개업·폐업 데이터 없음',
  rent_price_raw: '임대 정보 없음',
  franchise_revenue_raw: '가맹점 매출 데이터 없음',
  franchise_changes_raw: '가맹점 변동 데이터 없음',
};

export class SgisTokenExpiredError extends Error {
  constructor() { super('SGIS access token expired'); this.name = 'SgisTokenExpiredError'; }
}

const norm = (s: string): string => s.replace(/\s+/g, '').trim().toLowerCase();
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const n = Number(v.replace(/,/g, '').trim()); return Number.isFinite(n) ? n : null; }
  return null;
};
const read = (r: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
};
const avg = (xs: number[]): number | null => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const med = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
};
const manwon = (won: number): string => `${Math.round(won / 10000).toLocaleString('ko-KR')}만원`;
const signedPct = (p: number): string => `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;

function rulesOf(businessType: string): Rule[] {
  const b = norm(businessType);
  if (!b) return [DEFAULT_RULE];
  const m = RULES.filter((r) => r.keywords.some((k) => b.includes(norm(k))));
  return m.length ? m.slice(0, 3) : [DEFAULT_RULE];
}
function matchIndustry(industry: string, businessType: string): boolean {
  const i = norm(industry);
  const pool = Array.from(new Set(rulesOf(businessType).flatMap((r) => [...r.keywords, ...r.sgis]).map((x) => norm(x)))).filter(Boolean);
  return pool.length === 0 || pool.some((k) => i.includes(k));
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs = CACHE_TTL_MS): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function addressHints(address: string): string[] {
  const tokens = address
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const candidates: string[] = [];

  for (const token of tokens) {
    const cleaned = token.replace(/[(),]/g, '');
    if (!cleaned) continue;
    if (/(구|군|시|동|읍|면|가)$/.test(cleaned) || /(대로|로|길|번길)/.test(cleaned)) {
      candidates.push(cleaned);
    }
  }

  candidates.push(...tokens.slice(0, 2));
  return Array.from(new Set(candidates.map((item) => item.trim()).filter((item) => item.length > 1)));
}

const LOCATION_KEYS = ['TRDAR_CD_NM', 'BIZDIST_NM', 'ADSTRD_CD_NM', 'SIGNGU_CD_NM', 'MAIN_ZBIZ_NM', 'MAIN_SBIZ_NM'];

function locationTextFromRow(row: Record<string, unknown>): string {
  const keyValues = LOCATION_KEYS
    .map((key) => row[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (keyValues.length > 0) {
    return keyValues.join(' ');
  }

  // Fallback only when explicit location fields are unavailable.
  return Object.values(row)
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

function filterRowsByAddress<T extends object>(rows: T[], address: string): T[] {
  const hints = addressHints(address).map((item) => norm(item)).filter((item) => item.length > 1);
  if (hints.length === 0) return rows;

  const matched = rows.filter((row) => {
    const blob = norm(locationTextFromRow(row as Record<string, unknown>));
    return hints.some((hint) => blob.includes(hint));
  });

  return matched.length > 0 ? matched : rows;
}

interface RevenueCandidate<T> {
  scope: string;
  rows: T[];
}

interface RevenueSelection {
  scope: string;
  quarter: string;
  values: number[];
}

function selectRevenueCandidate<T>(
  candidates: Array<RevenueCandidate<T>>,
  getQuarter: (row: T) => string | null,
  getAmount: (row: T) => number | null,
): RevenueSelection | null {
  const allQuarterKeys = candidates
    .flatMap((candidate) => candidate.rows.map(getQuarter))
    .filter((quarter): quarter is string => Boolean(quarter));
  const globalLatest = latestQ(allQuarterKeys);

  let globalBest: RevenueSelection | null = null;
  if (globalLatest) {
    for (const candidate of candidates) {
      const values = candidate.rows
        .filter((row) => getQuarter(row) === globalLatest)
        .map(getAmount)
        .filter((value): value is number => value !== null && value > 0);
      if (values.length === 0) continue;
      if (values.length >= MIN_REVENUE_SAMPLE) {
        return { scope: candidate.scope, quarter: globalLatest, values };
      }
      if (!globalBest || values.length > globalBest.values.length) {
        globalBest = { scope: candidate.scope, quarter: globalLatest, values };
      }
    }
    if (globalBest) return globalBest;
  }

  let fallbackBest: RevenueSelection | null = null;
  for (const candidate of candidates) {
    const latest = latestQ(
      candidate.rows.map(getQuarter).filter((quarter): quarter is string => Boolean(quarter)),
    );
    if (!latest) continue;

    const values = candidate.rows
      .filter((row) => getQuarter(row) === latest)
      .map(getAmount)
      .filter((value): value is number => value !== null && value > 0);
    if (values.length === 0) continue;

    if (!fallbackBest) {
      fallbackBest = { scope: candidate.scope, quarter: latest, values };
      continue;
    }

    const quarterOrder = qOrder(latest);
    const bestQuarterOrder = qOrder(fallbackBest.quarter);
    if (
      quarterOrder > bestQuarterOrder ||
      (quarterOrder === bestQuarterOrder && values.length > fallbackBest.values.length)
    ) {
      fallbackBest = { scope: candidate.scope, quarter: latest, values };
    }
  }

  return fallbackBest;
}

interface QuarterSeriesSelection {
  scope: string;
  series: Map<string, number[]>;
  latestQuarter: string;
}

function buildQuarterSeries<T>(
  rows: T[],
  getQuarter: (row: T) => string | null,
  getAmount: (row: T) => number | null,
): Map<string, number[]> {
  const series = new Map<string, number[]>();
  for (const row of rows) {
    const quarter = getQuarter(row);
    const amount = getAmount(row);
    if (!quarter || amount === null || amount <= 0) continue;
    const bucket = series.get(quarter) ?? [];
    series.set(quarter, bucket);
    bucket.push(amount);
  }
  return series;
}

function selectQuarterSeriesCandidate<T>(
  candidates: Array<RevenueCandidate<T>>,
  getQuarter: (row: T) => string | null,
  getAmount: (row: T) => number | null,
): QuarterSeriesSelection | null {
  const allQuarterKeys = candidates
    .flatMap((candidate) => candidate.rows.map(getQuarter))
    .filter((quarter): quarter is string => Boolean(quarter));
  const globalLatest = latestQ(allQuarterKeys);

  let bestOnLatest: QuarterSeriesSelection | null = null;
  if (globalLatest) {
    for (const candidate of candidates) {
      const series = buildQuarterSeries(candidate.rows, getQuarter, getAmount);
      const values = series.get(globalLatest) ?? [];
      if (values.length === 0) continue;
      if (values.length >= MIN_REVENUE_SAMPLE) {
        return { scope: candidate.scope, series, latestQuarter: globalLatest };
      }
      if (!bestOnLatest || values.length > (bestOnLatest.series.get(globalLatest)?.length ?? 0)) {
        bestOnLatest = { scope: candidate.scope, series, latestQuarter: globalLatest };
      }
    }
    if (bestOnLatest) return bestOnLatest;
  }

  let fallbackBest: QuarterSeriesSelection | null = null;
  for (const candidate of candidates) {
    const series = buildQuarterSeries(candidate.rows, getQuarter, getAmount);
    const quarter = latestQ(Array.from(series.keys()));
    if (!quarter) continue;
    if (!fallbackBest) {
      fallbackBest = { scope: candidate.scope, series, latestQuarter: quarter };
      continue;
    }
    const currOrder = qOrder(quarter);
    const bestOrder = qOrder(fallbackBest.latestQuarter);
    if (
      currOrder > bestOrder ||
      (currOrder === bestOrder &&
        (series.get(quarter)?.length ?? 0) >
          (fallbackBest.series.get(fallbackBest.latestQuarter)?.length ?? 0))
    ) {
      fallbackBest = { scope: candidate.scope, series, latestQuarter: quarter };
    }
  }

  return fallbackBest;
}

async function jfetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TMO);
  try {
    const res = await fetch(url, { ...init, cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; } finally { clearTimeout(t); }
}

function pickRows(payload: SgisEnvelope | null): Array<Record<string, unknown>> {
  if (!payload?.result) return [];
  if (Array.isArray(payload.result)) return payload.result;
  if (Array.isArray(payload.result.resultdata)) return payload.result.resultdata;
  return [];
}
function assertSgis(payload: SgisEnvelope | null): void {
  if (payload?.errCd === -401 || payload?.errCd === '-401') throw new SgisTokenExpiredError();
}
function parseQ(code: string | null): string | null {
  if (!code) return null;
  const m = code.match(/^(\d{4})([1-4])$/);
  return m ? `${m[1]}Q${m[2]}` : null;
}
function qOrder(key: string): number {
  const m = key.match(/^(\d{4})Q([1-4])$/);
  return m ? Number(m[1]) * 10 + Number(m[2]) : Number.NEGATIVE_INFINITY;
}
function qLabel(key: string): string {
  const m = key.match(/^(\d{4})Q([1-4])$/);
  return m ? `${m[1]}년 ${m[2]}분기` : key;
}
function latestQ(keys: string[]): string | null {
  if (!keys.length) return null;
  return [...keys].sort((a, b) => qOrder(b) - qOrder(a))[0] ?? null;
}
function prevQ(keys: string[], latest: string): string | null {
  const s = [...keys].sort((a, b) => qOrder(b) - qOrder(a));
  const i = s.indexOf(latest);
  return i >= 0 && i + 1 < s.length ? s[i + 1] ?? null : null;
}

async function kakaoCount(lat: number, lng: number, code: string): Promise<number | null> {
  const key = process.env.KAKAO_REST_API_KEY ?? process.env.KAKAO_LOCAL_API_KEY;
  if (!key) return null;
  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${encodeURIComponent(code)}&x=${lng}&y=${lat}&radius=500&sort=distance&size=15&page=1`;
  const data = await jfetch<KakaoCategoryResponse>(url, { headers: { Authorization: `KakaoAK ${key}` } });
  if (typeof data?.meta?.total_count === 'number') return data.meta.total_count;
  return Array.isArray(data?.documents) ? data.documents.length : null;
}
async function seoulRows(dataset: string, maxRows: number): Promise<Array<Record<string, unknown>> | null> {
  const ck = `${dataset}:${maxRows}`;
  const cached = getCached(seoulCache, ck);
  if (cached) return cached;
  const key = process.env.SEOUL_API_KEY?.trim();
  if (!key) return null;
  const promise = (async () => {
    const rows: Array<Record<string, unknown>> = [];
    const page = 250;
    for (let start = 1; start <= maxRows; start += page) {
      const end = Math.min(start + page - 1, maxRows);
      const url = `http://openapi.seoul.go.kr:8088/${key}/json/${dataset}/${start}/${end}/`;
      const payload = await jfetch<Record<string, { row?: Array<Record<string, unknown>> }>>(url);
      const chunk = payload?.[dataset]?.row;
      if (!Array.isArray(chunk) || !chunk.length) break;
      rows.push(...chunk);
      if (chunk.length < page) break;
    }
    return rows.length ? rows : null;
  })();
  setCached(seoulCache, ck, promise);
  return promise;
}
async function ggRows(maxPages: number, pageSize: number): Promise<GyeonggiRow[] | null> {
  const ck = `${maxPages}:${pageSize}`;
  const cached = getCached(ggCache, ck);
  if (cached) return cached;
  const promise = (async () => {
    const out: GyeonggiRow[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const url = `https://openapi.gg.go.kr/TBGGESTDEVALLSTM?Type=json&pIndex=${page}&pSize=${pageSize}`;
      const payload = await jfetch<GyeonggiResponse>(url);
      const bundle = payload?.TBGGESTDEVALLSTM?.find((x) => Array.isArray(x.row));
      const chunk = bundle?.row ?? [];
      if (!chunk.length) break;
      out.push(...chunk);
      if (chunk.length < pageSize) break;
    }
    return out.length ? out : null;
  })();
  setCached(ggCache, ck, promise);
  return promise;
}

export async function geocode(address: string, token: string): Promise<GeocodeResult | null> {
  const key = process.env.KAKAO_REST_API_KEY ?? process.env.KAKAO_LOCAL_API_KEY;
  if (!key || !token || !address.trim()) return null;
  const kakao = await jfetch<KakaoAddressResponse>(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, { headers: { Authorization: `KakaoAK ${key}` } });
  const doc = kakao?.documents?.[0];
  const lng = toNum(doc?.x), lat = toNum(doc?.y);
  if (lng === null || lat === null) return null;
  const sgis = await jfetch<SgisEnvelope>(`https://sgisapi.kostat.go.kr/OpenAPI3/addr/rgeocodewgs84.json?accessToken=${encodeURIComponent(token)}&x_coor=${lng}&y_coor=${lat}`);
  assertSgis(sgis);
  const row = pickRows(sgis)[0] ?? {};
  const admDirect = read(row, ['adm_cd']);
  const admComposed = (() => {
    const sido = read(row, ['sido_cd']);
    const sgg = read(row, ['sgg_cd']);
    return sido && sgg ? `${sido}${sgg}` : null;
  })();
  const adm = admDirect ?? admComposed;
  return adm ? { lat, lng, adm_cd: adm } : null;
}

export async function fetchDemographics(admCd: string, token: string): Promise<string | null> {
  if (!admCd || !token) return null;
  const data = await jfetch<SgisEnvelope>(`https://sgisapi.kostat.go.kr/OpenAPI3/startupbiz/pplsummary.json?accessToken=${encodeURIComponent(token)}&adm_cd=${encodeURIComponent(admCd)}`);
  assertSgis(data);
  const row = pickRows(data)[0];
  if (!row) return null;
  const t20 = toNum(row.twenty_per), t30 = toNum(row.thirty_per);
  if (t20 === null && t30 === null) return null;
  return (t20 ?? -1) >= (t30 ?? -1) ? `20대 비중 ${(t20 ?? 0).toFixed(0)}%` : `30대 비중 ${(t30 ?? 0).toFixed(0)}%`;
}

export async function fetchCompetitorCount(admCd: string, token: string, lat: number, lng: number, businessType = ''): Promise<string | null> {
  const rules = rulesOf(businessType);
  const label = Array.from(new Set(rules.map((r) => r.label))).join('/');
  const sgisKeys = Array.from(new Set(rules.flatMap((r) => r.sgis)));
  const kakaoCodes = Array.from(new Set(rules.flatMap((r) => r.kakao)));
  const counts = await Promise.all(kakaoCodes.map(async (c) => kakaoCount(lat, lng, c)));
  const kakaoTotal = counts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  if (!admCd || !token) return kakaoTotal > 0 ? `${label} 반경 500m ${kakaoTotal}개` : null;

  const data = await jfetch<SgisEnvelope>(`https://sgisapi.kostat.go.kr/OpenAPI3/startupbiz/corpdistsummary.json?accessToken=${encodeURIComponent(token)}&adm_cd=${encodeURIComponent(admCd)}`);
  assertSgis(data);
  let best = '';
  let bestRatio = Number.NEGATIVE_INFINITY;
  for (const row of pickRows(data)) {
    const list = row.theme_list;
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      const name = read(rec, ['s_theme_cd_nm', 'theme_nm']);
      if (!name || !sgisKeys.some((k) => norm(name).includes(norm(k)))) continue;
      const ratio = toNum(rec.dist_per ?? rec.ratio);
      if (ratio !== null && ratio > bestRatio) { bestRatio = ratio; best = name; }
    }
  }
  if (best && Number.isFinite(bestRatio)) return kakaoTotal > 0 ? `${best} 밀집도 ${bestRatio.toFixed(1)}% / ${label} ${kakaoTotal}개` : `${best} 밀집도 ${bestRatio.toFixed(1)}%`;
  return kakaoTotal > 0 ? `${label} 반경 500m ${kakaoTotal}개` : null;
}

export async function fetchParkingInfo(lat: number, lng: number): Promise<string | null> {
  const c = await kakaoCount(lat, lng, 'PK6');
  return c === null ? null : `반경 500m 주차장 ${c}개`;
}

function seoulQ(row: Record<string, unknown>): string | null { return parseQ(read(row, ['STDR_YYQU_CD'])); }
function ggQ(row: GyeonggiRow): string | null {
  const y = row.STD_YY == null ? '' : String(row.STD_YY).replace(/\D/g, '').slice(0, 4);
  const q = row.QU_NM == null ? '' : String(row.QU_NM).replace(/\D/g, '').slice(0, 1);
  return y && q ? parseQ(`${y}${q}`) : null;
}

function seoulTradeIndustryKey(row: Record<string, unknown>): string | null {
  const quarter = seoulQ(row);
  const trdar = read(row, ['TRDAR_CD']);
  const svc = read(row, ['SVC_INDUTY_CD']);
  if (!quarter || !trdar || !svc) return null;
  return `${quarter}|${trdar}|${svc}`;
}

function buildSeoulStoreCountIndex(rows: Array<Record<string, unknown>>): Map<string, number> {
  const index = new Map<string, number>();
  for (const row of rows) {
    const key = seoulTradeIndustryKey(row);
    const count = toNum(row.STOR_CO);
    if (!key || count === null || count <= 0) continue;
    index.set(key, count);
  }
  return index;
}

function seoulPerStoreRevenue(
  row: Record<string, unknown>,
  storeCountIndex: Map<string, number>,
): number | null {
  const amount = toNum(row.THSMON_SELNG_AMT);
  if (amount === null || amount <= 0) return null;

  const key = seoulTradeIndustryKey(row);
  if (!key) return null;

  const storeCount = storeCountIndex.get(key);
  if (storeCount === undefined || storeCount <= 0) return null;

  return amount / storeCount;
}

export async function fetchEstimatedRevenue(admCd: string, businessType = '', address = ''): Promise<string | null> {
  const region = detectRegion(admCd, address);
  if (region === 'seoul') {
    const [salesRows, storeRows] = await Promise.all([
      seoulRows('VwsmTrdarSelngQq', SEOUL_REVENUE_MAX_ROWS),
      seoulRows('VwsmTrdarStorQq', SEOUL_REVENUE_MAX_ROWS),
    ]);
    if (!salesRows || !storeRows) return null;

    const storeCountIndex = buildSeoulStoreCountIndex(storeRows);
    if (storeCountIndex.size === 0) return null;

    const industryRows = salesRows.filter((row) =>
      matchIndustry(read(row, ['SVC_INDUTY_CD_NM']) ?? '', businessType),
    );
    const localRows = filterRowsByAddress(salesRows, address);
    const localIndustryRows = filterRowsByAddress(industryRows, address);

    const selected = selectRevenueCandidate(
      [
        { scope: '근접 상권+업종', rows: localIndustryRows },
        { scope: '서울 업종', rows: industryRows },
        { scope: '근접 상권 전체', rows: localRows },
        { scope: '서울 전체', rows: salesRows },
      ],
      (row) => seoulQ(row),
      (row) => seoulPerStoreRevenue(row, storeCountIndex),
    );

    if (!selected) return null;
    const median = med(selected.values);
    if (median === null) return null;
    return `유사 업종 월 매출 참고치 ${manwon(median)} (서울 ${qLabel(selected.quarter)}, 점포당 기준, 표본 ${selected.values.length}개, ${selected.scope})`;
  }
  if (region === 'gyeonggi') {
    const rows = await ggRows(5, 1000);
    if (!rows) return null;

    const industryRows = rows.filter((row) => matchIndustry(row.CLASS_CD_NM ?? '', businessType));
    const localRows = filterRowsByAddress(rows, address);
    const localIndustryRows = filterRowsByAddress(industryRows, address);

    const selected = selectRevenueCandidate(
      [
        { scope: '근접 상권+업종', rows: localIndustryRows },
        { scope: '경기 업종', rows: industryRows },
        { scope: '근접 상권 전체', rows: localRows },
        { scope: '경기 전체', rows },
      ],
      (row) => ggQ(row),
      (row) => toNum(row.AMT),
    );

    if (!selected) return null;
    const median = med(selected.values);
    if (median === null) return null;
    return `유사 업종 월 매출 참고치 ${manwon(median)} (경기 ${qLabel(selected.quarter)}, 표본 ${selected.values.length}개, ${selected.scope})`;
  }
  return null;
}

export async function fetchCommercialTrend(admCd: string, businessType = '', address = ''): Promise<string | null> {
  const region = detectRegion(admCd, address);
  if (region === 'seoul') {
    const [salesRows, storeRows] = await Promise.all([
      seoulRows('VwsmTrdarSelngQq', SEOUL_REVENUE_MAX_ROWS),
      seoulRows('VwsmTrdarStorQq', SEOUL_REVENUE_MAX_ROWS),
    ]);
    if (!salesRows || !storeRows) return null;

    const storeCountIndex = buildSeoulStoreCountIndex(storeRows);
    if (storeCountIndex.size === 0) return null;

    const industryRows = salesRows.filter((row) =>
      matchIndustry(read(row, ['SVC_INDUTY_CD_NM']) ?? '', businessType),
    );
    const localRows = filterRowsByAddress(salesRows, address);
    const localIndustryRows = filterRowsByAddress(industryRows, address);

    const selected = selectQuarterSeriesCandidate(
      [
        { scope: '근접 상권+업종', rows: localIndustryRows },
        { scope: '서울 업종', rows: industryRows },
        { scope: '근접 상권 전체', rows: localRows },
        { scope: '서울 전체', rows: salesRows },
      ],
      (row) => seoulQ(row),
      (row) => seoulPerStoreRevenue(row, storeCountIndex),
    );
    if (!selected) return null;

    const latest = selected.latestQuarter;
    const previous = prevQ(Array.from(selected.series.keys()), latest);
    const latestAvg = avg(selected.series.get(latest) ?? []);
    if (latestAvg === null) return null;
    if (!previous) {
      return `상권 추세 기준 ${qLabel(latest)} 점포당 평균 매출 ${manwon(latestAvg)} (전분기 비교 데이터 부족, ${selected.scope})`;
    }
    const previousAvg = avg(selected.series.get(previous) ?? []);
    if (previousAvg === null || previousAvg <= 0) {
      return `상권 추세 기준 ${qLabel(latest)} 점포당 평균 매출 ${manwon(latestAvg)} (전분기 비교 데이터 부족, ${selected.scope})`;
    }
    return `상권 추세 ${signedPct(((latestAvg - previousAvg) / previousAvg) * 100)} (${qLabel(previous)} 대비 ${qLabel(latest)}, ${selected.scope})`;
  }

  if (region === 'gyeonggi') {
    const rows = await ggRows(5, 1000);
    if (!rows) return null;

    const industryRows = rows.filter((row) => matchIndustry(row.CLASS_CD_NM ?? '', businessType));
    const localRows = filterRowsByAddress(rows, address);
    const localIndustryRows = filterRowsByAddress(industryRows, address);

    const selected = selectQuarterSeriesCandidate(
      [
        { scope: '근접 상권+업종', rows: localIndustryRows },
        { scope: '경기 업종', rows: industryRows },
        { scope: '근접 상권 전체', rows: localRows },
        { scope: '경기 전체', rows },
      ],
      (row) => ggQ(row),
      (row) => toNum(row.AMT),
    );
    if (!selected) return null;

    const latest = selected.latestQuarter;
    const previous = prevQ(Array.from(selected.series.keys()), latest);
    const latestAvg = avg(selected.series.get(latest) ?? []);
    if (latestAvg === null) return null;
    if (!previous) {
      return `상권 추세 기준 ${qLabel(latest)} 평균 매출 ${manwon(latestAvg)} (전분기 비교 데이터 부족, ${selected.scope})`;
    }
    const previousAvg = avg(selected.series.get(previous) ?? []);
    if (previousAvg === null || previousAvg <= 0) {
      return `상권 추세 기준 ${qLabel(latest)} 평균 매출 ${manwon(latestAvg)} (전분기 비교 데이터 부족, ${selected.scope})`;
    }
    return `상권 추세 ${signedPct(((latestAvg - previousAvg) / previousAvg) * 100)} (${qLabel(previous)} 대비 ${qLabel(latest)}, ${selected.scope})`;
  }

  return null;
}

export async function fetchFranchiseRevenue(admCd: string, businessType = ''): Promise<string | null> {
  const region = detectRegion(admCd, '');
  if (region === 'seoul') {
    const rows = await seoulRows('VwsmTrdarStorQq', 1200); if (!rows) return null;
    const base = rows.filter((r) => matchIndustry(read(r, ['SVC_INDUTY_CD_NM']) ?? '', businessType));
    const use = base.length ? base : rows;
    const latest = latestQ(use.map((r) => seoulQ(r)).filter((x): x is string => Boolean(x))); if (!latest) return null;
    const now = use.filter((r) => seoulQ(r) === latest);
    const total = now.map((r) => toNum(r.STOR_CO)).filter((x): x is number => x !== null && x >= 0).reduce((a, b) => a + b, 0);
    const fr = now.map((r) => toNum(r.FRC_STOR_CO)).filter((x): x is number => x !== null && x >= 0).reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    return `가맹점 비중 ${(fr / total * 100).toFixed(1)}% (가맹 ${Math.round(fr)} / 전체 ${Math.round(total)}, ${qLabel(latest)})`;
  }
  if (region === 'gyeonggi') {
    const t = await fetchEstimatedRevenue(admCd, businessType, '경기');
    return t ? `${t} / 가맹점 전용 통계는 지역 공개 데이터 미지원` : null;
  }
  return null;
}

export async function fetchOpenCloseStats(lat: number, lng: number, address = '', businessType = ''): Promise<string | null> {
  const region = detectRegion('', address);
  if (region === 'seoul') {
    const rows = await seoulRows('VwsmTrdarStorQq', 2400);
    if (!rows) return null;

    const industryRows = rows.filter((row) =>
      matchIndustry(read(row, ['SVC_INDUTY_CD_NM']) ?? '', businessType),
    );
    const localRows = filterRowsByAddress(rows, address);
    const localIndustryRows = filterRowsByAddress(industryRows, address);

    const selected = selectQuarterSeriesCandidate(
      [
        { scope: '근접 상권+업종', rows: localIndustryRows },
        { scope: '서울 업종', rows: industryRows },
        { scope: '근접 상권 전체', rows: localRows },
        { scope: '서울 전체', rows },
      ],
      (row) => seoulQ(row),
      (row) => toNum(row.STOR_CO),
    );
    if (!selected) return null;

    const latest = selected.latestQuarter;
    const rowsByScope: Record<string, Array<Record<string, unknown>>> = {
      '근접 상권+업종': localIndustryRows,
      '서울 업종': industryRows,
      '근접 상권 전체': localRows,
      '서울 전체': rows,
    };
    const sourceRows = rowsByScope[selected.scope] ?? rows;
    const now = sourceRows.filter((row) => seoulQ(row) === latest);
    const op = avg(now.map((row) => toNum(row.OPBIZ_STOR_CO)).filter((value): value is number => value !== null));
    const cl = avg(now.map((row) => toNum(row.CLSBIZ_STOR_CO)).filter((value): value is number => value !== null));
    return op === null || cl === null ? null : `개업 평균 ${op.toFixed(1)}건 / 폐업 평균 ${cl.toFixed(1)}건 (${qLabel(latest)}, ${selected.scope})`;
  }
  if (region === 'gyeonggi') {
    const rows = await ggRows(5, 1000);
    if (!rows) return null;

    const industryRows = rows.filter((row) => matchIndustry(row.CLASS_CD_NM ?? '', businessType));
    const localRows = filterRowsByAddress(rows, address);
    const localIndustryRows = filterRowsByAddress(industryRows, address);

    const selected = selectQuarterSeriesCandidate(
      [
        { scope: '근접 상권+업종', rows: localIndustryRows },
        { scope: '경기 업종', rows: industryRows },
        { scope: '근접 상권 전체', rows: localRows },
        { scope: '경기 전체', rows },
      ],
      (row) => ggQ(row),
      (row) => toNum(row.NOC),
    );
    if (!selected) return null;

    const latest = selected.latestQuarter;
    const previous = prevQ(Array.from(selected.series.keys()), latest);
    const latestAvg = avg(selected.series.get(latest) ?? []);
    if (latestAvg === null) return null;
    if (!previous) return `거래건수 평균 ${latestAvg.toFixed(0)}건 (${qLabel(latest)}, ${selected.scope})`;
    const previousAvg = avg(selected.series.get(previous) ?? []);
    if (previousAvg === null || previousAvg <= 0) {
      return `거래건수 평균 ${latestAvg.toFixed(0)}건 (${qLabel(latest)}, ${selected.scope})`;
    }
    return `거래건수 ${latestAvg.toFixed(0)}건 (${qLabel(previous)} 대비 ${signedPct(((latestAvg - previousAvg) / previousAvg) * 100)}, ${selected.scope})`;
  }
  const c = await kakaoCount(lat, lng, 'FD6');
  return c === null ? null : `반경 500m 음식점 ${c}개`;
}

export async function fetchFranchiseChanges(admCd: string, businessType: string, address = ''): Promise<string | null> {
  const region = detectRegion(admCd, address);
  if (region !== 'seoul') return null;

  const rows = await seoulRows('VwsmTrdarStorQq', 1200); if (!rows) return null;
  const base = rows.filter((r) => matchIndustry(read(r, ['SVC_INDUTY_CD_NM']) ?? '', businessType));
  const use = base.length ? base : rows;
  const by = new Map<string, number>();
  for (const r of use) {
    const q = seoulQ(r);
    const c = toNum(r.FRC_STOR_CO);
    if (!q || c === null || c < 0) continue;
    const current = by.get(q) ?? 0;
    by.set(q, current + c);
  }
  const keys = Array.from(by.keys()); const l = latestQ(keys); if (!l) return null; const p = prevQ(keys, l);
  const lv = by.get(l) ?? 0;
  if (!p) {
    const latestRows = use.filter((r) => seoulQ(r) === l);
    const total = latestRows
      .map((r) => toNum(r.STOR_CO))
      .filter((x): x is number => x !== null && x >= 0)
      .reduce((sum, value) => sum + value, 0);
    if (total > 0) return `가맹점 비중 ${((lv / total) * 100).toFixed(1)}% (${qLabel(l)}, 전분기 비교 데이터 부족)`;
    return lv > 0 ? `가맹점 수 ${Math.round(lv)}개 (${qLabel(l)}, 전분기 비교 데이터 부족)` : null;
  }
  const pv = by.get(p) ?? 0;
  if (pv <= 0) {
    const latestRows = use.filter((r) => seoulQ(r) === l);
    const total = latestRows
      .map((r) => toNum(r.STOR_CO))
      .filter((x): x is number => x !== null && x >= 0)
      .reduce((sum, value) => sum + value, 0);
    if (total > 0) return `가맹점 비중 ${((lv / total) * 100).toFixed(1)}% (${qLabel(l)}, 전분기 비교 데이터 부족)`;
    return lv > 0 ? `가맹점 수 ${Math.round(lv)}개 (${qLabel(l)}, 전분기 비교 데이터 부족)` : null;
  }
  return `가맹점 수 ${signedPct(((lv - pv) / pv) * 100)} (${qLabel(p)} 대비 ${qLabel(l)})`;
}

export async function fetchSgisAgeDistribution(admCd: string, token: string): Promise<string | null> {
  if (!admCd || !token) return null;

  const data = await jfetch<SgisEnvelope>(
    `https://sgisapi.kostat.go.kr/OpenAPI3/startupbiz/pplsummary.json?accessToken=${encodeURIComponent(token)}&adm_cd=${encodeURIComponent(admCd)}`,
  );
  assertSgis(data);

  const row = pickRows(data)[0];
  if (!row) return null;

  const bands: Array<{ label: string; value: number | null }> = [
    { label: '10대 미만', value: toNum(row.teenage_less_than_per) },
    { label: '10대', value: toNum(row.teenage_per) },
    { label: '20대', value: toNum(row.twenty_per) },
    { label: '30대', value: toNum(row.thirty_per) },
    { label: '40대', value: toNum(row.forty_per) },
    { label: '50대', value: toNum(row.fifty_per) },
    { label: '60대', value: toNum(row.sixty_per) },
    { label: '70대 이상', value: toNum(row.seventy_more_than_per) },
  ];

  const available = bands.filter((band) => band.value !== null);
  if (available.length === 0) return null;

  return available
    .map((band) => `${band.label} ${(band.value ?? 0).toFixed(1)}%`)
    .join(' / ');
}

export async function fetchSgisIndustryTop(admCd: string, token: string): Promise<string | null> {
  if (!admCd || !token) return null;
  const data = await jfetch<SgisEnvelope>(`https://sgisapi.kostat.go.kr/OpenAPI3/startupbiz/corpdistsummary.json?accessToken=${encodeURIComponent(token)}&adm_cd=${encodeURIComponent(admCd)}`);
  assertSgis(data);
  const ratioByIndustry = new Map<string, number>();
  for (const row of pickRows(data)) {
    const list = row.theme_list;
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const name = read(record, ['s_theme_cd_nm', 'theme_nm']);
      if (!name) continue;

      const ratio = toNum(record.dist_per ?? record.ratio);
      if (ratio === null) continue;

      const current = ratioByIndustry.get(name);
      if (current === undefined || ratio > current) {
        ratioByIndustry.set(name, ratio);
      }
    }
  }

  if (ratioByIndustry.size === 0) return null;

  const top = Array.from(ratioByIndustry.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, ratio]) => `${name}(${ratio.toFixed(1)}%)`);

  return top.join(' / ');
}

export async function fetchRegionalTrendTimeline(admCd: string, businessType = '', address = ''): Promise<string | null> {
  const ck = `${admCd}:${businessType}:${address}`;
  const cached = getCached(timelineCache, ck);
  if (cached !== undefined) return cached;
  const region = detectRegion(admCd, address);
  let text: string | null = null;
  if (region === 'seoul') {
    const [salesRows, storeRows] = await Promise.all([
      seoulRows('VwsmTrdarSelngQq', 1200),
      seoulRows('VwsmTrdarStorQq', 1200),
    ]);
    if (salesRows && storeRows) {
      const storeCountIndex = buildSeoulStoreCountIndex(storeRows);
      if (storeCountIndex.size === 0) {
        setCached(timelineCache, ck, null, CACHE_TTL_MS);
        return null;
      }

      const base0 = salesRows.filter((r) => matchIndustry(read(r, ['SVC_INDUTY_CD_NM']) ?? '', businessType));
      const base = base0.length ? base0 : salesRows;
      const by = new Map<string, number[]>();
      for (const r of base) {
        const q = seoulQ(r);
        const a = seoulPerStoreRevenue(r, storeCountIndex);
        if (!q || a === null || a <= 0) continue;
        const bucket = by.get(q) ?? [];
        by.set(q, bucket);
        bucket.push(a);
      }
      const line = Array.from(by.entries()).sort((a, b) => qOrder(a[0]) - qOrder(b[0])).slice(-4).map(([q, xs]) => {
        const a = avg(xs); return a === null ? null : `${qLabel(q)} ${manwon(a)}(점포당)`;
      }).filter((x): x is string => Boolean(x));
      if (line.length >= 2) text = line.join(' > ');
    }
  } else if (region === 'gyeonggi') {
    const rows = await ggRows(5, 1000);
    if (rows) {
      const base0 = rows.filter((r) => matchIndustry(r.CLASS_CD_NM ?? '', businessType));
      const base = base0.length ? base0 : rows;
      const by = new Map<string, number[]>();
      for (const r of base) {
        const q = ggQ(r);
        const a = toNum(r.AMT);
        if (!q || a === null || a <= 0) continue;
        const bucket = by.get(q) ?? [];
        by.set(q, bucket);
        bucket.push(a);
      }
      const line = Array.from(by.entries()).sort((a, b) => qOrder(a[0]) - qOrder(b[0])).slice(-4).map(([q, xs]) => {
        const a = avg(xs); return a === null ? null : `${qLabel(q)} ${manwon(a)}`;
      }).filter((x): x is string => Boolean(x));
      if (line.length >= 2) text = line.join(' > ');
    }
  }
  setCached(timelineCache, ck, text, CACHE_TTL_MS);
  return text;
}

export async function fetchSdscCategoryBreakdown(lat: number, lng: number): Promise<string | null> {
  const ck = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  const cached = getCached(sdscCache, ck);
  if (cached !== undefined) return cached;
  const codes = ['FD6', 'CE7', 'AC5', 'CS2', 'CT1'];
  const names: Record<string, string> = { FD6: '음식', CE7: '카페', AC5: '학원', CS2: '편의점', CT1: '문화시설' };
  const counts = await Promise.all(codes.map(async (c) => kakaoCount(lat, lng, c)));
  const total = counts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  if (total <= 0) return null;
  const text = codes.map((c, i) => {
    const n = counts[i] ?? 0; return n > 0 ? `${names[c]} ${((n / total) * 100).toFixed(0)}%` : null;
  }).filter((x): x is string => Boolean(x)).join(' / ');
  setCached(sdscCache, ck, text || null, CACHE_TTL_MS);
  return text || null;
}

async function naverData(keyword: string): Promise<NaverTrendResponse | null> {
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret || !keyword.trim()) return null;
  const e = new Date(); const s = new Date(e); s.setDate(e.getDate() - 30);
  return jfetch<NaverTrendResponse>('https://openapi.naver.com/v1/datalab/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret },
    body: JSON.stringify({ startDate: s.toISOString().slice(0, 10), endDate: e.toISOString().slice(0, 10), timeUnit: 'week', keywordGroups: [{ groupName: keyword, keywords: [keyword] }] }),
  });
}

export async function fetchSearchTrend(keyword: string): Promise<string | null> {
  const p = (await naverData(keyword))?.results?.[0]?.data;
  if (!p || p.length < 2) return null;
  const prev = p[p.length - 2]?.ratio, cur = p[p.length - 1]?.ratio;
  if (typeof prev !== 'number' || typeof cur !== 'number' || prev <= 0) return null;
  const d = ((cur - prev) / prev) * 100;
  return `${keyword} 검색량 ${d >= 0 ? '상승' : '하락'} (${d >= 0 ? '+' : ''}${d.toFixed(0)}%)`;
}

export async function fetchNaverTrendSeries(keyword: string): Promise<string | null> {
  const k = keyword.trim(); if (!k) return null;
  const cached = getCached(trendCache, k);
  if (cached !== undefined) return cached;
  const p = (await naverData(keyword))?.results?.[0]?.data;
  if (!p || p.length < 2) return null;
  const xs = p.slice(-4).map((x) => x.ratio).filter((x): x is number => typeof x === 'number');
  if (xs.length < 2) return null;
  const text = `최근 4주 ${xs.map((x) => x.toFixed(0)).join(' > ')} (변동폭 ${(Math.max(...xs) - Math.min(...xs)).toFixed(1)})`;
  setCached(trendCache, k, text, SHORT_CACHE_TTL_MS);
  return text;
}

export async function fetchKakaoAccessibilityScore(lat: number, lng: number): Promise<string | null> {
  const ck = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  const cached = getCached(accessCache, ck);
  if (cached !== undefined) return cached;
  const [c, s, b, h, m] = await Promise.all([kakaoCount(lat, lng, 'CS2'), kakaoCount(lat, lng, 'SW8'), kakaoCount(lat, lng, 'BK9'), kakaoCount(lat, lng, 'HP8'), kakaoCount(lat, lng, 'MT1')]);
  const score = Math.min(100, (c ?? 0) * 3 + (s ?? 0) * 5 + (b ?? 0) * 2 + (h ?? 0) * 2 + (m ?? 0) * 3);
  if (score <= 0) return null;
  const text = `접근성 점수 ${score}`;
  setCached(accessCache, ck, text, SHORT_CACHE_TTL_MS);
  return text;
}

export function detectRegion(admCd: string, address = ''): Region {
  const a = address.replace(/\s+/g, '');
  if (a.startsWith('서울')) return 'seoul';
  if (a.startsWith('경기')) return 'gyeonggi';
  const d = admCd.replace(/\D/g, '');
  if (d.startsWith('11')) return 'seoul';
  if (d.startsWith('41')) return 'gyeonggi';
  return 'other';
}
