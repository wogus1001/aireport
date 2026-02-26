# handoff.md — 내일사장 상권분석 AI 컨설턴트

> 세션 시작 시 가장 먼저 읽어야 할 파일.
> Claude Code만 작성. 200줄 이하 유지. 이전 이력은 CHANGELOG.md로 이동.

---

## 현재 상태

- **현재 Phase**: Phase 7 코드 정리 완료 → **배포 대기 중**
- **최종 업데이트**: 2026-02-26 (세션 10 — UTM 제거 + WebConfig 정리 + 인계 문서 완성)
- **브랜치**: master

---

## 완료된 작업 요약

- [x] Phase 0~6: 문서 체계, UI, 공공 API, Gemini, Spring Boot, 챗봇, 지역별 프롬프트 (2026-02-24~25)
- [x] Phase 6 고도화: API 실연동 복구 + Gemini 타임아웃 수정 (세션 8, 2026-02-26)
- [x] Phase 6 고도화 2차: 점포당 매출 정밀 보정 + 심화 분석 진단 카드/Sparkline (세션 9, 2026-02-26)
- [x] Phase 7 코드 정리: UTM 제거 + WebConfig 정리 + 인계 문서 완성 (세션 10, 2026-02-26)

---

## 알려진 이슈

| 이슈 | 상태 | 설명 |
|------|------|------|
| MySQL 환경 | ⏳ 미설정 | 로컬 개발 시 Docker 실행 필요 |
| 솔라피 API 키 | ⏳ 미발급 | 미설정 시 알림톡 skip, 리드 저장은 정상 동작 |
| 공공 API 키 | ⚠️ 부분 | 일부 발급 완료, 대중교통 API 미연동 |

---

## API 진단 엔드포인트 사용법

```
GET http://localhost:3000/api/debug/public-data?address=서울특별시%20마포구%20홍대입구역%20근처&business_type=카페
```

`status: "null"` 또는 `status: "error"` 항목이 있으면 해당 API 키/엔드포인트 문제.

---

## 다음 TODO — 배포 인프라 (사람이 직접)

| 항목 | 설명 |
|------|------|
| Vercel 프로젝트 생성 | `frontend/` 연결, `.env.local.example` 참조하여 환경변수 설정 |
| Spring Boot 호스팅 | Railway 또는 AWS EC2 (`./mvnw package` 후 JAR 배포) |
| MySQL 호스팅 | PlanetScale 또는 AWS RDS (`SCHEMA.md` DDL 실행) |
| DNS 연동 | `nsajang.com/report/[address]` 라우팅 |
| 솔라피 API 키 발급 | 발급 후 `SOLAPI_API_KEY`, `SOLAPI_API_SECRET` 환경변수 설정 |

> 코드 작업은 모두 완료. 배포 인프라 구성만 남아 있음.

---

## 참조 문서

- 빠른 시작: `README.md`
- 환경변수 목록: `frontend/.env.local.example`
- 시스템 구조 및 API 명세: `ARCHITECTURE.md`
- DB 스키마: `SCHEMA.md`
- 개발 로드맵: `ROADMAP.md`
- 에이전트 규칙: `AGENTS.md`
- 프로젝트 규칙 및 코드 패턴: `CLAUDE.md`
- 완료 이력: `CHANGELOG.md`
