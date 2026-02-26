
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
  { label: '카페', keywords: ['카페', '커피', '디저트', '베이커리'], sgis: ['카페', '커피', '제과', '빵'], kakao: ['CE7', 'FD6'] },
  { label: '음식점', keywords: ['음식', '식당', '외식', '한식', '중식', '일식', '양식', '분식', '치킨', '피자', '술집', '주점'], sgis: ['음식', '식당', '외식', '한식', '중식', '일식', '양식', '분식', '주점', '치킨', '피자'], kakao: ['FD6', 'CE7'] },
  { label: '교육', keywords: ['교육', '학원', '교습', '공부방', '과외', '요가', '필라테스', '스튜디오', '레슨'], sgis: ['교육', '학원', '교습', '요가', '필라테스', '스튜디오', '레슨'], kakao: ['AC5', 'PS3', 'SC4', 'CT1'] },
  { label: '의료', keywords: ['병원', '의원', '치과', '한의원', '약국', '클리닉'], sgis: ['병원', '의원', '치과', '약국', '클리닉', '의료'], kakao: ['HP8', 'PM9'] },
  { label: '유통', keywords: ['편의점', '마트', '슈퍼', '소매', '잡화', '리테일'], sgis: ['편의점', '마트', '슈퍼', '소매', '잡화', '유통'], kakao: ['CS2', 'MT1'] },
  { label: '부동산', keywords: ['부동산', '중개', '공인중개', '중개업'], sgis: ['부동산', '중개'], kakao: ['AG2'] },
  { label: '숙박', keywords: ['숙박', '호텔', '모텔', '게스트하우스'], sgis: ['숙박', '호텔', '모텔'], kakao: ['AD5'] },
];
const DEFAULT_RULE: Rule = { label: '생활업종', keywords: [], sgis: ['음식', '카페', '교육', '소매', '서비스'], kakao: ['FD6', 'CE7', 'AC5', 'CS2', 'CT1'] };

