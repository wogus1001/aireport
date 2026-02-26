---
name: manage-skills
description: 세션 변경사항을 분석하여 검증 스킬 누락을 탐지합니다. 기존 스킬을 동적으로 탐색하고, 새 스킬을 생성하거나 기존 스킬을 업데이트한 뒤 CLAUDE.md를 관리합니다.
disable-model-invocation: true
argument-hint: "[선택사항: 특정 스킬 이름 또는 집중할 영역]"
---

# 세션 기반 스킬 유지보수

## 목적

현재 세션에서 변경된 내용을 분석하여 검증 스킬의 드리프트를 탐지하고 수정합니다:

1. **커버리지 누락** — 어떤 verify 스킬에서도 참조하지 않는 변경된 파일
2. **유효하지 않은 참조** — 삭제되거나 이동된 파일을 참조하는 스킬
3. **누락된 검사** — 기존 검사에서 다루지 않는 새로운 패턴/규칙
4. **오래된 값** — 더 이상 일치하지 않는 설정값 또는 탐지 명령어

## 실행 시점

- 새로운 패턴이나 규칙을 도입하는 기능을 구현한 후
- 기존 verify 스킬을 수정하고 일관성을 점검하고 싶을 때
- PR 전에 verify 스킬이 변경된 영역을 커버하는지 확인할 때
- 검증 실행 시 예상했던 이슈를 놓쳤을 때
- 주기적으로 스킬을 코드베이스 변화에 맞춰 정렬할 때

## 등록된 검증 스킬

현재 프로젝트에 등록된 검증 스킬 목록입니다. 새 스킬 생성/삭제 시 이 목록을 업데이트합니다.

| 스킬 | 설명 | 커버 파일 패턴 |
|------|------|---------------|
| `verify-nextjs` | Next.js 보안 규칙 및 코딩 컨벤션 검증 | `frontend/app/**`, `frontend/components/**`, `frontend/lib/**` |

## 워크플로우

### Step 1: 세션 변경사항 분석

현재 세션에서 변경된 모든 파일을 수집합니다:

```bash
# 커밋되지 않은 변경사항
git diff HEAD --name-only

# 현재 브랜치의 커밋
git log --oneline main..HEAD 2>/dev/null

# main에서 분기된 이후의 모든 변경사항
git diff main...HEAD --name-only 2>/dev/null
```

중복을 제거한 목록으로 합칩니다.

**표시:** 최상위 디렉토리 기준으로 파일을 그룹화합니다:

```markdown
## 세션 변경사항 감지

**이 세션에서 N개 파일 변경됨:**

| 디렉토리 | 파일 |
|----------|------|
| frontend/app | `page.tsx`, `ReportClient.tsx` |
| frontend/components | `PublicSection.tsx`, `LeadCaptureModal.tsx` |
| backend/src | `LeadController.java`, `LeadService.java` |
```

### Step 2: 등록된 스킬과 변경 파일 매핑

위의 **등록된 검증 스킬** 섹션에 나열된 스킬을 참조하여 파일-스킬 매핑을 구축합니다.

#### Sub-step 2a: 등록된 스킬 확인

등록된 스킬이 0개인 경우, Step 4 (CREATE vs UPDATE 결정)로 바로 이동합니다.

#### Sub-step 2b: 변경된 파일을 스킬에 매칭

각 변경 파일에 대해, 등록된 스킬의 패턴과 대조합니다.

#### Sub-step 2c: 매핑 표시

```markdown
### 파일 → 스킬 매핑

| 스킬 | 트리거 파일 | 액션 |
|------|------------|------|
| verify-nextjs | `ReportClient.tsx` | CHECK |
| (스킬 없음) | `package.json` | UNCOVERED |
```

### Step 3: 영향받은 스킬의 커버리지 갭 분석

영향받은 각 스킬에 대해 전체 SKILL.md를 읽고 다음을 점검합니다:

1. **누락된 파일 참조** — Related Files에 없는 변경 파일
2. **오래된 탐지 명령어** — 현재 파일 구조와 불일치하는 grep/glob 패턴
3. **커버되지 않은 새 패턴** — 새로운 규칙, 컴포넌트, API 패턴
4. **삭제된 파일의 잔여 참조**
5. **변경된 값** — 타입명, 컴포넌트명, API 경로 변경

### Step 4: CREATE vs UPDATE 결정

```
커버되지 않은 각 파일 그룹에 대해:
    IF 기존 스킬의 도메인과 관련된 파일인 경우:
        → 결정: 기존 스킬 UPDATE
    ELSE IF 3개 이상의 관련 파일이 공통 규칙/패턴을 공유하는 경우:
        → 결정: 새 verify 스킬 CREATE
    ELSE:
        → "면제"로 표시
```

### Step 5: 기존 스킬 업데이트

사용자가 업데이트를 승인한 각 스킬에 대해 대상 편집을 적용합니다:

**규칙:**
- **추가/수정만** — 작동하는 기존 검사는 절대 제거하지 않음
- Related Files 테이블에 새 파일 경로 추가
- 새로운 탐지 명령어 추가

### Step 6: 새 스킬 생성

1. 관련 변경 파일을 읽어 패턴 파악
2. 스킬 이름 확인 (`verify-`로 시작, kebab-case)
3. `.claude/skills/verify-<name>/SKILL.md` 작성
4. 연관 파일 3개 업데이트:
   - 이 파일의 **등록된 검증 스킬** 테이블
   - `verify-implementation/SKILL.md`의 **실행 대상 스킬** 테이블
   - `CLAUDE.md`의 Skills 테이블

### Step 7: 검증

수정된 모든 SKILL.md 파일을 다시 읽고 마크다운 형식 및 파일 참조 확인.

### Step 8: 요약 보고서

```markdown
## 세션 스킬 유지보수 보고서

### 분석된 변경 파일: N개
### 업데이트된 스킬: X개
### 생성된 스킬: Y개
### 미커버 변경사항 (적용 스킬 없음):
- `path/to/file` — 면제 (사유)
```

---

## Related Files

| File | Purpose |
|------|---------|
| `.claude/skills/verify-implementation/SKILL.md` | 통합 검증 스킬 |
| `.claude/skills/manage-skills/SKILL.md` | 이 파일 자체 |
| `CLAUDE.md` | 프로젝트 지침 |

## 예외사항

다음은 **문제가 아닙니다**:

1. **Lock 파일 및 생성된 파일** — `package-lock.json`, `node_modules/`, `.next/` 등
2. **일회성 설정 변경** — `package.json` 버전 범프
3. **문서 파일** — `README.md`, `CHANGELOG.md`, `handoff.md` 등
4. **환경변수 파일** — `.env.local`, `.env.example`
5. **CI/CD 설정** — `.github/` 등
6. **빌드 산출물** — `.next/`, `target/`, `*.jar`
