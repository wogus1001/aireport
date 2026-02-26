# handoff.md — 내일사장 상권분석 AI 컨설턴트

> 세션 시작 시 가장 먼저 읽어야 할 파일.
> Claude Code만 작성. 200줄 이하 유지. 이전 이력은 CHANGELOG.md로 이동.

---

## 현재 상태

- **현재 Phase**: Phase 6 고도화 완료 → Phase 7 (배포) 준비 중
- **최종 업데이트**: 2026-02-26 (세션 8 — 공공 API 실연동 복구, Gemini 타임아웃 버그 수정 완료)
- **브랜치**: master

---

## 완료된 작업 요약

- [x] Phase 0: 문서 체계 구축 (CLAUDE.md, ARCHITECTURE.md, SCHEMA.md, ROADMAP.md 등)
- [x] Phase 1: Next.js 14 UI 뼈대 + isUnlocked 패턴 + Mock 데이터 (2026-02-24)
- [x] Phase 2: 공공데이터 API 실제 연동 (2026-02-25) — `lib/public-apis.ts`, `app/api/public-data/route.ts`
- [x] Phase 3: Gemini AI 리포트 연동 (2026-02-25) — `lib/gemini.ts`, `app/api/report/route.ts`
- [x] Phase 4: Spring Boot 리드 저장 + 알림톡 (2026-02-25)
- [x] Phase 6: 실 API 데이터 연동 + 지역별 Gemini 프롬프트 (2026-02-25)
  - `lib/types.ts` — `Region` 타입 추가
  - `lib/public-apis.ts` — 9개 함수 FALLBACK→null, `detectRegion()` export
  - `app/api/public-data/route.ts` — `settledOrMissing`, `region` 응답 포함, `buildEmptyResponse`
  - `lib/gemini.ts` — `buildGeminiSystemPrompt(region?)` 3개 버전
  - `app/api/report/route.ts` — region 수신, 프롬프트 분기
  - `app/(routes)/report/[address]/page.tsx` — region 전달
  - `backend/` 전체 신규 생성 (LeadController, LeadService, AlimtalkService, Lead entity)
  - `frontend/app/api/leads/route.ts` — Spring Boot 중계 + Mock 폴백
  - `./mvnw test` PASS (H2 in-memory DB)
- [x] 세션 7: API 진단 엔드포인트 추가 (2026-02-25)
  - `frontend/app/api/debug/public-data/route.ts` — **개발 전용** (`NODE_ENV !== 'development'` 시 403)
  - 15개 fetch 함수 개별 `Promise.allSettled` 실행 → `{ value, status: 'ok'|'null'|'error' }` 반환
  - `sgis_token`, `geocode`, `region`, `functions` 최상위 필드 포함
  - `npm run lint` / `npm run build` 에러 0개 확인

---

## 긴급 버그 수정 (Phase 6 후속)

### 🐛 증상
`/report/[address]` 페이지에서 공개 지표(public_metrics)는 실제 데이터가 나오지만,
요약(summary)과 심화 분석(locked_data)이 항상 하드코딩 목업("하남시 미사역...")을 표시함.

### 🔍 원인
`page.tsx`의 두 API 호출이 **직렬** 실행됨:
```
fetchPublicData()   ← 외부 API 다수 호출, 최대 ~7초
       ↓ (완료 후)
fetchGeminiReport() ← Gemini 호출, 최대 ~10초
```
`API_TIMEOUT_MS = 12000`이지만 두 호출의 합산 시간이 12초를 초과하면
`fetchGeminiReport`가 timeout → catch → `null` → `MOCK_LOCKED_DATA` + `MOCK_SUMMARY` 사용.

### ✅ 검증
- `/api/public-data` 직접 호출: 실제 데이터 정상 반환 ✓
- `/api/report` 직접 호출: Gemini 실제 분석 정상 반환 (`x-report-source: gemini`) ✓
- 페이지 두 번째 방문: public_metrics 실제 데이터 표시, Gemini 부분만 목업 ✓ (타임아웃 확인)

---

## API 진단 엔드포인트 사용법 (개발 서버 기동 후 브라우저에서 확인)

> Codex는 구현 작업 전 아래 URL로 실 API 데이터 수신 여부를 확인한다.
> `npm run dev` 후 브라우저 또는 curl로 호출.

