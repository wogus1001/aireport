export interface Strategy {
  title: string;
  description: string;
}

export interface PublicMetrics {
  search_trend: string;
  main_target: string;
  competitor_count: string;
  parking_info: string;
}

export interface LockedData {
  estimated_revenue: string;
  risk_alert: string;
  top_3_strategies: Strategy[];
}

export interface RawLockedInputs {
  estimated_revenue_raw: string;
  commercial_trend_raw: string;
  open_close_stats_raw: string;
  rent_price_raw: string;
}

export interface ExtendedInsights {
  sgis_age_distribution: string;
  sgis_industry_top: string;
  regional_trend_timeline: string;
  sdsc_category_breakdown: string;
  naver_trend_series: string;
  kakao_accessibility_score: string;
}

export interface StoreBasicInfo {
  source: 'nsajang';
  store_id: string;
  store_name?: string;
  business_type?: string;
  main_category_name?: string;
  sub_category_name?: string;
  address_detail?: string;
  rent?: string;
  deposit?: string;
  area?: string;
  floor?: string;
  monthly_avg_sales?: string;
  premium?: string;
  takeover_amount?: string;
  latitude?: string;
  longitude?: string;
  negotiable?: string;
  operation_period_months?: string;
  operation_status_label?: string;
  worker_count_label?: string;
  parking_count_label?: string;
  restroom_type_label?: string;
  phone?: string;
  description?: string;
}

export interface ReportData {
  summary: string;
  public_metrics: PublicMetrics;
  locked_data: LockedData;
  raw_locked_inputs?: RawLockedInputs;
  extended_insights?: ExtendedInsights;
  store_basic_info?: StoreBasicInfo;
}

export type Region = 'seoul' | 'gyeonggi' | 'other';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}
