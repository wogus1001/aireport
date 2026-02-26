# ROADMAP.md — 내일사장 상권분석 AI 컨설턴트

Phase별 개발 계획 및 진행 현황.

---

## 전체 Phase 개요

| Phase | 기능 | 상태 |
|-------|------|------|
| Phase 0 | 프로젝트 셋업 + 문서 체계 | ✅ 완료 |
| Phase 1 | UI 뼈대 + Mock 데이터 연동 | ✅ 완료 |
| Phase 2 | 공공데이터 API 실제 연동 | ✅ 완료 |
| Phase 3 | Gemini AI 리포트 생성 연동 | ✅ 완료 |
| Phase 4 | Spring Boot 리드 저장 + 알림톡 | ✅ 완료 |
| Phase 5 | AI 챗봇 + 리포트 캐시 | ✅ 완료 |
| Phase 6 | 실 API 데이터 연동 + 지역별 리포트 | ✅ 완료 |
| Phase 6 고도화 2차 | 매출 로직 보정 + 심화 분석 UI 고도화 | ✅ 완료 |
| Phase 7 | 배포 + nsajang.com 연동 | 📋 계획 |

---

## Phase 0: 프로젝트 셋업 ✅

**완료일**: 2026-02-24

### 완료 항목
- [x] 프로젝트 요구사항 분석 및 아키텍처 확정
- [x] 문서 체계 구축 (CLAUDE.md, ARCHITECTURE.md, SCHEMA.md, ROADMAP.md, AGENTS.md, handoff.md, CHANGELOG.md)
- [x] 기술 스택 확정 (Next.js 14 + Spring Boot 3.1.5 + MySQL 8.3.0 + Gemini)
- [x] MCP 설정 (.mcp.json 구성)

---

## Phase 1: UI 뼈대 + Mock 데이터 ✅

**완료일**: 2026-02-24

**목표**: isUnlocked 상태 기반 블러/언블러 UI 완성. 데이터는 Mock JSON 사용.

### 구현 항목
- [x] Next.js 14 프로젝트 초기화 (`frontend/`)
- [x] Tailwind CSS 설정 (모바일 미니앱 최적화)
- [x] `app/(routes)/report/[address]/page.tsx` — 서버 컴포넌트
- [x] `ReportClient.tsx` — `isUnlocked` 상태 관리 클라이언트 컴포넌트
- [x] `PublicSection.tsx` — 공개 데이터 카드 UI (유동인구, 경쟁점, 집객시설)
- [x] `LockedSection.tsx` — 블러 처리 UI (매출, 위험분석, 전략)
- [x] `UnlockCTA.tsx` — 🔒 CTA 버튼
- [x] `LeadCaptureModal.tsx` — 이름/전화번호 입력 모달
- [x] `ReportSkeleton.tsx` — 로딩 스켈레톤 UI
- [x] Mock JSON으로 전체 화면 렌더링 확인

### 완료 조건
- [x] 블러 처리 영역이 Tailwind `blur-sm`으로 정확히 적용
- [x] 모달 열기/닫기 동작 정상
- [x] Mock 제출 시 `isUnlocked = true` 전환 및 블러 해제
- [x] 모바일 반응형 (375px 기준) 레이아웃 정상

---

## Phase 2: 공공데이터 API 실제 연동 ✅

**완료일**: 2026-02-25

**목표**: 실제 공공데이터 기반 공개 섹션 데이터 표시.

### 구현 항목
- [x] `app/api/public-data/route.ts` 구현
  - [x] 카카오 로컬 API — 주소→위경도, 집객시설 탐색
  - [x] 소상공인 상가정보 API — 경쟁점 수
  - [x] 통계청 SGIS API — 인구통계
  - [ ] 대중교통 승하차 API — 유동인구 피크 타임
  - [x] 주차장 표준데이터 — 인근 주차장 정보
- [x] API Key 환경변수 세팅 (.env.local)
- [x] 에러 핸들링 (API 실패 시 Mock 데이터 폴백)

---

## Phase 3: Gemini AI 리포트 생성 ✅

**완료일**: 2026-02-25

**목표**: 공공데이터를 Gemini에 주입하여 locked_data JSON 생성.

### 구현 항목
- [x] `app/api/report/route.ts` 구현
  - [x] 공공데이터 집계 결과를 Gemini 프롬프트에 주입
  - [x] 시스템 프롬프트 고정 (CLAUDE.md 참조)
  - [x] JSON 응답 파싱 + 마크다운 백틱 전처리
- [x] `GEMINI_API_KEY` 환경변수 세팅
- [ ] `report_cache` 테이블 활용한 24시간 캐싱 *(Phase 5 범위로 이동)*

---

## Phase 4: Spring Boot 리드 저장 + 알림톡 ✅

**완료일**: 2026-02-25