```
# 서울 — estimated_revenue·commercial_trend status: "ok" 기대
GET http://localhost:3000/api/debug/public-data?address=서울특별시%20마포구%20홍대입구역%20근처&business_type=카페

# 경기 — 동일
GET http://localhost:3000/api/debug/public-data?address=경기도%20하남시%20미사역%20근처&business_type=카페

# 기타 — estimated_revenue status: "null" 이 정상
GET http://localhost:3000/api/debug/public-data?address=부산광역시%20해운대구&business_type=카페
```

응답 예시:
```json
{
  "region": "seoul",
  "sgis_token": "ok",
  "functions": {
    "estimated_revenue": { "value": "...", "status": "ok" },
    "commercial_trend":  { "value": "...", "status": "ok" }
  }
}
```

`status: "null"` 또는 `status: "error"` 항목이 있으면 해당 API 키/엔드포인트 문제임.
진단 후 아래 Codex 구현 스펙(Gemini 클라이언트 이동)을 진행한다.

---

## Codex 구현 스펙 — 긴급 버그 수정 (Gemini 클라이언트 이동)

> **Codex는 이 섹션을 읽고 구현한다. `*.md` 파일은 수정하지 않는다.**

### 배경
`page.tsx`(서버 컴포넌트)에서 `/api/report`(Gemini)를 await하면 25초 타임아웃이 발생한다.
브라우저에서 직접 호출 시 빠르게 응답하므로, Gemini 호출을 클라이언트 사이드로 이동해야 한다.

### 목표 흐름
```
[현재] page.tsx(서버) → /api/public-data → /api/report(Gemini 25초 대기) → 렌더
[변경] page.tsx(서버) → /api/public-data → 빠른 렌더
       ReportClient(클라이언트) → useEffect → /api/report → 상태 업데이트
```

### 수정 허용 파일 (2개만)

| 파일 | 작업 |
|------|------|
| `frontend/app/(routes)/report/[address]/page.tsx` | **수정** — Gemini 호출 제거, `region` prop 추가 |
| `frontend/app/(routes)/report/[address]/ReportClient.tsx` | **수정** — Gemini 클라이언트 fetch + 로딩 상태 |

---

### 1. `page.tsx` 수정

**제거할 것**
- `fetchGeminiReport` 함수 전체 삭제
- `GeminiFetchParams` 인터페이스 삭제
- `import type { GeminiReportResponse } from '@/lib/gemini'` 삭제
- `MOCK_SUMMARY`, `MOCK_LOCKED_DATA` 상수 삭제 (ReportClient로 이동)
- `geminiResult` 변수 및 관련 코드 삭제

**변경할 것**

`ReportClient`에 `region` prop 추가 전달:
```tsx
// 변경 전
return <ReportClient address={address} reportData={reportData} />;

// 변경 후
return <ReportClient address={address} reportData={reportData} region={region} />;
```

`reportData` 구성 — Gemini 필드를 빈 기본값으로:
```ts
const reportData: ReportData = {
  summary: '',                    // 클라이언트에서 채움
  public_metrics,
  locked_data: {                  // 클라이언트에서 채움
    estimated_revenue: '',
    risk_alert: '',
    top_3_strategies: [],
  },
  raw_locked_inputs,
};
```

`fetchPublicData` 실패 시 catch 블록도 같은 구조로:
```ts
// catch 블록: public_metrics만 MOCK, Gemini 필드는 빈 값
return {
  public_metrics: MOCK_PUBLIC_METRICS,
  raw_locked_inputs: {
    ...MOCK_RAW_LOCKED_INPUTS,
    rent_price_raw: composeRentFallback(rent, deposit, area),
  },
};
// reportData 구성은 위와 동일하게 summary: '', locked_data 빈 값
```

---

### 2. `ReportClient.tsx` 수정

**타입 및 상수 추가**
```tsx
import type { GeminiReportResponse } from '@/lib/gemini';
import type { LockedData, Region, ReportData } from '@/lib/types';

// props에 region 추가
interface ReportClientProps {
  address: string;
  reportData: ReportData;
  region?: Region;
}

// Gemini 로딩 전 표시할 기본값
const MOCK_SUMMARY = '하남시 미사역 반경 500m는 30대 여성 유동인구가 집중되는 주거 상권입니다. 퇴근 피크타임 수요가 강하나 카페 업종 과포화 상태입니다.';
const MOCK_LOCKED_DATA: LockedData = {
  estimated_revenue: '3,200만원',
  risk_alert: '최근 3개월 폐업률 18%로 업종 평균 대비 2.1배 높음',
  top_3_strategies: [
    { title: '토스 인프라를 활용한 타겟 마케팅', description: '30대 여성 토스 사용자에게 직접 쿠폰 푸시 알림 발송으로 반경 1km 내 유입 유도' },
    { title: '피크타임 전용 테이크아웃 메뉴', description: '오후 6~8시 직장인 퇴근 수요를 겨냥한 5분 완성 테이크아웃 라인업 구성' },
    { title: '주차 연계 집객 전략', description: '인근 무료주차장 3개소 제휴로 반경 1km 차량 유입 유도 및 체류 시간 증가' },
  ],
};
```

