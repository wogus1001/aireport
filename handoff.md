# handoff.md — 내일사장 상권분석 AI 컨설턴트

> 세션 시작 시 가장 먼저 읽어야 할 파일.
> Claude Code만 작성. 200줄 이하 유지. 이전 이력은 CHANGELOG.md로 이동.

---

## 현재 상태

- **현재 Phase**: Phase 6 고도화 2차 완료 → **Phase 7 (배포 준비 코드) 대기 중**
- **최종 업데이트**: 2026-02-26 (세션 9 — 매출 로직 보정, 심화 분석 UI 고도화 완료)
- **브랜치**: master

---

## 완료된 작업 요약

- [x] Phase 0~6: 문서 체계, UI, 공공 API, Gemini, Spring Boot, 챗봇, 지역별 프롬프트 (2026-02-24~25)
- [x] Phase 6 고도화: API 실연동 복구 + Gemini 타임아웃 수정 (세션 8, 2026-02-26)
- [x] Phase 6 고도화 2차: 점포당 매출 정밀 보정 + 심화 분석 진단 카드/Sparkline + 한글 인코딩 안전화 (세션 9, 2026-02-26)

---

## 알려진 이슈

| 이슈 | 상태 | 설명 |
|------|------|------|
| MySQL 환경 | ⏳ 미설정 | Phase 7 시작 전 Docker 실행 필요 |
| 솔라피 API 키 | ⏳ 미발급 | 미설정 시 알림톡 skip으로 정상 동작 |
| 공공 API 키 | ⚠️ 부분 | 일부 발급 완료, 대중교통 API 미연동 |

---

## API 진단 엔드포인트 사용법

```
GET http://localhost:3000/api/debug/public-data?address=서울특별시%20마포구%20홍대입구역%20근처&business_type=카페
```

`status: "null"` 또는 `status: "error"` 항목이 있으면 해당 API 키/엔드포인트 문제.

---

## 다음 TODO — Phase 7 (배포 준비)

### 인프라 작업 (사람이 직접)

| 항목 | 설명 |
|------|------|
| Vercel 프로젝트 생성 | Next.js `frontend/` 연결, 환경변수 설정 |
| Spring Boot 호스팅 | Railway 또는 AWS EC2 (`./mvnw package` 후 JAR 배포) |
| MySQL 호스팅 | PlanetScale 또는 AWS RDS (`SCHEMA.md` DDL 실행) |
| DNS 연동 | `nsajang.com/report/[address]` 라우팅 |

### 코드 작업 (Codex 구현)

아래 **Codex 구현 스펙** 참조.

---

## Codex 구현 스펙 — Phase 7 (배포 준비 코드)

> **Codex는 이 섹션을 읽고 구현한다. `*.md` 파일은 수정하지 않는다.**

### 배경

`leads` 테이블에 `utm_source`, `utm_medium`, `utm_campaign` 컬럼이 존재하지만 프론트엔드에서 수집·전달하지 않는다.
프로덕션 CORS 설정과 헬스체크 엔드포인트도 배포 전 필수 준비 사항이다.

### 수정 허용 파일

| 파일 | 작업 |
|------|------|
| `frontend/app/(routes)/report/[address]/page.tsx` | `searchParams` prop 추가, UTM 파라미터 추출 후 `ReportClient`에 전달 |
| `frontend/app/(routes)/report/[address]/ReportClient.tsx` | `utmSource?`, `utmMedium?`, `utmCampaign?` props 추가 → `LeadCaptureModal`로 전달 |
| `frontend/components/modal/LeadCaptureModal.tsx` | UTM props 수신, `/api/leads` 호출 body에 포함 |
| `frontend/app/api/leads/route.ts` | UTM 파라미터를 Spring Boot 요청 body에 포워딩 |
| `backend/.../dto/LeadRequestDto.java` | `utmSource`, `utmMedium`, `utmCampaign` 선택 필드 추가 |
| `backend/.../service/LeadService.java` | DTO → Entity UTM 필드 매핑 |
| `backend/.../config/WebConfig.java` | `https://nsajang.com`, `https://www.nsajang.com` CORS 허용 추가 |
| `backend/.../controller/HealthController.java` | **신규** — `GET /api/health` → `{ "status": "ok" }` |

---

### 구현 상세

**`page.tsx`**: `PageProps`에 `searchParams: { utm_source?: string; utm_medium?: string; utm_campaign?: string }` 추가.
`ReportClient`에 `utmSource={searchParams.utm_source ?? null}` 등 3개 prop 전달.

**`ReportClient.tsx`**: `ReportClientProps`에 `utmSource?: string | null` 등 3개 추가.
`<LeadCaptureModal utmSource={utmSource} utmMedium={utmMedium} utmCampaign={utmCampaign} ... />`

**`LeadCaptureModal.tsx`**: `LeadCaptureModalProps`에 UTM 3개 추가.
fetch body: `{ name, phone, targetArea: address, utmSource, utmMedium, utmCampaign }` (null이면 undefined로 omit).

**`leads/route.ts`**: 기존 body 파싱에서 `utmSource`, `utmMedium`, `utmCampaign` 추출 후 Spring Boot 포워딩 body에 포함.

**`LeadRequestDto.java`**: 3개 필드 추가 (`@Column(name="utm_source", length=100)`, `@NotBlank` 없음 — 선택).
`LeadService`에서 `lead.setUtmSource(dto.getUtmSource())` 등 매핑.

**`WebConfig.java`**:
```java
.allowedOrigins("http://localhost:3000", "https://nsajang.com", "https://www.nsajang.com")
```

**`HealthController.java`** (신규):
```java
@RestController @RequestMapping("/api")
public class HealthController {
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
```

---

### 완료 조건

- [ ] `/report/주소?utm_source=nsajang&utm_medium=cta` 접속 → DB `leads`에 utm 값 기록
- [ ] `GET /api/health` → `{ "status": "ok" }` 응답
- [ ] `./mvnw test` 통과
- [ ] `npm run lint` 에러 0개

**금지 사항**: `*.md` / `.claude/skills/**` 수정 금지. `pom.xml` 수정 금지.

---

## 참조 문서

- 시스템 구조 및 API 명세: `ARCHITECTURE.md`
- DB 스키마: `SCHEMA.md`
- 개발 로드맵: `ROADMAP.md`
- 에이전트 규칙: `AGENTS.md`
- 프로젝트 규칙 및 코드 패턴: `CLAUDE.md`
- 완료 이력: `CHANGELOG.md`