**목표**: 모달 제출 시 리드 DB 저장 및 카카오 알림톡 발송.

### 구현 항목
- [x] Spring Boot 프로젝트 초기화 (`backend/`)
- [x] MySQL 연동 (JPA/Hibernate)
- [x] `POST /api/v1/leads` 엔드포인트 구현
  - [x] 입력값 검증 (Bean Validation)
  - [x] leads 테이블 INSERT
  - [x] 알림톡 발송 (솔라피 API)
- [x] CORS 설정 (Next.js → Spring Boot)
- [x] Next.js `app/api/leads/route.ts` → Spring Boot 중계 구현

### 완료 조건
- [x] 모달 제출 → DB 리드 저장 확인
- [x] 카카오 알림톡 수신 확인 (솔라피 미설정 시 skip 후 정상 저장)
- [x] Spring Boot 단위 테스트 통과 (`./mvnw test` H2 in-memory DB)

---

## Phase 5: AI 챗봇 + 캐시 최적화 ✅

**완료일**: 2026-02-25

**목표**: 잠금 해제 후 Floating Chatbot 활성화.

### 구현 항목
- [x] `FloatingChatbot.tsx` 컴포넌트 구현
  - [x] `isUnlocked === true` 시에만 표시
  - [x] Quick Reply 칩 (빠른 질문 버튼)
  - [ ] 대화 이력 → `chatbot_messages` 테이블 저장
- [x] `app/api/chat/route.ts` — Gemini 대화 연속성 관리
- [x] report_cache 24시간 캐싱 적용 (Spring Boot: `ReportCache`, `ReportCacheService`, `CacheController`)

---

## Phase 6: 실 API 데이터 연동 + 지역별 리포트 ✅

**완료일**: 2026-02-25

**목표**: FALLBACK 목 값 제거, 실제 API 데이터만 Gemini 주입. 서울/경기/기타 3개 지역별 프롬프트 분기.

### 구현 항목
- [x] `lib/types.ts` — `Region` 타입 추가 (`'seoul' | 'gyeonggi' | 'other'`)
- [x] `lib/public-apis.ts` — 8개 함수 FALLBACK → `null` 반환, `detectRegion` export
- [x] `app/api/public-data/route.ts` — `settledOrMissing` + `buildEmptyResponse` + region 추가
- [x] `lib/gemini.ts` — `buildGeminiSystemPrompt(region)` 3개 버전 (서울/경기/기타)
- [x] `app/api/report/route.ts` — region 수신 → 프롬프트 분기 적용
- [x] `app/(routes)/report/[address]/page.tsx` — public-data 응답에서 region 추출 전달
- [x] `components/report/PublicSection.tsx` — `ExtendedInsights` 추가 인사이트 섹션
- [x] API Key 미설정 시 전 필드 `"데이터 없음"` 처리, 리포트 생성 계속 동작

### 완료 조건
- [x] `npm run lint` — 에러 0개
- [x] `npm run build` — 성공
- [x] `verify-implementation` → `verify-nextjs` 7개 항목 전체 PASS

---

## Phase 6 고도화: 공공 API 실연동 복구 + UI 품질 보강 ✅

**완료일**: 2026-02-26

**목표**: null 고정 함수 실연동 복구, Gemini 타임아웃 버그 수정, 공개 섹션 UI 고도화.

### 구현 항목
- [x] `lib/public-apis.ts` — `fetchEstimatedRevenue`, `fetchCommercialTrend`, `fetchFranchiseRevenue`, `fetchOpenCloseStats`, `fetchFranchiseChanges` 실연동 복구 (null 고정 → 실제 공공데이터 연동)
- [x] `lib/public-apis.ts` — `geocode()` 보정: `adm_cd` 없을 때 `sido_cd + sgg_cd` 조합 fallback
- [x] `lib/public-apis.ts` — `RULES` 카테고리 매칭 다중 확장 (카페/음식/교육/의료/유통/부동산/숙박)
- [x] `lib/public-apis.ts` — `commercial_trend`, `franchise_changes` 전분기 비교 불가 시 대체 계산 + "전분기 비교 데이터 부족" 문구
- [x] `app/(routes)/report/[address]/ReportClient.tsx` — Gemini 호출 클라이언트 이동 (서버 타임아웃 버그 수정): `useEffect` + `/api/report` fetch
- [x] `app/(routes)/report/[address]/page.tsx` — Gemini 호출 제거, `region` prop 전달, 빠른 초기 렌더링
- [x] `components/report/PublicSection.tsx` — 공개 리포트 요약 가독성 보강, SGIS 금칙어 치환, "실행 우선순위" → "권장 실행" 문구 통일
- [x] `app/api/report/route.ts` — 요약 품질 보강 (최소 길이/문장 수 보장, fallback summary 강화)
- [x] `app/api/public-data/route.ts` — SGIS 토큰 만료 시 retry 로직 추가

