---
name: verify-nextjs
description: Next.js 14 App Router 코드의 보안 규칙 및 코딩 컨벤션을 검증합니다. API Key 보안, CORS 우회, isUnlocked 패턴, TypeScript any 금지 등을 확인합니다.
disable-model-invocation: true
---

# verify-nextjs

## 목적

`frontend/` 디렉토리의 Next.js 코드가 CLAUDE.md의 Learned Constraints와 코드 컨벤션을 준수하는지 검증합니다.

## 실행 시점

- `frontend/` 파일을 수정한 후
- PR 전 최종 검증
- 새로운 API Route 또는 클라이언트 컴포넌트 추가 후

## Related Files

| 파일 | 역할 |
|------|------|
| `frontend/app/(routes)/report/[address]/ReportClient.tsx` | isUnlocked 상태 관리, Gemini 클라이언트 fetch (useEffect) |
| `frontend/app/(routes)/report/[address]/page.tsx` | 서버 컴포넌트, public-data API 호출 |
| `frontend/app/api/leads/route.ts` | Lead API Route Handler |
| `frontend/app/api/public-data/route.ts` | 공공데이터 집계 Route Handler |
| `frontend/app/api/report/route.ts` | Gemini AI 리포트 생성 Route Handler |
| `frontend/app/api/debug/public-data/route.ts` | 개발 전용 진단 엔드포인트 (NODE_ENV guard 필수) |
| `frontend/components/modal/LeadCaptureModal.tsx` | 잠금 해제 모달, onSuccess 트리거 |
| `frontend/components/chatbot/FloatingChatbot.tsx` | isUnlocked 이후 노출 챗봇 |
| `frontend/components/report/LockedSection.tsx` | 블러 처리 영역 |
| `frontend/components/report/PublicSection.tsx` | 공개 섹션, 요약/메트릭/원천데이터/인사이트 표시 |
| `frontend/lib/types.ts` | 공유 타입 정의 (Region, ExtendedInsights 등) |
| `frontend/lib/public-apis.ts` | 공공 API 호출 유틸, detectRegion, 카테고리 매칭 |
| `frontend/lib/gemini.ts` | Gemini 클라이언트, buildGeminiSystemPrompt(region) |

## 워크플로우

### Check 1: TypeScript `any` 타입 금지

**목적:** `any` 사용은 타입 안전성을 무너뜨린다.

```bash
grep -rn ": any\b\|as any\b\|<any>" frontend/app frontend/components frontend/lib \
  --include="*.ts" --include="*.tsx"
```

- **PASS**: 결과 없음
- **FAIL**: 한 건이라도 검출되면 해당 줄 보고

---

### Check 2: API Key NEXT_PUBLIC_ 오용 금지

**목적:** 민감한 API Key가 `NEXT_PUBLIC_` prefix로 브라우저에 노출되면 안 된다.

```bash
grep -rn "NEXT_PUBLIC_GEMINI\|NEXT_PUBLIC_SGIS\|NEXT_PUBLIC_SPRING\|NEXT_PUBLIC_KAKAO_REST" \
  frontend/ --include="*.ts" --include="*.tsx" --include="*.js" --include=".env*"
```

- **PASS**: 결과 없음
- **FAIL**: 검출 시 해당 키와 파일 보고
- **허용 예외**: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_KAKAO_JS_KEY` (카카오 지도 JS SDK App Key)

---

### Check 3: 클라이언트 컴포넌트에서 외부 도메인 직접 fetch 금지

**목적:** `'use client'` 파일에서 공공 API를 직접 호출하면 CORS 오류 발생.

```bash
grep -rn "sgisapi\.kostat\|openapi\.naver\|dapi\.kakao\|apis\.data\.go\.kr\|api\.odcloud" \
  frontend/app frontend/components --include="*.tsx" --include="*.ts"