const TMO = 6500;
const seoulCache = new Map<string, Promise<Array<Record<string, unknown>> | null>>();
const ggCache = new Map<string, Promise<GyeonggiRow[] | null>>();
const timelineCache = new Map<string, string | null>();
const sdscCache = new Map<string, string | null>();
const trendCache = new Map<string, string | null>();
const accessCache = new Map<string, string | null>();

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
  const cached = seoulCache.get(ck);
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
  seoulCache.set(ck, promise);
  return promise;
}
async function ggRows(maxPages: number, pageSize: number): Promise<GyeonggiRow[] | null> {
  const ck = `${maxPages}:${pageSize}`;
  const cached = ggCache.get(ck);
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
  ggCache.set(ck, promise);
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

export async function fetchEstimatedRevenue(admCd: string, businessType = '', address = ''): Promise<string | null> {
  const region = detectRegion(admCd, address);
  if (region === 'seoul') {
    const rows = await seoulRows('VwsmTrdarSelngQq', 1000); if (!rows) return null;
    const base = rows.filter((r) => matchIndustry(read(r, ['SVC_INDUTY_CD_NM']) ?? '', businessType));
    const use = base.length ? base : rows;
    const latest = latestQ(use.map((r) => seoulQ(r)).filter((x): x is string => Boolean(x))); if (!latest) return null;
    const vals = use.filter((r) => seoulQ(r) === latest).map((r) => toNum(r.THSMON_SELNG_AMT)).filter((x): x is number => x !== null && x > 0);
    const m = med(vals); if (m === null) return null;
    return `월 평균 매출 ${manwon(m)} (서울 ${qLabel(latest)}, 표본 ${vals.length}개)`;
  }
  if (region === 'gyeonggi') {
    const rows = await ggRows(5, 1000); if (!rows) return null;
    const base = rows.filter((r) => matchIndustry(r.CLASS_CD_NM ?? '', businessType));
    const use = base.length ? base : rows;
    const latest = latestQ(use.map((r) => ggQ(r)).filter((x): x is string => Boolean(x))); if (!latest) return null;
    const vals = use.filter((r) => ggQ(r) === latest).map((r) => toNum(r.AMT)).filter((x): x is number => x !== null && x > 0);
    const m = med(vals); if (m === null) return null;
    return `월 평균 매출 ${manwon(m)} (경기 ${qLabel(latest)}, 표본 ${vals.length}개)`;
  }
  return null;
}

export async function fetchCommercialTrend(admCd: string): Promise<string | null> {
  const region = detectRegion(admCd, '');
  if (region === 'seoul') {
    const rows = await seoulRows('VwsmTrdarSelngQq', 1000); if (!rows) return null;
    const m = new Map<string, number[]>();
    for (const r of rows) {
      const q = seoulQ(r);
      const a = toNum(r.THSMON_SELNG_AMT);
      if (!q || a === null || a <= 0) continue;
      const bucket = m.get(q) ?? [];
      m.set(q, bucket);
      bucket.push(a);
    }
    const keys = Array.from(m.keys()); const l = latestQ(keys); if (!l) return null; const p = prevQ(keys, l);
    const avL = avg(m.get(l) ?? []); if (avL === null) return null;
    if (!p) return `상권 추세 기준 ${qLabel(l)} 평균 매출 ${manwon(avL)} (전분기 비교 데이터 부족)`;
    const avP = avg(m.get(p) ?? []); if (avP === null || avP <= 0) return `상권 추세 기준 ${qLabel(l)} 평균 매출 ${manwon(avL)} (전분기 비교 데이터 부족)`;
    return `상권 추세 ${signedPct(((avL - avP) / avP) * 100)} (${qLabel(p)} 대비 ${qLabel(l)})`;
  }
  if (region === 'gyeonggi') {
    const rows = await ggRows(5, 1000); if (!rows) return null;
    const m = new Map<string, number[]>();
    for (const r of rows) {
      const q = ggQ(r);
      const a = toNum(r.AMT);
      if (!q || a === null || a <= 0) continue;
      const bucket = m.get(q) ?? [];
      m.set(q, bucket);
      bucket.push(a);
    }
    const keys = Array.from(m.keys()); const l = latestQ(keys); if (!l) return null; const p = prevQ(keys, l);
    const avL = avg(m.get(l) ?? []); if (avL === null) return null;
    if (!p) return `상권 추세 기준 ${qLabel(l)} 평균 매출 ${manwon(avL)} (전분기 비교 데이터 부족)`;
    const avP = avg(m.get(p) ?? []); if (avP === null || avP <= 0) return `상권 추세 기준 ${qLabel(l)} 평균 매출 ${manwon(avL)} (전분기 비교 데이터 부족)`;
    return `상권 추세 ${signedPct(((avL - avP) / avP) * 100)} (${qLabel(p)} 대비 ${qLabel(l)})`;
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

export async function fetchOpenCloseStats(lat: number, lng: number, address = ''): Promise<string | null> {
  const region = detectRegion('', address);
  if (region === 'seoul') {
    const rows = await seoulRows('VwsmTrdarStorQq', 1200); if (!rows) return null;
    const latest = latestQ(rows.map((r) => seoulQ(r)).filter((x): x is string => Boolean(x))); if (!latest) return null;
    const now = rows.filter((r) => seoulQ(r) === latest);
    const op = avg(now.map((r) => toNum(r.OPBIZ_STOR_CO)).filter((x): x is number => x !== null));
    const cl = avg(now.map((r) => toNum(r.CLSBIZ_STOR_CO)).filter((x): x is number => x !== null));
    return op === null || cl === null ? null : `개업 평균 ${op.toFixed(1)}건 / 폐업 평균 ${cl.toFixed(1)}건 (${qLabel(latest)})`;
  }
  if (region === 'gyeonggi') {
    const rows = await ggRows(5, 1000); if (!rows) return null;
    const hint = address.trim().split(/\s+/).find((t) => /[로길동시장대로]/.test(t));
    const scoped = hint ? rows.filter((r) => norm(r.BIZDIST_NM ?? '').includes(norm(hint))) : rows;
    const use = scoped.length ? scoped : rows;
    const keys = use.map((r) => ggQ(r)).filter((x): x is string => Boolean(x));
    const l = latestQ(keys); if (!l) return null; const p = prevQ(keys, l);
    const lv = avg(use.filter((r) => ggQ(r) === l).map((r) => toNum(r.NOC)).filter((x): x is number => x !== null && x >= 0));
    if (lv === null) return null;
    if (!p) return `거래건수 평균 ${lv.toFixed(0)}건 (${qLabel(l)})`;
    const pv = avg(use.filter((r) => ggQ(r) === p).map((r) => toNum(r.NOC)).filter((x): x is number => x !== null && x >= 0));
    if (pv === null || pv <= 0) return `거래건수 평균 ${lv.toFixed(0)}건 (${qLabel(l)})`;
    return `거래건수 ${lv.toFixed(0)}건 (${qLabel(p)} 대비 ${signedPct(((lv - pv) / pv) * 100)})`;
  }
  const c = await kakaoCount(lat, lng, 'FD6');
  return c === null ? null : `반경 500m 음식점 ${c}개`;
}

export async function fetchFranchiseChanges(businessType: string): Promise<string | null> {
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

export async function fetchSgisAgeDistribution(admCd: string, token: string): Promise<string | null> { return fetchDemographics(admCd, token); }

export async function fetchSgisIndustryTop(admCd: string, token: string): Promise<string | null> {
  if (!admCd || !token) return null;
  const data = await jfetch<SgisEnvelope>(`https://sgisapi.kostat.go.kr/OpenAPI3/startupbiz/corpdistsummary.json?accessToken=${encodeURIComponent(token)}&adm_cd=${encodeURIComponent(admCd)}`);
  assertSgis(data);
  const out: string[] = [];
  for (const row of pickRows(data)) {
    const list = row.theme_list;
    if (!Array.isArray(list)) continue;
    for (const item of list.slice(0, 5)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const name = read(item as Record<string, unknown>, ['s_theme_cd_nm', 'theme_nm']);
      if (name) out.push(name);
    }
  }
  return out.length ? out.slice(0, 5).join(' / ') : null;
}

export async function fetchRegionalTrendTimeline(admCd: string, businessType = '', address = ''): Promise<string | null> {
  const ck = `${admCd}:${businessType}:${address}`;
  if (timelineCache.has(ck)) return timelineCache.get(ck) ?? null;
  const region = detectRegion(admCd, address);
  let text: string | null = null;
  if (region === 'seoul') {
    const rows = await seoulRows('VwsmTrdarSelngQq', 1200);
    if (rows) {
      const base0 = rows.filter((r) => matchIndustry(read(r, ['SVC_INDUTY_CD_NM']) ?? '', businessType));
      const base = base0.length ? base0 : rows;
      const by = new Map<string, number[]>();
      for (const r of base) {
        const q = seoulQ(r);
        const a = toNum(r.THSMON_SELNG_AMT);
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
  timelineCache.set(ck, text);
  return text;
}

export async function fetchSdscCategoryBreakdown(lat: number, lng: number): Promise<string | null> {
  const ck = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  if (sdscCache.has(ck)) return sdscCache.get(ck) ?? null;
  const codes = ['FD6', 'CE7', 'AC5', 'CS2', 'CT1'];
  const names: Record<string, string> = { FD6: '음식', CE7: '카페', AC5: '학원', CS2: '편의점', CT1: '문화시설' };
  const counts = await Promise.all(codes.map(async (c) => kakaoCount(lat, lng, c)));
  const total = counts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  if (total <= 0) return null;
  const text = codes.map((c, i) => {
    const n = counts[i] ?? 0; return n > 0 ? `${names[c]} ${((n / total) * 100).toFixed(0)}%` : null;
  }).filter((x): x is string => Boolean(x)).join(' / ');
  sdscCache.set(ck, text || null);
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
  if (trendCache.has(k)) return trendCache.get(k) ?? null;
  const p = (await naverData(keyword))?.results?.[0]?.data;
  if (!p || p.length < 2) return null;
  const xs = p.slice(-4).map((x) => x.ratio).filter((x): x is number => typeof x === 'number');
  if (xs.length < 2) return null;
  const text = `최근 4주 ${xs.map((x) => x.toFixed(0)).join(' > ')} (변동폭 ${(Math.max(...xs) - Math.min(...xs)).toFixed(1)})`;
  trendCache.set(k, text);
  return text;
}

export async function fetchKakaoAccessibilityScore(lat: number, lng: number): Promise<string | null> {
  const ck = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  if (accessCache.has(ck)) return accessCache.get(ck) ?? null;
  const [c, s, b, h, m] = await Promise.all([kakaoCount(lat, lng, 'CS2'), kakaoCount(lat, lng, 'SW8'), kakaoCount(lat, lng, 'BK9'), kakaoCount(lat, lng, 'HP8'), kakaoCount(lat, lng, 'MT1')]);
  const score = Math.min(100, (c ?? 0) * 3 + (s ?? 0) * 5 + (b ?? 0) * 2 + (h ?? 0) * 2 + (m ?? 0) * 3);
  if (score <= 0) return null;
  const text = `접근성 점수 ${score}`;
  accessCache.set(ck, text);
  return text;
}

export function detectRegion(admCd: string, address = ''): Region {
  const a = address.replace(/\s+/g, '');
  if (a.startsWith('서울')) return 'seoul';
  if (a.startsWith('경기')) return 'gyeonggi';
  const d = admCd.replace(/\D/g, '');
  if (d.startsWith('11')) return 'seoul';
  if (d.startsWith('41') || d.startsWith('31')) return 'gyeonggi';
  return 'other';
}
