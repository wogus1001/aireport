# CLAUDE.md — 내일사장 상권분석 AI 컨설턴트

> 전역 규칙(`~/.claude/CLAUDE.md`)이 먼저 적용된다. 이 파일은 aireport 프로젝트 전용 규칙을 담는다.

## Skills

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, CLAUDE.md를 관리합니다 |
| `verify-nextjs` | Next.js 보안 규칙 및 코딩 컨벤션을 검증합니다 (API Key 보안, CORS, isUnlocked 패턴, any 금지) |

## 참조 문서

| 문서 | 내용 |
|------|------|
| `ARCHITECTURE.md` | 시스템 구조, 폴더 구조, 데이터 흐름, API 연동 명세 |
| `SCHEMA.md` | MySQL 테이블 상세, 관계도, 인덱스 |
| `ROADMAP.md` | Phase별 개발 계획 및 진행 현황 |
| `AGENTS.md` | 역할 분담, 워크플로우, Learned Constraints |
| `handoff.md` | 현재 상태, TODO, 알려진 이슈 |
| `CHANGELOG.md` | 완료 작업 이력 |

---

## Commands

```bash
# === Next.js (Frontend + BFF) ===
cd frontend
npm install
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint 검사

# === Spring Boot (Backend) ===
cd backend
./mvnw spring-boot:run   # 개발 서버 (localhost:8080)
./mvnw test              # 테스트 실행
./mvnw package           # JAR 빌드

# === DB ===
# MySQL 8.3.0 로컬 실행 (Docker 권장)
docker run --name aireport-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=aireport -p 3306:3306 -d mysql:8.3.0
```

---

## Next.js 14 코드 패턴

### App Router 라우팅 구조

```
app/
  (routes)/
    report/
      [address]/
        page.tsx        # 서버 컴포넌트 — 초기 데이터 패치
        ReportClient.tsx # 클라이언트 컴포넌트 — isUnlocked 상태 관리
  api/
    report/route.ts     # Gemini API 호출 (API Key 은닉)
    leads/route.ts      # Spring Boot로 리드 데이터 중계
    public-data/route.ts # 공공데이터 API 집계 (API Key 은닉)
```

### 핵심 상태 관리 패턴

```tsx
// ReportClient.tsx — 클라이언트 컴포넌트
'use client';
const [isUnlocked, setIsUnlocked] = useState(false);

// 블러 처리 패턴
<div className={isUnlocked ? '' : 'blur-sm pointer-events-none select-none'}>
  {/* 잠금 영역 컨텐츠 */}
</div>
```

### API Route 패턴 (API Key 은닉)

```ts
// app/api/report/route.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  // ... Gemini 호출
  return Response.json(result);
}
```

### 환경변수 규칙

- `NEXT_PUBLIC_` prefix: 브라우저 노출 허용 (카카오 로컬 API App Key 등)
- prefix 없음: 서버사이드 전용 (Gemini API Key, Spring Boot URL 등)

---

## Spring Boot 코드 패턴

### 패키지 구조

```
com.nsajang.aireport/
  controller/   # LeadController.java
  service/      # LeadService.java, AlimtalkService.java
  repository/   # LeadRepository.java (JPA)
  entity/       # Lead.java
  dto/          # LeadRequestDto.java, LeadResponseDto.java
```

### Lead API 패턴

```java
// POST /api/v1/leads
@PostMapping("/leads")
public ResponseEntity<LeadResponseDto> createLead(@Valid @RequestBody LeadRequestDto dto) {
    LeadResponseDto response = leadService.saveLead(dto);
    return ResponseEntity.ok(response);
}
```

---

## Gemini 시스템 프롬프트 (고정)

Next.js API Route에서 Gemini 호출 시 반드시 아래 시스템 프롬프트를 주입.
JSON 형식으로만 응답받도록 강제:

```
[Role]
너는 대한민국 최고의 소상공인 상권분석 전문가야.
주어진 상권의 Raw 데이터(인구, 상가 수, 임대료, 폐업률 등)를 분석해
사장님이 즉시 실행 가능한 마케팅/영업 전략을 도출해.

[Task & Rules]
반드시 아래 지정된 JSON 형식으로만 출력해.
마크다운 백틱(```json)이나 다른 부연 설명은 절대 금지.
```

출력 JSON 구조는 ARCHITECTURE.md의 Gemini Output Schema 참조.

---

## 코드 컨벤션

### Next.js / TypeScript

| 대상 | 규칙 | 예시 |
|------|------|------|
| 파일명 (컴포넌트) | PascalCase | `ReportCard.tsx` |
| 파일명 (유틸/훅) | camelCase | `useUnlock.ts` |
| 인터페이스명 | PascalCase + I prefix 금지 | `ReportData`, `LeadPayload` |
| API Route | 폴더명 소문자, 파일명 `route.ts` | `app/api/leads/route.ts` |
| 환경변수 | SCREAMING_SNAKE_CASE | `GEMINI_API_KEY` |

### Spring Boot / Java

| 대상 | 규칙 |
|------|------|
| 클래스명 | PascalCase |
| 메서드/변수명 | camelCase |
| DTO | suffix `Dto` |
| Entity | suffix 없음 (예: `Lead`) |
| 패키지명 | 소문자 |

---

## 파일 소유권

### Codex 수정 허용

| 경로 | 조건 |
|------|------|
| `frontend/app/**` | 자유롭게 수정 |
| `frontend/components/**` | 자유롭게 수정 |
| `frontend/lib/**` | 자유롭게 수정 |
| `backend/src/**` | 자유롭게 수정 |
| `frontend/package.json` | Claude Code 사전 승인 후에만 |
| `backend/pom.xml` | Claude Code 사전 승인 후에만 |

### Codex 수정 금지 (Claude Code 전용)

| 경로 | 이유 |
|------|------|
| `*.md` (모든 마크다운) | 문서 일관성 유지 |
| `.claude/skills/**` | 스킬 시스템 관리 |

> **Codex 구현 지시사항은 `handoff.md`의 `Codex 구현 스펙` 섹션에서만 읽는다.**

---

## Learned Constraints

- **API Key 보안**: 모든 외부 API Key는 Next.js Route Handler 또는 Server Action을 통해서만 호출. 클라이언트 직접 호출 금지.
- **블러 해제**: `isUnlocked` 상태는 Spring Boot `/api/v1/leads` 200 OK 응답 후에만 `true`로 변경. 클라이언트 임의 조작 불가 구조로 설계.
- **Gemini 응답**: 반드시 JSON.parse() 전 응답 텍스트에서 마크다운 백틱 제거 전처리 필요 (`text.replace(/```json|```/g, '').trim()`).
- **공공 API CORS**: 공공데이터포털 API는 브라우저에서 직접 호출 시 CORS 오류. 반드시 Next.js Route Handler 경유.
- **TypeScript**: 명시적 타입 정의 필수. `any` 사용 금지.
- **Spring Boot CORS**: Next.js(localhost:3000) → Spring Boot(localhost:8080) 개발환경 CORS 설정 필수 (`@CrossOrigin` 또는 `WebMvcConfigurer`).
- *(새 제약 발견 시 즉시 추가)*
