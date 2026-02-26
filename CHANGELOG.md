# CHANGELOG.md — 내일사장 상권분석 AI 컨설턴트

완료된 작업 이력. `handoff.md`가 길어지면 이 파일로 이전.

---

## [세션 9] Phase 6 고도화 2차 — 매출 로직 보정 + 심화 분석 UI 고도화 — 2026-02-26

### Phase 6 고도화 2차 (Codex 구현 / Claude Code 검증)

- `lib/public-apis.ts`
  - 점포당 매출 정밀 계산: `seoulPerStoreRevenue`, `buildSeoulStoreCountIndex`, `seoulTradeIndustryKey`
  - TTL 기반 인메모리 캐시: `CacheEntry<T>`, `getCached`, `setCached`
  - 주소 범위 필터링: `filterRowsByAddress`, `addressHints`, `locationTextFromRow`
  - `fetchSgisAgeDistribution` — 연령대별 전체 밴드 반환 (10대~70대이상)
  - `fetchSgisIndustryTop` — 비율 중복 제거, `name(ratio%)` 형식
  - 함수 시그니처 보정: `fetchCommercialTrend`, `fetchOpenCloseStats`, `fetchFranchiseChanges`
  - `publicApiFallbacks` 값 한국어 수정 (전 세션 이슈 해결)
- `lib/gemini.ts` — 기본 모델 `gemini-2.5-pro`, `TERM_STYLE_GUIDE` 상수 주입
- `app/api/report/route.ts`
  - 캐시 키 `report-v4` + `hashString` payload 핑거프린트
  - 요약 품질 필터: `isNumericOnlySentence`, `hasFragmentedSummary`, `stripNumericOnlySentences`
  - `normalizeInlineText`: "예상 월 매출" → "유사 업종 월 매출 참고치" 치환
  - `as GeminiReportRequest` → `satisfies GeminiReportRequest` 수정 (전 세션 이슈 해결)
- `app/api/chat/route.ts` — `gemini-2.5-flash` 기본 모델, `withTimeout()` 래퍼, role 정규화
- `components/report/LockedSection.tsx`
  - 진단 카드 4종: 상권 안정성/경쟁 부담도/임대 효율/수요·접근 적합도 + 점수 바
  - `Sparkline` SVG 컴포넌트 (폴리라인 차트)
  - KR 상수 객체 Unicode 이스케이프 처리 (한글 깨짐 방지)
  - `LockedSectionContext` prop 추가
- `components/report/PublicSection.tsx` — 소수점 보호, 숫자 단독 문장 필터
- `app/(routes)/report/[address]/ReportClient.tsx` — `context` prop → `LockedSection` 전달
- `app/api/public-data/route.ts`, `app/api/debug/public-data/route.ts` — 시그니처 동기화

### 검증 결과
- `npm run lint` — 에러/경고 0개
- `npm run build` — 성공 (10개 라우트)
- `verify-nextjs` 8개 항목 전체 PASS
  - Check 1 TypeScript any: 0건 ✅
  - Check 2 API Key NEXT_PUBLIC_ 오용: 0건 ✅
  - Check 3 클라이언트 외부 도메인 fetch: 0건 ✅
  - Check 4 isUnlocked → onSuccess 콜백 후에만 전환 ✅
  - Check 5 블러 패턴 (`blur-sm pointer-events-none select-none`) ✅
  - Check 6 서버 전용 env 변수 `app/api/` 경로에만 존재 ✅
  - Check 7 Gemini 백틱 전처리 ✅
  - Check 8 debug 엔드포인트 NODE_ENV guard ✅
- 코드 리뷰 6개 기준 전체 PASS

---

## [세션 8] Phase 6 고도화 — 공공 API 실연동 복구 + Gemini 타임아웃 수정 — 2026-02-26

### Phase 6 고도화: 공공 API 실연동 복구 + UI 품질 보강 (Codex 구현 / Claude Code 검증)