### 완료 조건
- [x] `npm run lint` — 에러 0개
- [x] `npm run build` — 성공 (10개 라우트)
- [x] `verify-nextjs` 7개 항목 전체 PASS
- [x] 코드 리뷰 6개 기준 전체 PASS (any 0건, API Key 보안, 블러 패턴, isUnlocked 흐름)

---

## Phase 6 고도화 2차: 매출 로직 보정 + 심화 분석 UI 고도화 ✅

**완료일**: 2026-02-26

**목표**: 서울 점포당 매출 정밀 보정, 리포트 요약 품질 강화, 심화 분석 UI 진단 카드/스파크라인 추가, 한글 인코딩 안전화.

### 구현 항목
- [x] `lib/public-apis.ts` — 점포당 매출 정밀 계산 (`seoulPerStoreRevenue`, `buildSeoulStoreCountIndex`, `seoulTradeIndustryKey`)
- [x] `lib/public-apis.ts` — TTL 기반 인메모리 캐시 (`CacheEntry<T>`, `getCached`, `setCached`)
- [x] `lib/public-apis.ts` — 주소 범위 필터링 (`filterRowsByAddress`, `addressHints`, `locationTextFromRow`)
- [x] `lib/public-apis.ts` — `fetchSgisAgeDistribution` 연령대별 전체 밴드 반환 (10대~70대이상)
- [x] `lib/public-apis.ts` — `fetchSgisIndustryTop` 비율 중복 제거 + `name(ratio%)` 형식
- [x] `lib/public-apis.ts` — 함수 시그니처 보정: `fetchCommercialTrend(admCd, businessType, address)`, `fetchOpenCloseStats(..., businessType)`, `fetchFranchiseChanges(admCd, businessType, address)`
- [x] `lib/gemini.ts` — 기본 모델 `gemini-2.5-pro` 변경, `TERM_STYLE_GUIDE` 상수 주입
- [x] `app/api/report/route.ts` — 캐시 버전 `report-v4`, `hashString` payload 핑거프린트, 요약 품질 필터 보강 (`isNumericOnlySentence`, `hasFragmentedSummary`, `stripNumericOnlySentences`)
- [x] `app/api/report/route.ts` — `normalizeInlineText`: "예상 월 매출" → "유사 업종 월 매출 참고치" 치환
- [x] `app/api/chat/route.ts` — `gemini-2.5-flash` 기본 모델, `withTimeout()` 래퍼, 연속 동일 role 메시지 정규화
- [x] `components/report/LockedSection.tsx` — 진단 카드 4종 (상권 안정성/경쟁 부담도/임대 효율/수요·접근 적합도) + 점수 바 + `Sparkline` SVG 컴포넌트
- [x] `components/report/LockedSection.tsx` — KR 상수 객체 Unicode 이스케이프 처리 (한글 깨짐 방지)
- [x] `components/report/PublicSection.tsx` — 소수점 보호 (`DECIMAL_DOT_PLACEHOLDER`), 숫자 단독 문장 필터
- [x] `app/(routes)/report/[address]/ReportClient.tsx` — `LockedSection`에 `context` prop 전달 (public_metrics, raw_locked_inputs, extended_insights, store_basic_info)
- [x] `app/api/public-data/route.ts`, `app/api/debug/public-data/route.ts` — 변경된 함수 시그니처 동기화

### 완료 조건
- [x] `npm run lint` — 에러 0개
- [x] `npm run build` — 성공 (10개 라우트)
- [x] `verify-nextjs` 8개 항목 전체 PASS
- [x] 코드 리뷰 6개 기준 전체 PASS (any 0건, API Key 보안, 블러 패턴, isUnlocked 흐름)

---

## Phase 7: 배포 + nsajang.com 연동 🔄

**목표**: 프로덕션 배포 및 nsajang.com 트래픽 연동.

### 코드 정리 (완료)
- [x] UTM 추적 전체 제거 — 단일 내부 유입 경로로 불필요 판단 (8개 파일)
- [x] `WebConfig.java` — `nsajang.com`, `www.nsajang.com` CORS 제거 (BFF 패턴으로 불필요, `localhost:3000` 유지)
- [x] `HealthController.java` — `GET /api/health` 유지 (Railway/AWS 컨테이너 헬스 모니터링용)

### 배포 (미완료)
- [ ] Next.js → Vercel 배포
- [ ] Spring Boot → Railway 또는 AWS EC2 배포
- [ ] MySQL → AWS RDS 또는 PlanetScale
- [ ] 도메인 연동 (nsajang.com/report/...)
- [ ] 솔라피 API 키 발급 후 알림톡 활성화
- [ ] 토스(Toss) 금융 생태계 연동 준비 (결제/대출 상품 연결 PoC)
