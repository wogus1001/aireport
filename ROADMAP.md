# ROADMAP.md — 내일사장 상권분석 AI 컨설턴트

Phase별 개발 계획 및 진행 현황.

---

## 전체 Phase 개요

| Phase | 기능 | 상태 |
|-------|------|------|
| Phase 0 | 프로젝트 셋업 + 문서 체계 | ✅ 완료 |
| Phase 1 | UI 뼈대 + Mock 데이터 연동 | 📋 계획 |
| Phase 2 | 공공데이터 API 실제 연동 | 📋 계획 |
| Phase 3 | Gemini AI 리포트 생성 연동 | 📋 계획 |
| Phase 4 | Spring Boot 리드 저장 + 알림톡 | 📋 계획 |
| Phase 5 | AI 챗봇 + 리포트 캐시 | 📋 계획 |
| Phase 6 | 배포 + nsajang.com 연동 | 📋 계획 |

---

## Phase 0: 프로젝트 셋업 ✅

**완료일**: 2026-02-24

### 완료 항목
- [x] 프로젝트 요구사항 분석 및 아키텍처 확정
- [x] 문서 체계 구축 (CLAUDE.md, ARCHITECTURE.md, SCHEMA.md, ROADMAP.md, AGENTS.md, handoff.md, CHANGELOG.md)
- [x] 기술 스택 확정 (Next.js 14 + Spring Boot 3.1.5 + MySQL 8.3.0 + Gemini)
- [x] MCP 설정 (.mcp.json 구성)

---

## Phase 1: UI 뼈대 + Mock 데이터 📋

**목표**: isUnlocked 상태 기반 블러/언블러 UI 완성. 데이터는 Mock JSON 사용.

### 구현 항목
- [ ] Next.js 14 프로젝트 초기화 (`frontend/`)
- [ ] Tailwind CSS 설정 (모바일 미니앱 최적화)
- [ ] `app/(routes)/report/[address]/page.tsx` — 서버 컴포넌트
- [ ] `ReportClient.tsx` — `isUnlocked` 상태 관리 클라이언트 컴포넌트
- [ ] `PublicSection.tsx` — 공개 데이터 카드 UI (유동인구, 경쟁점, 집객시설)
- [ ] `LockedSection.tsx` — 블러 처리 UI (매출, 위험분석, 전략)
- [ ] `UnlockCTA.tsx` — 🔒 CTA 버튼
- [ ] `LeadCaptureModal.tsx` — 이름/전화번호 입력 모달
- [ ] `ReportSkeleton.tsx` — 로딩 스켈레톤 UI
- [ ] Mock JSON으로 전체 화면 렌더링 확인

### 완료 조건
- [ ] 블러 처리 영역이 CSS `backdrop-filter: blur(8px)` 또는 Tailwind `blur-sm`으로 정확히 적용
- [ ] 모달 열기/닫기 동작 정상
- [ ] Mock 제출 시 `isUnlocked = true` 전환 및 블러 해제
- [ ] 모바일 반응형 (375px 기준) 레이아웃 정상

---

## Phase 2: 공공데이터 API 실제 연동 📋

**목표**: 실제 공공데이터 기반 공개 섹션 데이터 표시.

### 구현 항목
- [ ] `app/api/public-data/route.ts` 구현
  - [ ] 카카오 로컬 API — 주소→위경도, 집객시설 탐색
  - [ ] 소상공인 상가정보 API — 경쟁점 수
  - [ ] 통계청 SGIS API — 인구통계
  - [ ] 대중교통 승하차 API — 유동인구 피크 타임
  - [ ] 주차장 표준데이터 — 인근 주차장 정보
- [ ] API Key 환경변수 세팅 (.env.local)
- [ ] 에러 핸들링 (API 실패 시 Mock 데이터 폴백)

---

## Phase 3: Gemini AI 리포트 생성 📋

**목표**: 공공데이터를 Gemini에 주입하여 locked_data JSON 생성.

### 구현 항목
- [ ] `app/api/report/route.ts` 구현
  - [ ] 공공데이터 집계 결과를 Gemini 프롬프트에 주입
  - [ ] 시스템 프롬프트 고정 (CLAUDE.md 참조)
  - [ ] JSON 응답 파싱 + 마크다운 백틱 전처리
- [ ] `GEMINI_API_KEY` 환경변수 세팅
- [ ] `report_cache` 테이블 활용한 24시간 캐싱

---

## Phase 4: Spring Boot 리드 저장 + 알림톡 📋

**목표**: 모달 제출 시 리드 DB 저장 및 카카오 알림톡 발송.

### 구현 항목
- [ ] Spring Boot 프로젝트 초기화 (`backend/`)
- [ ] MySQL 연동 (JPA/Hibernate)
- [ ] `POST /api/v1/leads` 엔드포인트 구현
  - [ ] 입력값 검증 (Bean Validation)
  - [ ] leads 테이블 INSERT
  - [ ] 알림톡 발송 (솔라피 API)
- [ ] CORS 설정 (Next.js → Spring Boot)
- [ ] Next.js `app/api/leads/route.ts` → Spring Boot 중계 구현

### 완료 조건
- [ ] 모달 제출 → DB 리드 저장 확인
- [ ] 카카오 알림톡 수신 확인
- [ ] Spring Boot 단위 테스트 통과

---

## Phase 5: AI 챗봇 + 캐시 최적화 📋

**목표**: 잠금 해제 후 Floating Chatbot 활성화.

### 구현 항목
- [ ] `FloatingChatbot.tsx` 컴포넌트 구현
  - [ ] `isUnlocked === true` 시에만 표시
  - [ ] Quick Reply 칩 (빠른 질문 버튼)
  - [ ] 대화 이력 → `chatbot_messages` 테이블 저장
- [ ] `app/api/chat/route.ts` — Gemini 대화 연속성 관리
- [ ] report_cache 24시간 캐싱 적용

---

## Phase 6: 배포 + nsajang.com 연동 📋

**목표**: 프로덕션 배포 및 nsajang.com 트래픽 연동.

### 구현 항목
- [ ] Next.js → Vercel 배포
- [ ] Spring Boot → AWS EC2 또는 Railway 배포
- [ ] MySQL → AWS RDS 또는 PlanetScale
- [ ] 도메인 연동 (nsajang.com/report/...)
- [ ] UTM 파라미터 추적 세팅
- [ ] 토스(Toss) 금융 생태계 연동 준비 (결제/대출 상품 연결 PoC)
