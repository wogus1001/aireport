import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type {
  ExtendedInsights,
  LockedData,
  PublicMetrics,
  RawLockedInputs,
  Region,
  StoreBasicInfo,
} from '@/lib/types';

function resolveGeminiModelName(rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) return 'gemini-2.5-pro';

  // Legacy aliases that now fail on the current API.
  if (value === 'gemini-flash-latest') return 'gemini-2.5-pro';
  return value;
}

const GEMINI_MODEL_NAME = resolveGeminiModelName(process.env.GEMINI_MODEL);

export interface GeminiReportRequest {
  address: string;
  region?: Region;
  raw_locked_inputs: RawLockedInputs;
  public_metrics: PublicMetrics;
  extended_insights?: ExtendedInsights;
  store_basic_info?: StoreBasicInfo;
}

export interface GeminiReportResponse {
  summary: string;
  locked_data: LockedData;
}

const PROMPT_BASE = `너는 상권 분석 리포트 전문가다.
입력 데이터에서 "데이터 없음"은 API 미지원 의미이므로 해당 항목을 과장하지 마라.
응답은 반드시 JSON만 반환하고, 마크다운/백틱/부연 설명을 출력하지 마라.`;

const TERM_STYLE_GUIDE = `[용어 지침]
- "예상 월 매출", "월 평균 매출", "매출 추정" 표현은 사용하지 마.
- 매출 관련 표현은 반드시 "유사 업종 월 매출 참고치"로 통일해.
- 해당 값은 실매출이 아닌 공개 데이터 기반 참고치임을 문맥에 반영해.`;

const PROMPT_SEOUL = `[서울 지역]
서울시 상권 데이터와 인구통계, 소상공인 통계를 근거로 분석해.
${PROMPT_BASE}`;

const PROMPT_GYEONGGI = `[경기 지역]
경기도 상권 데이터와 인구통계, 소상공인 통계를 근거로 분석해.
${PROMPT_BASE}`;

const PROMPT_OTHER = `[기타 지역]
전국 공통 데이터와 인구통계 기반으로 분석하되, 추정 문구를 명확히 구분해.
${PROMPT_BASE}`;

export function buildGeminiSystemPrompt(region?: Region): string {
  if (region === 'seoul') return `${PROMPT_SEOUL}\n${TERM_STYLE_GUIDE}`;
  if (region === 'gyeonggi') return `${PROMPT_GYEONGGI}\n${TERM_STYLE_GUIDE}`;
  return `${PROMPT_OTHER}\n${TERM_STYLE_GUIDE}`;
}

export const MOCK_GEMINI_RESPONSE: GeminiReportResponse = {
  summary:
    '해당 상권은 유동 인구와 접근성이 안정적이며, 업종 경쟁도는 중간 수준입니다. 공개 데이터 기준으로 유사 업종 월 매출 참고치와 임대 조건을 함께 비교해 손익 구조를 점검해야 합니다. 초기 8주 운영 지표를 주 단위로 관리해 리스크를 줄이는 전략이 필요합니다.',
  locked_data: {
    estimated_revenue: '3,200만원',
    risk_alert: '최근 분기 변동성이 커서 초기 운영 지표 관리가 필요합니다.',
    top_3_strategies: [
      {
        title: '피크타임 수요 집중 공략',
        description: '핵심 시간대 상품 구성을 최적화해 객단가와 회전율을 높이세요.',
      },
      {
        title: '경쟁 업종 대비 차별화',
        description: '동일 상권 내 가격/구성 차별 포인트를 명확히 설계하세요.',
      },
      {
        title: '고정비 대비 손익 관리',
        description: '임대 조건과 매출 흐름을 연결해 손익분기점을 주기적으로 점검하세요.',
      },
    ],
  },
};

export function getGeminiModel(apiKey: string): GenerativeModel {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL_NAME,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });
}