- `lib/public-apis.ts`
  - `fetchEstimatedRevenue`, `fetchCommercialTrend`, `fetchFranchiseRevenue`, `fetchOpenCloseStats`, `fetchFranchiseChanges` null 고정 → 실제 공공데이터 연동 복구
  - `geocode()` 보정: `adm_cd` 누락 시 `sido_cd + sgg_cd` 조합 fallback
  - `RULES` 카테고리 매칭 다중 확장 (카페/음식/교육/의료/유통/부동산/숙박 7종)
  - `commercial_trend`, `franchise_changes` 전분기 비교 불가 시 대체 계산 + 명시 문구
- `app/(routes)/report/[address]/ReportClient.tsx` — Gemini 호출 클라이언트 이동: `useEffect` + `/api/report` fetch, 로딩/에러 상태 관리
- `app/(routes)/report/[address]/page.tsx` — Gemini 호출 제거, `region` prop 전달, 초기 렌더 속도 개선
- `components/report/PublicSection.tsx` — 요약 가독성 보강, SGIS 금칙어 치환, "권장 실행" 문구 통일, rawSourceItems/insightItems UI 추가
- `app/api/report/route.ts` — 요약 품질 보장 (최소 220자/5문장), fallback summary 강화, 금칙어 치환 후처리
- `app/api/public-data/route.ts` — SGIS 토큰 만료 시 자동 retry, `runWithSgisTokenRetry()` 패턴

### 핵심 변경 효과
- **Gemini 타임아웃 버그 수정**: 서버에서 Gemini await → 클라이언트 useEffect로 이동, 페이지 초기 로딩 3초 이내 달성
- **실 데이터 연동**: 서울/경기 공공데이터 기반 매출·상권·개업폐업 지표가 실제 값으로 표시
- **요약 품질**: Gemini 응답 길이 부족 시 공공데이터 기반 보완 + 권장 실행 자동 삽입

### 검증 결과
- `npm run lint` — 에러/경고 0개
- `npm run build` — 성공 (10개 라우트)
- `verify-nextjs` 7개 항목 전체 PASS
  - Check 1 TypeScript any: 0건 ✅
  - Check 2 API Key NEXT_PUBLIC_ 오용: 0건 ✅
  - Check 3 클라이언트 외부 도메인 fetch: 0건 ✅
  - Check 4 isUnlocked → onSuccess 콜백 후에만 전환 ✅
  - Check 5 파일명 컨벤션 (PascalCase/camelCase) ✅
  - Check 6 서버 전용 env 변수 `app/api/` 경로에만 존재 ✅
  - Check 7 Gemini 백틱 전처리 (`replace(/\`\`\`json|\`\`\`/g, '')`) ✅
- 코드 리뷰 6개 기준 전체 PASS

---

## [세션 6] Phase 6 실 API 연동 + 지역별 리포트 완료 — 2026-02-25

### Phase 6: 실 API 데이터 연동 + 지역별 리포트 (Codex 구현 / Claude Code 검증)

- `lib/types.ts` — `Region` 타입 추가, `ExtendedInsights` 인터페이스 추가
- `lib/public-apis.ts` — 8개 함수 FALLBACK 상수 → `null` 반환 변경, `detectRegion(admCd)` export
- `app/api/public-data/route.ts` — `settledOrFallback` 제거, `settledOrMissing` + `MISSING` 상수 도입, `buildEmptyResponse`, `region: Region` 응답 필드 추가
- `lib/gemini.ts` — `GEMINI_SYSTEM_PROMPT` 단일 상수 → `buildGeminiSystemPrompt(region?)` 함수로 교체 (서울/경기/기타 3개 버전)
- `app/api/report/route.ts` — `region` 수신 + `buildGeminiSystemPrompt(region)` 프롬프트 분기 적용
- `app/(routes)/report/[address]/page.tsx` — public-data 응답 `region` 추출 → `<ReportClient>` 전달
- `app/(routes)/report/[address]/ReportClient.tsx` — `region` prop 추가, `/api/report` POST body에 포함
- `components/report/PublicSection.tsx` — `ExtendedInsights` 기반 추가 인사이트 섹션 구현

