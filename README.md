# 내일사장 상권분석 AI 컨설턴트

소상공인이 창업 전 입력한 주소의 상권을 AI로 분석해 맞춤 전략을 제공하는 서비스.

---

## 기술 스택

| 레이어 | 스택 |
|--------|------|
| Frontend (BFF 포함) | Next.js 14 / React 18 / TypeScript / Tailwind CSS |
| Backend | Spring Boot 3.1.5 / Java 17 |
| Database | MySQL 8.3.0 |
| AI | Google Gemini API |

---

## 사전 요구사항

- **Node.js** 18 이상
- **Java** 17
- **MySQL** 8.3.0 (Docker 사용 권장)
- Git

---

## 빠른 시작 (로컬 3단계)

### 1단계 — DB 실행

```bash
docker run --name aireport-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=aireport \
  -p 3306:3306 \
  -d mysql:8.3.0
```

스키마 적용:

```bash
# SCHEMA.md의 DDL 구문을 MySQL 클라이언트에서 실행
mysql -u root -proot aireport < schema.sql
```

> DDL 전문은 `SCHEMA.md` 참조.

---

### 2단계 — Spring Boot 백엔드 실행

```bash
cd backend
./mvnw spring-boot:run
# → http://localhost:8080
```

`backend/src/main/resources/application.properties`에 DB 접속 정보 확인:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/aireport
spring.datasource.username=root
spring.datasource.password=root
```

---

### 3단계 — Next.js 프론트엔드 실행

```bash
cd frontend
npm install

# 환경변수 설정 (아래 섹션 참조)
cp .env.local.example .env.local
# .env.local을 편집해서 실제 API Key 입력

npm run dev
# → http://localhost:3000
```

---

## 환경변수 설정

`frontend/.env.local.example`을 복사해 `.env.local`을 만들고 각 항목에 실제 키를 입력.

```
frontend/
  .env.local.example   ← 키 목록 + 발급 방법 안내
  .env.local           ← 실제 값 입력 (git 미추적)
```

> 키 발급 방법은 `.env.local.example` 파일 내 주석 참조.

---

## 주요 URL

| URL | 설명 |
|-----|------|
| `http://localhost:3000/report/[주소]` | 상권분석 리포트 페이지 |
| `http://localhost:3000/api/debug/public-data?address=서울 마포구` | API 키 동작 진단 |
| `http://localhost:8080/api/health` | Spring Boot 헬스체크 |
| `http://localhost:8080/api/v1/leads` | 리드 저장 API |

---

## API 키 동작 확인

```bash
curl "http://localhost:3000/api/debug/public-data?address=서울특별시%20마포구%20홍대입구역%20근처&business_type=카페"
```

응답에서 `status: "null"` 또는 `status: "error"` 항목이 있으면 해당 API 키 확인 필요.

---

## 빌드

```bash
# Frontend
cd frontend && npm run build

# Backend
cd backend && ./mvnw package
```

---

## 주요 문서

| 문서 | 내용 |
|------|------|
| `ARCHITECTURE.md` | 시스템 구조, API 연동 명세, Gemini 출력 스키마 |
| `SCHEMA.md` | MySQL 테이블 DDL, 관계도 |
| `ROADMAP.md` | Phase별 개발 계획 |
| `handoff.md` | 현재 상태, 알려진 이슈, Phase 7 구현 스펙 |
| `CLAUDE.md` | 코드 컨벤션, 파일 소유권, Learned Constraints |
| `CHANGELOG.md` | 완료 작업 이력 |
