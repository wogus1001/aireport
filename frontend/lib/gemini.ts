import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type {
  ExtendedInsights,
  LockedData,
  PublicMetrics,
  RawLockedInputs,
  Region,
  StoreBasicInfo,
} from '@/lib/types';

const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';

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

const PROMPT_BASE = `너는 대한민국 최고의 소상공인 상권분석 전문가야.
입력 데이터에서 "데이터 없음" 필드는 API 미지원을 의미하므로 해당 항목 언급을 피하거나 합리적 추정임을 명시해.
반드시 아래 JSON 형식으로만 출력해. 마크다운 백틱이나 부연 설명 절대 금지.`;

const PROMPT_SEOUL = `[서울 지역 - 서울시 열린데이터광장 API 사용]
서울시 공식 상권분석 데이터(월 평균 매출액, 상권트렌드지수), SGIS 인구통계, 소상공인시장진흥공단 데이터를 근거로 분석해.
${PROMPT_BASE}`;

const PROMPT_GYEONGGI = `[경기 지역 - 경기도 공공데이터 포털 API 사용]
경기도 공식 상권 매출 데이터(TBGGESTDEVALLSTM), SGIS 인구통계, 소상공인시장진흥공단 데이터를 근거로 분석해.
${PROMPT_BASE}`;

const PROMPT_OTHER = `[기타 지역 - SGIS 인구통계 + 공통 공공데이터만 사용]
서울/경기 전용 매출 API는 이 지역에서 미지원. estimated_revenue_raw가 "데이터 없음"인 경우 FFTC 업종 평균과 인구통계 기반으로 추정하되, estimated_revenue 값에 "(추정)" 표기를 붙여줘.
${PROMPT_BASE}`;

export function buildGeminiSystemPrompt(region?: Region): string {
  if (region === 'seoul') return PROMPT_SEOUL;
  if (region === 'gyeonggi') return PROMPT_GYEONGGI;
  return PROMPT_OTHER;
}

export const MOCK_GEMINI_RESPONSE: GeminiReportResponse = {
  summary:
    '하남시 미사역 반경 500m는 30대 여성 유동인구가 집중되는 주거 상권입니다. 퇴근 피크타임 수요가 강하나 카페 업종 과포화 상태입니다.',
  locked_data: {
    estimated_revenue: '3,200만원',
    risk_alert: '최근 3개월 폐업률 18%로 업종 평균 대비 2.1배 높음',
    top_3_strategies: [
      {
        title: '토스 인프라를 활용한 타겟 마케팅',
        description: '30대 여성 토스 사용자에게 직접 쿠폰 푸시 알림 발송으로 반경 1km 내 유입 유도',
      },
      {
        title: '피크타임 전용 테이크아웃 메뉴',
        description: '오후 6~8시 직장인 퇴근 수요를 겨냥한 5분 완성 테이크아웃 라인업 구성',
      },
      {
        title: '주차 연계 집객 전략',
        description: '인근 무료주차장 3개소 제휴로 반경 1km 차량 유입 유도 및 체류 시간 증가',
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