### 핵심 변경 효과
- API 키 미설정 환경에서 전 필드 `"데이터 없음"` 명시, Gemini 리포트 생성은 계속 동작
- `region` 기반 Gemini 프롬프트 분기: 서울(서울시 오픈데이터) / 경기(경기도 포털) / 기타(SGIS + 공통, 추정 표기)

### 검증 결과
- `npm run lint` — 에러/경고 0개
- `npm run build` — 성공 (9개 라우트)
- `verify-implementation` → `verify-nextjs` 7개 항목 전체 PASS
- 코드 리뷰 6개 기준 전체 PASS (any 0건, API Key 보안, 블러 패턴, isUnlocked 흐름)

---

## [세션 5] Phase 4 Spring Boot 백엔드 구현 완료 — 2026-02-25

### Phase 4: Spring Boot 리드 저장 + 알림톡 (Codex 구현 / Claude Code 검증)
- `backend/` — Spring Boot 3.1.5 프로젝트 신규 생성
  - `AireportApplication.java`, `LeadController.java`, `LeadService.java`, `AlimtalkService.java`
  - `LeadRepository.java`, `Lead.java`, `LeadRequestDto.java`, `LeadResponseDto.java`
  - `WebConfig.java` (CORS: localhost:3000 허용), `application.yml`
- `frontend/app/api/leads/route.ts` — Mock에서 Spring Boot 중계로 교체 (Mock 폴백 유지)
- Maven Wrapper (`mvnw`, `mvnw.cmd`, `.mvn/wrapper/maven-wrapper.properties`) 추가

### 이슈 수정 (Claude Code)
- UTF-8 BOM (`\ufeff`) 제거: `Lead.java`, `AlimtalkService.java`, `LeadService.java`, `AireportApplicationTests.java` 4개 파일
- `AlimtalkService.java` Java Reflection 방식 → 직접 Solapi SDK import 방식으로 교체
- `Lead.java` 컬럼 길이 수정: `name` 100→50, `target_area` 255→200 (SCHEMA.md 일치)
- `Lead.java` 누락 컬럼 추가: `alimtalkSent`, `alimtalkSentAt`, `updatedAt`

### 검증 결과
- `./mvnw test` — 통과 (H2 in-memory DB, contextLoads PASS)
- `npm run lint` — 에러/경고 0개
- `npm run build` — 성공

---

## [세션 4] Phase 2 + Phase 3 구현 검증 완료 — 2026-02-25

### Phase 2: 공공데이터 API 연동 (Codex 구현 / Claude Code 검증)
- `lib/public-apis.ts` — 공공 API 9개 함수 (SGIS, 서울, 경기, 공정위, 식약처, 네이버)
- `app/api/public-data/route.ts` — SGIS 토큰 자동갱신 + `Promise.allSettled` 병렬 호출
- 코드 리뷰 6개 기준 전체 PASS (any 0건, API Key 보안, 클라이언트 외부 fetch 0건)

### Phase 3: Gemini AI 리포트 연동 (Codex 구현 / Claude Code 검증)
- `lib/gemini.ts` — `GoogleGenerativeAI` 클라이언트 + 시스템 프롬프트 + Mock 폴백
- `app/api/report/route.ts` — POST 핸들러, JSON 전처리, 응답 유효성 검증, Mock 폴백
- `app/(routes)/report/[address]/page.tsx` — 공공데이터 → Gemini 순차 fetch
- `GEMINI_API_KEY` 환경변수 발급 + `.env.local` 설정 완료
- 이슈 수정: `lib/gemini.ts:4` 모델명 fallback `gemini-flash-latest` → `gemini-1.5-flash`

### 검증 결과
- `verify-implementation` → `verify-nextjs` 7개 항목 전체 PASS
- `npm run lint` — 에러/경고 0개
- `npm run build` — 성공 (8개 라우트 빌드)

---

## [세션 3] 스킬 시스템 구축 + Phase 1 검증 — 2026-02-25

