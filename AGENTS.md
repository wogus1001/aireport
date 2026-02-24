# AGENTS.md — 내일사장 상권분석 AI 컨설턴트

에이전트 역할 분담, 워크플로우, 검증 기준, Learned Constraints를 정의한다.
세부 기술 규칙은 `CLAUDE.md`, 시스템 구조는 `ARCHITECTURE.md`, DB는 `SCHEMA.md`를 참조.

---

## 파일 소유권

### Claude Code 전용 (Read/Write)

> 이 파일들은 Claude Code만 수정한다. AI 코딩 에이전트(Codex 등)는 절대 수정 금지.

| 파일 | 용도 |
|------|------|
| `~/.claude/CLAUDE.md` | 전역 규칙·워크플로우 |
| `CLAUDE.md` | 프로젝트 규칙·코드 컨벤션·패턴 |
| `AGENTS.md` | 역할 분담·Learned Constraints |
| `handoff.md` | 세션 인수인계·구현 스펙 |
| `ARCHITECTURE.md` | 시스템 구조·폴더 구조·API 명세 |
| `SCHEMA.md` | DB 스키마·DDL |
| `ROADMAP.md` | Phase별 개발 계획 |
| `CHANGELOG.md` | 완료 이력 |
| `.claude/skills/**` | 스킬 파일 |

### 구현 에이전트 전용 (Read/Write)

| 파일 | 용도 |
|------|------|
| `frontend/app/**` | Next.js 앱 코드 |
| `frontend/components/**` | React 컴포넌트 |
| `frontend/lib/**` | 유틸리티, 타입 정의 |
| `backend/src/**` | Spring Boot 소스 |
| `frontend/package.json` | 패키지 의존성 (추가 전 Claude Code 승인) |
| `backend/pom.xml` | Maven 의존성 (추가 전 Claude Code 승인) |

### 상호작용 (Cross-Reference)

| 파일 | Claude Code | 구현 에이전트 |
|------|-------------|--------------|
| `handoff.md` | ✅ Write | 📖 Read — `구현 스펙` 섹션만 |
| `ARCHITECTURE.md` | ✅ Write | 📖 Read — 폴더 구조·패턴 파악 |
| `SCHEMA.md` | ✅ Write | 📖 Read — DB 테이블·컬럼 파악 |
| `CLAUDE.md` | ✅ Write | 📖 Read — 코드 컨벤션·패턴 파악 |
| `frontend/app/**` | 📖 Read | ✅ Write |
| `backend/src/**` | 📖 Read | ✅ Write |

---

## 역할 분담

| 작업 | Claude Code | 구현 에이전트 |
|------|-------------|--------------|
| 아키텍처 설계 | ✅ | ❌ |
| API 명세 작성 | ✅ | ❌ |
| 모든 `.md` 문서 수정 | ✅ | ❌ 절대 금지 |
| DB 마이그레이션 실행 | ✅ (MCP 또는 직접) | ❌ |
| Next.js 컴포넌트 구현 | ❌ | ✅ |
| Spring Boot API 구현 | ❌ | ✅ |
| 패키지/의존성 추가 | ❌ (승인만) | ✅ (승인 후) |
| 코드 리뷰 | ✅ | ❌ |
| 버그 분석 | ✅ | ❌ |
| Gemini 프롬프트 설계 | ✅ | ❌ |

---

## 워크플로우

```
Plan → Implement → Verify → Simplify
```

### Plan (Claude Code)
1. `handoff.md` 읽어 현재 Phase 및 이슈 파악
2. `ARCHITECTURE.md` / `SCHEMA.md` 참조하여 설계
3. 구현 스펙 작성 (파일 경로, 컴포넌트명, API 경로, 메서드 시그니처 포함)
4. 구현 에이전트에게 스펙 전달

### Implement (구현 에이전트)
1. Claude Code가 작성한 스펙대로만 구현
2. 스펙에 없는 파일/기능 임의 추가 금지
3. 새 패키지/의존성 추가 시 Claude Code 먼저 승인 요청

### Verify (Claude Code)
1. `npm run lint` 실행 — ESLint 에러 0개 확인
2. `npm run build` 실행 — 빌드 성공 확인
3. `./mvnw test` 실행 — Spring Boot 테스트 통과
4. Playwright로 UI 동작 시각 확인 (isUnlocked 블러/언블러)
5. `/manage-skills` 실행 — verify 스킬 업데이트

### Simplify
- 구현 후 불필요한 추상화, 중복 코드 제거
- `any` 타입 제거, 명시적 타입 보강

---

## 검증 기준

### Frontend (Next.js)

```bash
cd frontend
npm run lint    # ESLint 에러 0개
npm run build   # 빌드 성공 (타입 에러 없음)
```

### Backend (Spring Boot)

```bash
cd backend
./mvnw test     # 테스트 통과
./mvnw package  # JAR 빌드 성공
```

### 핵심 체크리스트

- [ ] `isUnlocked` 상태가 Spring Boot 200 OK 응답 후에만 true 전환
- [ ] 모든 외부 API Key가 서버사이드에서만 사용됨 (브라우저 노출 없음)
- [ ] Gemini 응답이 JSON.parse() 전 백틱 전처리 적용됨
- [ ] 공공데이터 API CORS 오류 없음 (Route Handler 경유 확인)
- [ ] TypeScript `any` 타입 없음
- [ ] `.env.local` 파일 미커밋 확인

---

## 문서 동기화 규칙

| 상황 | 업데이트 대상 |
|------|---------------|
| 새 폴더/파일 추가 | `ARCHITECTURE.md` |
| DB 테이블/컬럼 변경 | `SCHEMA.md` |
| 새 공공 API 추가 | `ARCHITECTURE.md` 연동 명세 |
| Phase 완료 | `ROADMAP.md` + `CHANGELOG.md` |
| 세션 종료 | `handoff.md` |
| 새 제약 발견 | `AGENTS.md` + `CLAUDE.md` Learned Constraints |

---

## Learned Constraints

> 개발 중 발견된 제약사항. 새 제약 발견 시 즉시 추가.

### Next.js 14 제약
- Server Component와 Client Component 혼용 시 `'use client'` 경계 명확히 구분
- `useState`, `useEffect` 등 React hooks는 Client Component에서만 사용 가능
- API Key 노출 위험: `NEXT_PUBLIC_` prefix 붙은 변수는 브라우저에 노출됨 — 민감 키에 절대 사용 금지

### 공공데이터 API 제약
- 공공데이터포털 API는 브라우저 직접 호출 시 CORS 오류 → Next.js Route Handler 경유 필수
- 일부 API는 일일 호출 횟수 제한 있음 → report_cache로 반드시 캐싱

### Spring Boot 제약
- Next.js 개발서버(localhost:3000) → Spring Boot(localhost:8080) CORS 설정 필수
- `@Valid` 어노테이션 없으면 Bean Validation 미동작

### Gemini API 제약
- 응답에 마크다운 백틱(` ```json `)이 포함될 수 있음 → `JSON.parse()` 전 전처리 필수
- `gemini-1.5-flash` 모델 사용 (비용 최적화)

### 보안 제약
- `isUnlocked` 상태를 클라이언트 임의 조작으로 해제할 수 없도록 실제 API 응답 기반으로만 전환
- 리드 수집 시 전화번호 형식 검증 필수 (정규식: `^01[0-9]-\d{3,4}-\d{4}$`)