**상태 추가**
```tsx
const [geminiResult, setGeminiResult] = useState<GeminiReportResponse | null>(null);
const [isGeminiLoading, setIsGeminiLoading] = useState(true);
```

**useEffect — Gemini 클라이언트 fetch**

기존 hydration useEffect 아래에 추가:
```tsx
useEffect(() => {
  let cancelled = false;

  async function loadGemini() {
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          region,
          public_metrics: reportData.public_metrics,
          raw_locked_inputs: reportData.raw_locked_inputs,
        }),
      });
      if (!res.ok || cancelled) return;
      const payload = (await res.json()) as Partial<GeminiReportResponse>;
      if (payload.summary && payload.locked_data && !cancelled) {
        setGeminiResult({ summary: payload.summary, locked_data: payload.locked_data });
      }
    } catch {
      // 실패 시 MOCK 그대로 표시
    } finally {
      if (!cancelled) setIsGeminiLoading(false);
    }
  }

  loadGemini();
  return () => { cancelled = true; };
}, [address, region, reportData.public_metrics, reportData.raw_locked_inputs]);
```

**렌더링에서 실제 데이터 사용**

`PublicSection`과 `LockedSection`에 전달하는 `reportData`를 실제 Gemini 결과로 합성:
```tsx
const displayData: ReportData = {
  ...reportData,
  summary: geminiResult?.summary ?? MOCK_SUMMARY,
  locked_data: geminiResult?.locked_data ?? MOCK_LOCKED_DATA,
};

// 기존 reportData → displayData로 교체
<PublicSection address={address} data={displayData} />
<LockedSection data={displayData.locked_data} />
```

**Gemini 로딩 중 summary 영역 표시** (선택 — PublicSection이 summary를 렌더링한다면):

`isGeminiLoading`이 true인 동안 summary 텍스트 자리에 로딩 인디케이터 표시 여부는 `PublicSection` 구현에 따라 판단.

---

### 완료 조건
- [ ] 페이지 초기 로딩 **3초 이내** (public_metrics 표시, Gemini 로딩 중)
- [ ] Gemini 결과 도착 후 summary와 locked_data가 실제 주소 기반 텍스트로 업데이트
- [ ] locked_data의 estimated_revenue가 "3,200만원" 고정값이 아닌 실제 분석값으로 표시
- [ ] `npm run lint` 에러 0개

**금지 사항**: `*.md` / `.claude/skills/**` 수정 금지.

---

## 다음 TODO (Phase 5)

### 🎯 목표: AI 챗봇 Gemini 연동 + 리포트 캐시

**사전 준비 (Codex 시작 전 사람이 직접 완료)**

| 항목 | 상태 |
|------|------|
| MySQL Docker 실행 + Spring Boot 기동 확인 | ⏳ |
| `frontend/.env.local`에 `SPRING_BOOT_URL=http://localhost:8080` 확인 | ⏳ |

---

## Codex 구현 스펙 — Phase 5

> **Codex는 이 섹션만 읽고 구현한다. `*.md` 파일은 수정하지 않는다.**
> 참조: `CLAUDE.md`(컨벤션), `SCHEMA.md`(report_cache / chatbot_messages DDL)

**수정 허용 파일** (이외 생성·수정 금지)

| 파일 | 작업 |
|------|------|
| `frontend/components/chatbot/FloatingChatbot.tsx` | **수정** — Mock 제거, `/api/chat` fetch 연동 |
| `frontend/app/api/chat/route.ts` | **신규** — Gemini 다회전 대화 |
| `frontend/app/api/report/route.ts` | **수정** — report_cache 조회/저장 추가 |
| `backend/src/main/java/com/nsajang/aireport/entity/ReportCache.java` | **신규** |
| `backend/src/main/java/com/nsajang/aireport/repository/ReportCacheRepository.java` | **신규** |
| `backend/src/main/java/com/nsajang/aireport/service/ReportCacheService.java` | **신규** |
| `backend/src/main/java/com/nsajang/aireport/controller/CacheController.java` | **신규** |

