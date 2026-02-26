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

### Codex 전용 (Read/Write)

| 파일 | 용도 |
|------|------|
| `frontend/app/**` | Next.js 앱 코드 |
| `frontend/components/**` | React 컴포넌트 |
| `frontend/lib/**` | 유틸리티, 타입 정의 |
| `backend/src/**` | Spring Boot 소스 |
| `frontend/package.json` | 패키지 의존성 (추가 전 Claude Code 승인) |
| `backend/pom.xml` | Maven 의존성 (추가 전 Claude Code 승인) |

### 상호작용 (Cross-Reference)

| 파일 | Claude Code | Codex |
|------|-------------|--------------|
| `handoff.md` | ✅ Write | 📖 Read — `구현 스펙` 섹션만 |
| `ARCHITECTURE.md` | ✅ Write | 📖 Read — 폴더 구조·패턴 파악 |
| `SCHEMA.md` | ✅ Write | 📖 Read — DB 테이블·컬럼 파악 |
| `CLAUDE.md` | ✅ Write | 📖 Read — 코드 컨벤션·패턴 파악 |
| `frontend/app/**` | 📖 Read | ✅ Write |
| `backend/src/**` | 📖 Read | ✅ Write |

---

## 역할 분담

| 작업 | Claude Code | Codex |
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

### 세션 프롬프트 (복사해서 사용)

#### 🔵 Claude Code

**① 세션 시작 + 스펙 준비**
```
handoff.md 읽고 현재 Phase, 직전 작업, 다음 TODO 브리핑해줘.
다음 Phase Codex 스펙이 없으면 ARCHITECTURE.md, SCHEMA.md 참조해서 작성해줘.
이미 있으면 검토 후 보완 필요 시만 업데이트해줘.
```

**② 세션 종료**
```
수고했어
```

---

#### 🟠 Codex

**③ 세션 시작**
```
아래 파일들을 순서대로 읽어.
1. CLAUDE.md → 코드 컨벤션, 수정 허용/금지 파일 확인
2. handoff.md → "Codex 구현 스펙" 섹션만 읽고 구현
규칙:
- .md 파일은 절대 수정하지 마
- 허용 파일 목록 외 파일 생성·수정 금지
- package.json / pom.xml 패키지 추가 필요 시 즉시 중단하고 나에게 알려줘
- TypeScript any 사용 금지
```

**④ 구현 완료 후 보고**
```
구현 완료 후 반드시 아래를 실행하고 결과를 포함해서 보고해줘:
- npm run lint
- npm run build
✅ 완료된 파일:
- ...
❌ lint/build 에러 또는 미완료 이슈:
- (있으면 작성)
```

> 계속 개발이 필요하면 ③'로 반복, 완전히 끝나면 아래 ⑤로 진행

**③' 추가 구현 (선택)**
```
[구현할 내용 직접 지시]
규칙은 ③과 동일. 완료 후 ④ 형식으로 보고해줘.
```

---

#### 🔵 Claude Code (모든 구현 완료 후)

**⑤ 코드 리뷰**
```
Codex가 Phase N 구현 완료했어. 코드 리뷰해줘.
아래 기준으로 검토해:
1. CLAUDE.md 코드 컨벤션 준수 여부 (파일명, 타입명, any 사용 등)
2. 수정 허용 파일 외 변경된 파일 없는지
3. isUnlocked 상태가 API 응답 기반으로만 전환되는지
4. API Key가 서버사이드에서만 사용되는지
5. 블러 처리 패턴이 정확히 적용되었는지 (blur-sm pointer-events-none select-none)
6. TypeScript any 없는지
이슈 발견 시 → 파일명:라인수 형태로 목록화하고, Codex에게 수정 지시사항을 작성해줘.
(이슈 없으면 바로 ⑥으로 진행)
```

> 이슈 있으면 아래 ③''로 Codex 수정 → 완료 후 ⑤ 재검토

**③'' 리뷰 이슈 수정 (선택)**
```
아래 이슈를 수정해줘: [Claude Code가 작성한 수정 지시사항]
수정 완료 후 npm run lint, npm run build 결과 포함해서 보고해줘.
```

**⑥ 검증 + 문서 업데이트**
```
npm run lint, npm run build 실행해서 검증해줘.
에러 없으면 /verify-implementation 실행하고,
검증 통과 시 아래를 한번에 진행해줘:
- ROADMAP.md Phase N 체크박스 업데이트
- CHANGELOG.md에 완료 이력 추가
- /manage-skills 실행해서 새 파일/패턴이 verify 스킬에 커버되는지 확인
```

**⑦ 세션 종료**
```
수고했어
```

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
