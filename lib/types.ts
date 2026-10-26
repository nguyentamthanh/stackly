export type AssetClass = "vn" | "us" | "gold" | "crypto" | "savings";

export type Currency = "VND" | "USD";

export type SourceSpec =
  | { provider: "vndirect"; symbol: string; scale?: number }
  | { provider: "yahoo"; symbol: string; scale?: number };

export interface AssetConfig {
  id: string;
  name: string;
  symbol: string;
  class: AssetClass;
  currency: Currency;
  /** Đơn vị giá hiển thị, ví dụ "điểm", "VND/CCQ", "VND/lượng" */
  unit: string;
  description: string;
  /** Có thể mua trực tiếp để tích sản không (chỉ số thì không) */
  investable: boolean;
  /** Dùng P/E VN-Index làm chỉ số định giá */
  usesMarketPE?: boolean;
  /** Nguồn dữ liệu giá theo thứ tự ưu tiên */
  sources: SourceSpec[];
}

/** Một điểm giá: [ngày YYYY-MM-DD, giá đóng cửa] */
export type Bar = [string, number];

export interface PriceFile {
  id: string;
  updatedAt: string;
  source: string;
  stale: boolean;
  bars: Bar[];
}

export type ComponentKey = "pe" | "ma200" | "mayer" | "rsi" | "drawdown" | "premium" | "realRate";

export interface ScoreComponent {
  key: ComponentKey;
  name: string;
  /** Giá trị thô của chỉ số, ví dụ P/E = 12.3 */
  value: number;
  /** Chuỗi hiển thị của giá trị thô */
  display: string;
  /** Điểm thành phần 0–100 (cao = hấp dẫn để mua) */
  score: number;
  weight: number;
  explanation: string;
}

export type SignalLevel = "very-expensive" | "expensive" | "neutral" | "cheap" | "very-cheap";

export interface Signal {
  id: string;
  score: number;
  level: SignalLevel;
  label: string;
  multiplier: number;
  action: string;
  components: ScoreComponent[];
  price: number;
  change1d: number | null;
  change1m: number | null;
  change1y: number | null;
  asOf: string;
  stale: boolean;
  /** Giá theo tuần, 52 tuần gần nhất (để vẽ sparkline nhẹ) */
  spark: number[];
}

/** File public/data/assets/<id>.json — dữ liệu cho trang chi tiết và backtest */
export interface AssetDetail {
  id: string;
  /** Giá ngày dùng để vẽ biểu đồ và backtest */
  bars: Bar[];
  /** Điểm hấp dẫn theo tuần trên toàn bộ lịch sử có đủ dữ liệu */
  scoreHistory: Bar[];
  /** Vàng: lịch sử giá bán trong nước tích lũy hằng ngày (bars là giá thế giới quy đổi) */
  domestic?: Bar[];
  source: string;
  stale: boolean;
}

export interface SignalsFile {
  updatedAt: string;
  usdVnd: number;
  signals: Signal[];
}

export interface GoldQuote {
  date: string;
  sjcBuy: number;
  sjcSell: number;
  ringBuy: number;
  ringSell: number;
  /** Giá vàng thế giới quy đổi VND/lượng */
  worldVnd: number;
}

export interface SavingsRate {
  bank: string;
  m6: number;
  m12: number;
  m24?: number;
}

export interface SavingsData {
  updatedAt: string;
  inflation: number;
  rates: SavingsRate[];
}

export interface MarketMeta {
  updatedAt: string;
  usdVnd: number;
  vnindexPE: number | null;
  errors: string[];
}