**`app/api/chat/route.ts` 스펙**:
```ts
// POST /api/chat
// Body: { messages: Array<{role: 'user'|'model', parts: [{text: string}]}>, address: string }
// Response: { reply: string }
// - GoogleGenerativeAI(process.env.GEMINI_API_KEY!) → gemini-1.5-flash
// - model.startChat({ history: messages.slice(0, -1), systemInstruction: SYSTEM_PROMPT })
// - chat.sendMessage(messages.at(-1).parts[0].text)
// - 에러 시 { reply: '일시적 오류입니다. 다시 시도해주세요.' } 반환
const CHAT_SYSTEM_PROMPT = (address: string) =>
  `너는 ${address} 상권분석 전문가야. 사장님 관점에서 간결하고 실행 가능한 조언만 해. 3문장 이내로 답해.`;
```

**`FloatingChatbot.tsx` 수정 패턴**:
```ts
// buildAssistantReply() 함수 전체 삭제
// messages 형식: Array<{role: 'user'|'model', parts: [{text: string}]}>
// handleSubmit: fetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages: history, address }) })
// isLoading 상태 추가 — 전송 버튼 disabled + "..." 말풍선 표시
// fetch 실패 시 { role: 'model', parts: [{text: '일시적 오류입니다.'}] } 추가
// Message 타입: { role: 'user'|'model', parts: [{text: string}] } (lib/types.ts 수정 필요)
```

**`app/api/report/route.ts` 캐싱 수정**:
```ts
// 1. addressKey = encodeURIComponent(address)
// 2. SPRING_BOOT_URL 설정 시 → GET /api/v1/cache/{addressKey} 조회
// 3. 캐시 HIT (hit: true) → cached report 즉시 반환 (Gemini 호출 skip)
// 4. 캐시 MISS → Gemini 호출 후 → POST /api/v1/cache { addressKey, reportJson, publicDataJson }
// 5. SPRING_BOOT_URL 미설정 → 기존 동작 유지 (캐싱 skip)
```

**Spring Boot 캐시 API 스펙**:
- `GET /api/v1/cache/{addressKey}` → `{ hit: boolean, reportJson?: string, publicDataJson?: string }`
- `POST /api/v1/cache` → body: `{ addressKey, reportJson, publicDataJson }` → 저장 후 200 OK
- `ReportCacheService.findByAddressKey(key)`: `expires_at > NOW()` 조건으로 유효 캐시만 반환
- `ReportCacheService.save(dto)`: 기존 `addressKey` 있으면 UPDATE, 없으면 INSERT. `expires_at = NOW() + 24시간`
- `ReportCache` entity: SCHEMA.md DDL 그대로 (`id`, `address_key`, `report_json`, `public_data_json`, `expires_at`, `created_at`)

**완료 조건**
- [ ] 챗봇 전송 → Gemini 실제 응답 표시 (Mock buildAssistantReply 없음)
- [ ] 동일 주소 2회 리포트 요청 → DB 캐시 HIT, Gemini 호출 없음
- [ ] `./mvnw test` 통과
- [ ] `npm run lint` 에러 0개

**금지 사항**: `*.md` / `.claude/skills/**` 수정 금지. `pom.xml` 수정 금지. chatbot_messages 저장은 Phase 5 범위 아님(Phase 6+).

---

## 알려진 이슈

| 이슈 | 상태 | 설명 |
|------|------|------|
| page.tsx Gemini 타임아웃 | ✅ 수정 완료 | ReportClient.tsx useEffect로 Gemini 호출 이동 (세션 8) |
| MySQL 환경 | ⏳ 미설정 | Phase 7 시작 전 Docker 실행 필요 |
| 솔라피 API 키 | ⏳ 미발급 | 미설정 시 알림톡 skip으로 동작 가능 |
| 공공 API 키 | ⚠️ 부분 | 일부 발급 완료, 대중교통 API 미연동 |
| publicApiFallbacks 영어 문자열 | 🟡 보완 필요 | `public-apis.ts:44` fallback 값들이 영어 → 한국어 사용자에게 노출 위험 (코드 리뷰 이슈) |

---

## 참조 문서

- 시스템 구조 및 API 명세: `ARCHITECTURE.md`
- DB 스키마: `SCHEMA.md`
- 개발 로드맵: `ROADMAP.md`
- 에이전트 규칙: `AGENTS.md`
- 프로젝트 규칙 및 코드 패턴: `CLAUDE.md`
- 완료 이력: `CHANGELOG.md`