```

- **PASS**: 결과 없음 (또는 `'use client'`가 없는 파일에만 존재)
- **FAIL**: `'use client'` 선언 파일에서 해당 도메인으로 직접 fetch 검출 시 보고

추가 확인 — `'use client'` 파일 목록 추출 후 외부 http fetch 여부:

```bash
grep -rln "'use client'" frontend/app frontend/components --include="*.tsx"
```

위 목록 파일들 각각에서 `fetch('http` 또는 `fetch("http` 패턴 검사:

```bash
grep -rn "fetch\s*(['\"]http" frontend/app frontend/components --include="*.tsx"
```

- **PASS**: `/api/` 내부 경로만 fetch
- **FAIL**: 외부 URL fetch 검출 시 파일명·줄 번호 보고

---

### Check 4: isUnlocked 보안 패턴

**목적:** `setIsUnlocked(true)` 는 Lead API `/api/leads` 200 OK 응답 이후에만 호출되어야 한다.

```bash
grep -rn "setIsUnlocked(true)" frontend/ --include="*.tsx" --include="*.ts"
```

검출된 각 위치에서 전후 맥락(±10줄) 확인:
- **PASS**: 오직 `onSuccess` 콜백 또는 `response.ok` 확인 이후에만 호출
- **FAIL**: 단독 click handler, setTimeout, 또는 임의 조건에서 호출

---

### Check 5: 파일명 컨벤션

**목적:** 컴포넌트는 PascalCase, 유틸/훅은 camelCase.

```bash
# components/ — PascalCase .tsx 확인 (소문자로 시작하는 파일 탐지)
find frontend/components -name "*.tsx" | grep -E "/[a-z][^/]*\.tsx$"

# lib/ — camelCase .ts 확인 (대문자로 시작하는 파일 탐지)
find frontend/lib -name "*.ts" | grep -E "/[A-Z][^/]*\.ts$"
```

- **PASS**: 각 grep 결과 없음
- **FAIL**: 잘못된 파일명 목록 보고

---

### Check 6: Route Handler 전용 API Key 사용

**목적:** `SGIS_`, `GEMINI_` 등 서버 전용 환경변수가 Route Handler(`app/api/`) 밖에서 사용되면 안 된다.

```bash
grep -rn "process\.env\.SGIS_\|process\.env\.GEMINI_\|process\.env\.SPRING_" \
  frontend/app --include="*.ts" --include="*.tsx"
```

- **PASS**: 결과가 `frontend/app/api/` 경로에만 있음
- **FAIL**: `frontend/app/(routes)/` 또는 `frontend/components/` 에서 검출 시 보고

---

### Check 7: Gemini API Route 응답 전처리

**목적:** `app/api/report/route.ts` 가 존재하면 Gemini 응답을 JSON.parse하기 전에 마크다운 백틱을 제거해야 한다.

```bash
# Route 파일 존재 여부 확인
ls frontend/app/api/report/route.ts 2>/dev/null || echo "NOT_FOUND"
```

- 파일이 없으면 → **해당 없음 (SKIP)**
- 파일이 있으면:

```bash
grep -n "JSON\.parse" frontend/app/api/report/route.ts
grep -n "replace.*\`\`\`json\|\`\`\`" frontend/app/api/report/route.ts
```

  - **PASS**: `JSON.parse` 전에 `` replace(/```json|```/g, '').trim() `` 호출
  - **FAIL**: 전처리 없이 `JSON.parse` 직접 호출

---

---

### Check 8: 개발 전용 엔드포인트 NODE_ENV guard

**목적:** `debug/` 하위 Route Handler가 프로덕션에서 노출되지 않도록 `NODE_ENV` 가드가 반드시 존재해야 한다.

```bash
grep -rn "NODE_ENV" frontend/app/api/debug/ --include="*.ts"
```

- **PASS**: `process.env.NODE_ENV !== 'development'` 체크 후 비-개발 환경에서 403 반환 존재
- **FAIL**: `debug/` 경로 파일에 NODE_ENV 체크 없음

---

## 예외사항

1. **`NEXT_PUBLIC_BASE_URL`** — 서버 사이드 self-fetch용 base URL, 브라우저 노출 허용
2. **`NEXT_PUBLIC_KAKAO_JS_KEY`** — 카카오 지도 JS SDK는 브라우저 공개 키 사용이 정책상 허용됨
3. **`frontend/.next/`**, **`frontend/node_modules/`** — 빌드 산출물, 검사 제외
4. **`frontend/README.md`** — 문서 파일, 검사 제외
5. **`next-env.d.ts`** — Next.js 자동 생성 파일
6. **`.env.local`** — 검사 대상이지만 git에 커밋되지 않으므로 파일이 없으면 SKIP
