# ARCHITECTURE.md — 내일사장 상권분석 AI 컨설턴트

시스템 구조, 폴더 구조, 데이터 흐름, API 연동 명세를 정의한다.

---

## 프로젝트 개요

**내일사장(nsajang.com)** 의 트래픽을 활용한 소상공인/예비 창업자 리드 수집 퍼널.

- 100% 무료 공공데이터 + Gemini AI로 상권분석 리포트 자동 생성
- 핵심 정보(매출/폐업률/전략)는 Blur 처리 → 이름/연락처 입력 시 잠금 해제
- 잠금 해제 시 카카오 알림톡 발송 + AI 챗봇 대화 전환

---

## Tech Stack

| 영역 | 기술 | 버전 |
|------|------|------|
| Frontend & BFF | Next.js (App Router) | 14.0.0 |
| UI Framework | React | 18.2.0 |
| Styling | Tailwind CSS | latest |
| Backend | Spring Boot | 3.1.5 |
| Language (BE) | Java | 17 |
| ORM | JPA / Hibernate | Spring Boot 관리 |
| Database | MySQL | 8.3.0 |
| LLM Engine | Google Gemini API | gemini-1.5-flash |
| 알림톡 | 솔라피(Solapi) 또는 알리고 | latest |

---

## 전체 시스템 아키텍처

```
[브라우저 / 모바일]
    │
    │  GET /report/{address}
    ▼
[Next.js 14 - App Router]  ← Frontend & BFF
    │
    ├── Server Component: 초기 공공데이터 패치 (SSR)
    │       └── app/api/public-data/route.ts
    │               ├── 카카오 로컬 API (위경도 변환, 집객시설)
    │               ├── 소상공인 상가정보 API (경쟁점 수)
    │               ├── 통계청 SGIS API (인구통계)
    │               └── 대중교통 승하차 API (유동인구)
    │
    ├── Client Component (ReportClient.tsx): isUnlocked 상태 관리
    │
    ├── app/api/report/route.ts ← Gemini API 호출 (API Key 은닉)
    │       └── Google Gemini (gemini-1.5-flash) → JSON 리포트 생성
    │
    └── app/api/leads/route.ts ← Lead 수집 중계
            │
            │  POST /api/v1/leads
            ▼
    [Spring Boot 3.1.5]  ← Core Backend
            │
            ├── LeadController → LeadService → LeadRepository → MySQL 8.3.0
            └── AlimtalkService → 솔라피 API → 카카오 알림톡 발송
```

---

## 폴더 구조

```
aireport/
├── frontend/                    # Next.js 14 프로젝트
│   ├── app/
│   │   ├── layout.tsx           # Root Layout
│   │   ├── page.tsx             # 랜딩 페이지 (주소 입력)
│   │   ├── (routes)/
│   │   │   └── report/
│   │   │       └── [address]/
│   │   │           ├── page.tsx          # 서버 컴포넌트 (초기 데이터 패치)
│   │   │           └── ReportClient.tsx  # 클라이언트 컴포넌트 (isUnlocked)
│   │   └── api/
│   │       ├── public-data/
│   │       │   └── route.ts     # 공공데이터 집계 API
│   │       ├── report/
│   │       │   └── route.ts     # Gemini AI 리포트 생성 API
│   │       └── leads/
│   │           └── route.ts     # Spring Boot 리드 중계 API
│   ├── components/
│   │   ├── report/
│   │   │   ├── PublicSection.tsx      # 공개 데이터 섹션
│   │   │   ├── LockedSection.tsx      # 블러 처리 잠금 섹션
│   │   │   ├── UnlockCTA.tsx          # 잠금 해제 CTA 버튼
│   │   │   └── ReportSkeleton.tsx     # 로딩 스켈레톤 UI
│   │   ├── modal/
│   │   │   └── LeadCaptureModal.tsx   # 이름/연락처 입력 모달
│   │   └── chatbot/
│   │       └── FloatingChatbot.tsx    # 하단 고정 AI 챗봇
│   ├── lib/
│   │   ├── gemini.ts            # Gemini 클라이언트 초기화
│   │   ├── public-apis.ts       # 공공데이터 API 호출 함수
│   │   └── types.ts             # 공통 TypeScript 타입 정의
│   ├── .env.local               # 환경변수 (git 제외)
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── backend/                     # Spring Boot 3.1.5 프로젝트
│   ├── src/main/java/com/nsajang/aireport/
│   │   ├── AireportApplication.java
│   │   ├── controller/
│   │   │   └── LeadController.java
│   │   ├── service/
│   │   │   ├── LeadService.java
│   │   │   └── AlimtalkService.java
│   │   ├── repository/
│   │   │   └── LeadRepository.java
│   │   ├── entity/
│   │   │   └── Lead.java
│   │   ├── dto/
│   │   │   ├── LeadRequestDto.java
│   │   │   └── LeadResponseDto.java
│   │   └── config/
│   │       └── WebConfig.java   # CORS 설정
│   ├── src/main/resources/
│   │   └── application.yml      # DB, 알림톡 설정
│   └── pom.xml
│
├── CLAUDE.md
├── AGENTS.md
├── ARCHITECTURE.md
├── SCHEMA.md
├── ROADMAP.md
├── handoff.md
└── CHANGELOG.md
```

