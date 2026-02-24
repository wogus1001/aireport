# SCHEMA.md — 내일사장 상권분석 AI 컨설턴트

MySQL 8.3.0 테이블 정의, 관계도, 인덱스를 관리한다.

---

## 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `leads` | 리드 수집 핵심 테이블 (이름, 연락처, 관심 상권) |
| `report_cache` | Gemini 리포트 캐시 (동일 주소 재요청 비용 절감) |
| `chatbot_messages` | AI 챗봇 대화 이력 |

---

## 테이블 상세 정의

### leads (핵심)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 리드 ID |
| name | VARCHAR(50) | NOT NULL | 이름 |
| phone | VARCHAR(20) | NOT NULL | 전화번호 (010-XXXX-XXXX) |
| target_area | VARCHAR(200) | NOT NULL | 관심 상권 주소 (예: 하남시 미사역 반경 500m) |
| report_url | VARCHAR(500) | | 발송된 리포트 URL |
| alimtalk_sent | TINYINT(1) | DEFAULT 0 | 알림톡 발송 여부 |
| alimtalk_sent_at | DATETIME | | 알림톡 발송 시각 |
| utm_source | VARCHAR(100) | | 유입 채널 (nsajang, etc.) |
| utm_medium | VARCHAR(100) | | 유입 매체 |
| utm_campaign | VARCHAR(100) | | 캠페인명 |
| created_at | DATETIME | DEFAULT NOW() | 리드 수집 시각 |
| updated_at | DATETIME | ON UPDATE NOW() | 수정 시각 |

```sql
CREATE TABLE leads (
  id             BIGINT       NOT NULL AUTO_INCREMENT,
  name           VARCHAR(50)  NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  target_area    VARCHAR(200) NOT NULL,
  report_url     VARCHAR(500),
  alimtalk_sent  TINYINT(1)   NOT NULL DEFAULT 0,
  alimtalk_sent_at DATETIME,
  utm_source     VARCHAR(100),
  utm_medium     VARCHAR(100),
  utm_campaign   VARCHAR(100),
  created_at     DATETIME     NOT NULL DEFAULT NOW(),
  updated_at     DATETIME     ON UPDATE NOW(),
  PRIMARY KEY (id),
  INDEX idx_phone (phone),
  INDEX idx_created_at (created_at),
  INDEX idx_target_area (target_area(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### report_cache (Gemini 리포트 캐시)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 캐시 ID |
| address_key | VARCHAR(200) | UNIQUE, NOT NULL | 정규화된 주소 키 |
| report_json | JSON | NOT NULL | Gemini 생성 리포트 (JSON) |
| public_data_json | JSON | | 공공데이터 집계 결과 (JSON) |
| expires_at | DATETIME | NOT NULL | 캐시 만료 시각 (기본 24시간) |
| created_at | DATETIME | DEFAULT NOW() | 생성 시각 |

```sql
CREATE TABLE report_cache (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  address_key      VARCHAR(200) NOT NULL,
  report_json      JSON         NOT NULL,
  public_data_json JSON,
  expires_at       DATETIME     NOT NULL,
  created_at       DATETIME     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE INDEX idx_address_key (address_key),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### chatbot_messages (챗봇 대화 이력)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 메시지 ID |
| lead_id | BIGINT | FK → leads(id) | 연결된 리드 |
| role | ENUM('user','assistant') | NOT NULL | 발화자 |
| content | TEXT | NOT NULL | 메시지 내용 |
| created_at | DATETIME | DEFAULT NOW() | 발화 시각 |

```sql
CREATE TABLE chatbot_messages (
  id         BIGINT       NOT NULL AUTO_INCREMENT,
  lead_id    BIGINT       NOT NULL,
  role       ENUM('user','assistant') NOT NULL,
  content    TEXT         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX idx_lead_id (lead_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 관계도

```
leads (1) ─────────── (N) chatbot_messages
  │
  └── report_cache (독립 테이블, address_key로 연결)
```

---

## JPA Entity 참조

```java
// Lead.java
@Entity
@Table(name = "leads")
public class Lead {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, length = 50)
    private String name;

    @NotBlank
    @Column(nullable = false, length = 20)
    private String phone;

    @NotBlank
    @Column(name = "target_area", nullable = false, length = 200)
    private String targetArea;

    @Column(name = "report_url", length = 500)
    private String reportUrl;

    @Column(name = "alimtalk_sent")
    private boolean alimtalkSent = false;

    @Column(name = "alimtalk_sent_at")
    private LocalDateTime alimtalkSentAt;

    @Column(name = "utm_source", length = 100)
    private String utmSource;

    @Column(name = "utm_medium", length = 100)
    private String utmMedium;

    @Column(name = "utm_campaign", length = 100)
    private String utmCampaign;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
```
