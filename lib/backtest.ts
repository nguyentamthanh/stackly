import { multiplierForScore } from "./signals";
import type { Bar } from "./types";

export interface BacktestInput {
  /** Giá ngày */
  bars: Bar[];
  /** Điểm hấp dẫn theo tuần */
  scores: Bar[];
  /** Số tiền tích sản mỗi tháng */
  monthly: number;
  /** Lãi suất năm của quỹ tiền chờ (tiết kiệm) */
  cashRate: number;
  /** Ngày bắt đầu (YYYY-MM-DD), mặc định từ khi có điểm */
  start?: string;
}

export interface StrategyResult {
  /** Tổng tiền đã bỏ ra (bằng nhau cho cả hai chiến lược) */
  invested: number;
  /** Giá trị cuối kỳ = tài sản + tiền chờ */
  finalValue: number;
  units: number;
  cash: number;
  /** Giá vốn bình quân trên mỗi đơn vị tài sản */
  avgCost: number;
  totalReturn: number;
}

export interface BacktestPoint {
  date: string;
  invested: number;
  plain: number;
  smart: number;
}

export interface BacktestResult {
  plain: StrategyResult;
  smart: StrategyResult;
  series: BacktestPoint[];
  months: number;
}

function scoreAt(scores: Bar[], date: string): number | null {
  let s: number | null = null;
  for (const [d, v] of scores) {
    if (d > date) break;
    s = v;
  }
  return s;
}

/**
 * So sánh DCA đều với DCA theo điểm hấp dẫn.
 * Cả hai đều nhận cùng số tiền mỗi tháng. Chiến lược theo điểm giữ phần chưa mua
 * trong quỹ tiền chờ có lãi, và chỉ mua tối đa số tiền đang có trong quỹ.
 */
export function backtestDca({ bars, scores, monthly, cashRate, start }: BacktestInput): BacktestResult {
  const firstScore = scores[0]?.[0] ?? "9999";
  const begin = start && start > firstScore ? start : firstScore;
  const monthlyRate = cashRate / 12;

  let month = "";
  let invested = 0;
  let plainUnits = 0;
  let plainSpent = 0;
  let smartUnits = 0;
  let smartSpent = 0;
  let cash = 0;
  const series: BacktestPoint[] = [];

  for (const [date, price] of bars) {
    if (date < begin) continue;
    const m = date.slice(0, 7);
    if (m === month) continue;
    month = m;
    const score = scoreAt(scores, date);
    if (score == null) continue;

    invested += monthly;
    plainUnits += monthly / price;
    plainSpent += monthly;

    cash = cash * (1 + monthlyRate) + monthly;
    const buy = Math.min(cash, monthly * multiplierForScore(score));
    cash -= buy;
    smartUnits += buy / price;
    smartSpent += buy;

    series.push({ date, invested, plain: plainUnits * price, smart: smartUnits * price + cash });
  }

  const lastPrice = bars.at(-1)?.[1] ?? 0;
  const result = (units: number, spent: number, c: number): StrategyResult => {
    const finalValue = units * lastPrice + c;
    return {
      invested,
      finalValue,
      units,
      cash: c,
      avgCost: units ? spent / units : 0,
      totalReturn: invested ? finalValue / invested - 1 : 0,
    };
  };

  return {
    plain: result(plainUnits, plainSpent, 0),
    smart: result(smartUnits, smartSpent, cash),
    series,
    months: series.length,
  };
}
