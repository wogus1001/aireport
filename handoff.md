# handoff.md — 내일사장 상권분석 AI 컨설턴트

> 세션 시작 시 가장 먼저 읽어야 할 파일.
> Claude Code만 작성. 200줄 이하 유지. 이전 이력은 CHANGELOG.md로 이동.

---

## 현재 상태

- **현재 Phase**: Phase 0 완료 → Phase 1 시작 전
- **최종 업데이트**: 2026-02-24 (세션 1 — 프로젝트 셋업)
- **브랜치**: main

---

## 완료된 작업 (세션 1 — 2026-02-24)

- [x] 프로젝트 요구사항 분석 및 기술 스택 확정
- [x] 문서 체계 전체 구축
  - [x] `CLAUDE.md` — 프로젝트 규칙, 코드 패턴, Gemini 시스템 프롬프트
  - [x] `ARCHITECTURE.md` — 전체 시스템 아키텍처, 폴더 구조, 공공 API 명세, Gemini Output Schema
  - [x] `SCHEMA.md` — MySQL 테이블 3개 DDL 정의 (leads, report_cache, chatbot_messages)
  - [x] `ROADMAP.md` — Phase 0~6 전체 계획
  - [x] `AGENTS.md` — 역할 분담, 워크플로우, Learned Constraints
  - [x] `handoff.md` — 현재 파일
  - [x] `CHANGELOG.md` — 이력 파일
- [x] `.mcp.json` — Serena, Playwright, Context7, Sequential Thinking MCP 설정
- [x] Git 저장소 초기화

---

## 다음 TODO (Phase 1)

### 🎯 Phase 1 목표: UI 뼈대 + Mock 데이터 연동

**Step 1 — Next.js 프로젝트 초기화**
```bash
cd /c/Users/awmve/OneDrive/바탕\ 화면/aireport
npx create-next-app@14.0.0 frontend --typescript --tailwind --app --no-src-dir
```

**Step 2 — 구현할 파일 목록** (ROADMAP.md Phase 1 참조)
- `app/(routes)/report/[address]/page.tsx`
- `app/(routes)/report/[address]/ReportClient.tsx`
- `components/report/PublicSection.tsx`
- `components/report/LockedSection.tsx`
- `components/report/UnlockCTA.tsx`
- `components/modal/LeadCaptureModal.tsx`
- `components/report/ReportSkeleton.tsx`

**Step 3 — Mock JSON 구조** (ARCHITECTURE.md Gemini Output Schema 참조)
```json
{
  "summary": "하남시 미사역 반경 500m 상권 종합 진단...",
  "public_metrics": {
    "peak_time": "오후 6~8시",
    "main_target": "30대 여성 (41%)",
    "competitor_count": "카페 23개"
  },
  "locked_data": {
    "estimated_revenue": "3,200만원",
    "risk_alert": "최근 3개월 폐업률 18%로 업종 평균 대비 2.1배 높음",
    "top_3_strategies": [...]
  }
}
```

---

## 알려진 이슈

| 이슈 | 상태 | 설명 |
|------|------|------|
| uvx PATH | ✅ 해결 | `C:\Users\awmve\.local\bin\uvx.exe` 절대경로로 설정 |
| Serena MCP | 🔄 확인 필요 | Claude Code 재시작 후 Serena 연결 확인 필요 |
| 공공 API 키 | ⏳ 미발급 | Phase 2 시작 전 각 공공 API 키 발급 필요 |
| MySQL 환경 | ⏳ 미설정 | Phase 4 시작 전 로컬 MySQL 또는 Docker 설정 필요 |

---

## 참조 문서

- 시스템 구조 및 API 명세: `ARCHITECTURE.md`
- DB 스키마: `SCHEMA.md`
- 개발 로드맵: `ROADMAP.md`
- 에이전트 규칙: `AGENTS.md`
- 프로젝트 규칙 및 코드 패턴: `CLAUDE.md`
- 완료 이력: `CHANGELOG.md`