### 스킬 시스템 (Claude Code)
- `/manage-skills` 실행 → `verify-nextjs` 스킬 생성 (7개 검사 항목)
- `find-skills` 스킬 설치 (vercel-labs/skills)
- `vercel-react-best-practices` 스킬 설치 (vercel-labs/agent-skills, 57개 규칙)

### Phase 1 검증 (Claude Code)
- 코드 리뷰 6개 기준 전체 PASS
  - TypeScript `any` 무검출
  - API Key `NEXT_PUBLIC_` 오용 없음
  - 클라이언트 외부 직접 fetch 없음
  - `isUnlocked` — `onSuccess` 콜백 이후에만 전환
  - 블러 패턴 (`blur-sm pointer-events-none select-none`) 정확히 적용
  - 파일명 컨벤션 (PascalCase/camelCase) 준수
- `npm run lint` — 에러/경고 0개
- `npm run build` — 성공 (7개 라우트 빌드)
- `verify-implementation` → `verify-nextjs` 7개 항목 전체 PASS (1개 SKIP: Gemini route 미생성)

---

## [Phase 1] UI 뼈대 + Mock 데이터 — 2026-02-24 (세션 2)

### 구현 (Codex)
- Next.js 14 프로젝트 초기화 (`frontend/`)
- 13개 파일 구현:
  - `app/layout.tsx`, `app/page.tsx` — 루트 레이아웃 + 랜딩 페이지
  - `app/(routes)/report/[address]/page.tsx` — 서버 컴포넌트, Mock 데이터 주입
  - `app/(routes)/report/[address]/ReportClient.tsx` — `isUnlocked` 상태 관리
  - `components/report/PublicSection.tsx` — 공개 데이터 카드 3종
  - `components/report/LockedSection.tsx` — 심화 분석 (blur 처리)
  - `components/report/UnlockCTA.tsx` — 🔒 CTA 버튼
  - `components/report/ReportSkeleton.tsx` — 로딩 스켈레톤
  - `components/modal/LeadCaptureModal.tsx` — 이름/전화번호 입력 모달
  - `components/chatbot/FloatingChatbot.tsx` — 하단 고정 AI 챗봇
  - `lib/types.ts` — TypeScript 타입 정의 (any 0개)
  - `app/api/leads/route.ts` — Mock API Route Handler

### 검증 (Claude Code + Playwright)
- 코드 리뷰 6개 기준 전체 PASS
- `npm run lint` — 에러/경고 0개
- `npm run build` — 성공 (6개 페이지 빌드)
- Playwright E2E: 랜딩→리포트→모달 입력→잠금 해제→챗봇 표시 전체 흐름 PASS

---

## [Phase 0] 프로젝트 셋업 — 2026-02-24 (세션 1)

### 문서 체계 구축
- `CLAUDE.md` 신규 생성
  - 프로젝트 규칙, 코드 컨벤션 (Next.js + Spring Boot)
  - Gemini 시스템 프롬프트 고정 정의
  - Learned Constraints 초기 세팅
- `ARCHITECTURE.md` 신규 생성
  - 전체 하이브리드 아키텍처 (Next.js BFF + Spring Boot)
  - 폴더 구조 (`frontend/`, `backend/`)
  - 공공데이터 API 8개 연동 명세
  - Gemini Output JSON Schema
  - 환경변수 목록
- `SCHEMA.md` 신규 생성
  - MySQL 테이블 3개 DDL: `leads`, `report_cache`, `chatbot_messages`
  - JPA Entity 참조 코드
- `ROADMAP.md` 신규 생성
  - Phase 0~6 전체 계획 수립
- `AGENTS.md` 신규 생성
  - 파일 소유권, 역할 분담, 워크플로우
  - 검증 기준 및 체크리스트
- `handoff.md` 신규 생성
- `CHANGELOG.md` 신규 생성

### 인프라 설정
- `.mcp.json` 구성 (Serena, Playwright, Context7, Sequential Thinking)
- Git 저장소 초기화 및 초기 커밋
