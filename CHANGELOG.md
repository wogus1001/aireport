# CHANGELOG.md — 내일사장 상권분석 AI 컨설턴트

완료된 작업 이력. `handoff.md`가 길어지면 이 파일로 이전.

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