---

## 핵심 UX 플로우

```
1. 진입
   사용자 접속 → /report/{address}
   → 스켈레톤 UI 표시 (로딩 중)
   → 서버사이드에서 공공데이터 패치 + Gemini 리포트 생성

2. 티저 영역 (공개)
   - 유동인구 피크 타임
   - 주요 타겟 연령/성별
   - 경쟁점 수
   - 주차장 정보, 집객 시설

3. 잠금 영역 (블러)
   - 추정 월 평균 매출액 ← blur(8px)
   - 위험/기회 분석 ← blur(8px)
   - AI 3단계 액션 플랜 ← blur(8px)
   - [🔒 이름/연락처 입력하고 핵심 리포트 원본 보기] CTA

4. 리드 수집 모달
   - 이름 / 전화번호 입력
   - 제출 → Next.js /api/leads → Spring Boot POST /api/v1/leads

5. 잠금 해제
   - 200 OK → isUnlocked = true → 블러 제거
   - FloatingChatbot 활성화
   - 알림톡 발송 (리포트 URL 포함)
```

---

## 공공데이터 API 연동 명세

| API | 목적 | 키 관리 |
|-----|------|---------|
| 카카오 로컬 API | 주소→위경도 변환, 집객시설 탐색 | `KAKAO_LOCAL_API_KEY` (서버) |
| 소상공인 상가정보 API | 반경 내 업종별 경쟁점 수 | `SGIS_API_KEY` (서버) |
| 통계청 SGIS API | 격자 단위 인구통계 (연령/성별) | `SGIS_API_KEY` (서버) |
| 전국 주차장 표준데이터 | 인근 주차장 여부 및 면수 | 공개 데이터 (인증 불필요) |
| 대중교통 승하차 API | 시간대별 하차 인원 | `TRANSIT_API_KEY` (서버) |
| 지자체 상권분석 API (서울/경기) | 추정 매출액, 평균 임대료 | `COMMERCIALAREA_API_KEY` (서버) |
| 국토부 실거래가 API | 평당 임대료 | `MOLIT_API_KEY` (서버) |
| 지방행정인허가 API | 최근 3개월 개/폐업 추이 | `LOCALDATA_API_KEY` (서버) |
| Google Gemini API | AI 리포트 생성 | `GEMINI_API_KEY` (서버) |

---

## Gemini Output JSON Schema

```json
{
  "summary": "상권 종합 진단 2~3문장",
  "public_metrics": {
    "peak_time": "가장 붐비는 시간대",
    "main_target": "주요 소비 연령/성별 (비율%)",
    "competitor_count": "경쟁점 개수"
  },
  "locked_data": {
    "estimated_revenue": "추정 월 평균 매출액 (숫자 만원)",
    "risk_alert": "최근 폐업률 등 팩트 기반의 위협/경고 1문장",
    "top_3_strategies": [
      {
        "title": "전략 타이틀",
        "description": "구체적인 실행 방안 및 솔루션"
      }
    ]
  }
}
```

---

## 환경변수 목록 (.env.local)

```bash
# Gemini
GEMINI_API_KEY=

# 공공데이터 API Keys (서버 전용)
KAKAO_LOCAL_API_KEY=
SGIS_API_KEY=
TRANSIT_API_KEY=
COMMERCIALAREA_API_KEY=
MOLIT_API_KEY=
LOCALDATA_API_KEY=

# Spring Boot 백엔드 URL
SPRING_BOOT_URL=http://localhost:8080

# 알림톡 (Spring Boot application.yml에서 관리)
# SOLAPI_API_KEY, SOLAPI_API_SECRET, KAKAO_CHANNEL_ID
```
