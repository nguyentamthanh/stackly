import { changeOver, drawdownFromPeak, linearScore, percentileRank, rsi, sma, toWeekly } from "./indicators";
import { fmtNum, fmtPct } from "./format";
import type { Bar, ComponentKey, ScoreComponent, Signal, SignalLevel } from "./types";

export type SignalKind = "equity" | "crypto" | "gold" | "savings";

export interface SignalInput {
  id: string;
  kind: SignalKind;
  /** Chuỗi giá ngày dùng tính chỉ báo (với vàng: giá thế giới quy đổi VND) */
  bars: Bar[];
  /** Chuỗi giá để hiển thị giá và % thay đổi, mặc định = bars */
  priceBars?: Bar[];
  /** Lịch sử P/E thị trường */
  pe?: Bar[];
  /** Lịch sử chênh lệch giá vàng trong nước so với thế giới (tỷ lệ, 0.1 = 10%) */
  premium?: Bar[];
  /** Lãi suất thực (tiết kiệm) */
  realRate?: number;
  /** Ghi đè giá hiển thị (tiết kiệm: lãi suất) */
  price?: number;
  asOf?: string;
  stale?: boolean;
}

const WEIGHTS: Record<SignalKind, Partial<Record<ComponentKey, number>>> = {
  equity: { pe: 35, ma200: 25, drawdown: 20, rsi: 20 },
  crypto: { mayer: 40, drawdown: 30, rsi: 30 },
  gold: { premium: 40, ma200: 25, drawdown: 15, rsi: 20 },
  savings: { realRate: 100 },
};

/** Cửa sổ lịch sử để tính percentile: ~10 năm giao dịch */
const LOOKBACK = 2520;
/** Số điểm tối thiểu để percentile có ý nghĩa */
const MIN_HISTORY = 250;

interface LevelInfo {
  level: SignalLevel;
  label: string;
  multiplier: number;
  action: string;
}

const LEVELS: (LevelInfo & { min: number })[] = [
  { min: 80, level: "very-cheap", label: "Rất rẻ", multiplier: 2, action: "Tăng mạnh tiền tích sản (×2)" },
  { min: 60, level: "cheap", label: "Rẻ", multiplier: 1.5, action: "Tăng tiền tích sản (×1,5)" },
  { min: 40, level: "neutral", label: "Trung tính", multiplier: 1, action: "Tích sản đều như kế hoạch (×1)" },
  { min: 20, level: "expensive", label: "Hơi đắt", multiplier: 0.75, action: "Giảm nhẹ tiền tích sản (×0,75)" },
  {
    min: -Infinity,
    level: "very-expensive",
    label: "Rất đắt",
    multiplier: 0.5,
    action: "Giảm một nửa tiền tích sản (×0,5), cân nhắc chốt lời một phần",
  },
];

export function levelForScore(score: number): LevelInfo {
  const { level, label, multiplier, action } = LEVELS.find((l) => score >= l.min)!;
  return { level, label, multiplier, action };
}

export function multiplierForScore(score: number): number {
  return levelForScore(score).multiplier;
}

interface Context {
  input: SignalInput;
  dates: string[];
  closes: number[];
  ma: (number | null)[];
  dev: (number | null)[];
  dd: number[];
  /** RSI tuần ứng với mỗi phiên ngày (dùng tuần gần nhất đã có) */
  rsiAt: (number | null)[];
  peDates: string[];
  peValues: number[];
}

function prepare(input: SignalInput): Context {
  const { bars } = input;
  const dates = bars.map((b) => b[0]);
  const closes = bars.map((b) => b[1]);
  const ma = sma(closes, 200);
  const dev = closes.map((c, i) => (ma[i] == null ? null : c / ma[i]! - 1));
  const dd = drawdownFromPeak(closes);

  const weekly = toWeekly(bars);
  const wr = rsi(
    weekly.map((b) => b[1]),
    14,
  );
  const rsiAt: (number | null)[] = new Array(bars.length).fill(null);
  let w = 0;
  for (let i = 0; i < bars.length; i++) {
    while (w + 1 < weekly.length && weekly[w + 1][0] <= dates[i]) w++;
    rsiAt[i] = weekly.length && weekly[w][0] <= dates[i] ? wr[w] : null;
  }

  const pe = input.pe ?? [];
  return { input, dates, closes, ma, dev, dd, rsiAt, peDates: pe.map((p) => p[0]), peValues: pe.map((p) => p[1]) };
}

/** Chỉ số của phần tử cuối cùng có ngày <= date (tìm nhị phân), -1 nếu không có */
function indexAtOrBefore(sortedDates: string[], date: string): number {
  let lo = 0;
  let hi = sortedDates.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedDates[mid] <= date) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
}

function window<T>(arr: (T | null)[], i: number): T[] {
  const out: T[] = [];
  for (let k = Math.max(0, i - LOOKBACK + 1); k <= i; k++) if (arr[k] != null) out.push(arr[k] as T);
  return out;
}

/** Diễn đạt percentile theo hướng dễ hiểu: "cao hơn 80%" hoặc "thấp hơn 91%" */
function relative(pct: number): string {
  return pct >= 50 ? `cao hơn ${fmtNum(pct, 0)}%` : `thấp hơn ${fmtNum(100 - pct, 0)}%`;
}

function rsiZone(r: number): string {
  if (r >= 70) return "vùng quá mua";
  if (r <= 30) return "vùng quá bán";
  return r >= 55 ? "đà tăng" : r <= 45 ? "đà giảm" : "trung tính";
}

function rawComponents(ctx: Context, i: number): Omit<ScoreComponent, "weight">[] {
  const { input } = ctx;
  const weights = WEIGHTS[input.kind];
  const out: Omit<ScoreComponent, "weight">[] = [];
  const date = ctx.dates[i];

  if (weights.realRate != null && input.realRate != null) {
    const r = input.realRate;
    out.push({
      key: "realRate",
      name: "Lãi suất thực",
      value: r,
      display: fmtPct(r, 2),
      score: linearScore(r, -0.01, 0.04),
      explanation:
        r > 0
          ? `Lãi suất tiết kiệm đang cao hơn lạm phát ${fmtPct(r, 2)}, tiền gửi vẫn tăng giá trị thực.`
          : `Lãi suất tiết kiệm đang thấp hơn lạm phát, tiền gửi bị mất giá trị thực.`,
    });
  }
  if (i < 0) return out;

  if (weights.pe != null && ctx.peValues.length) {
    const k = indexAtOrBefore(ctx.peDates, date);
    if (k >= 60 && daysBetween(ctx.peDates[k], date) <= 10) {
      const hist = ctx.peValues.slice(Math.max(0, k - LOOKBACK + 1), k + 1);
      const pe = ctx.peValues[k];
      const pct = percentileRank(hist, pe);
      out.push({
        key: "pe",
        name: "Định giá P/E VN-Index",
        value: pe,
        display: fmtNum(pe, 1) + " lần",
        score: 100 - pct,
        explanation: `P/E thị trường ${fmtNum(pe, 1)} lần, ${relative(pct)} số phiên kể từ ${ctx.peDates[0].slice(0, 4)}.`,
      });
    }
  }

  if (weights.ma200 != null && ctx.dev[i] != null) {
    const d = ctx.dev[i]!;
    const hist = window(ctx.dev, i);
    const enough = hist.length >= MIN_HISTORY;
    const pct = enough ? percentileRank(hist, d) : null;
    out.push({
      key: "ma200",
      name: "So với MA200",
      value: d,
      display: fmtPct(d, 1, true),
      score: pct != null ? 100 - pct : linearScore(d, 0.15, -0.15),
      explanation:
        `Giá ${d >= 0 ? "cao" : "thấp"} hơn đường trung bình 200 phiên ${fmtPct(Math.abs(d))}` +
        (pct != null ? `, mức lệch này ${relative(pct)} lịch sử.` : "."),
    });
  }

  if (weights.mayer != null && ctx.ma[i] != null) {
    const mm = ctx.closes[i] / ctx.ma[i]!;
    out.push({
      key: "mayer",
      name: "Mayer Multiple",
      value: mm,
      display: fmtNum(mm, 2),
      score: linearScore(mm, 2.2, 0.8),
      explanation: `Giá / MA200 = ${fmtNum(mm, 2)}. Dưới 1 thường là vùng tích lũy tốt, trên 2,4 thường là bong bóng.`,
    });
  }

  if (weights.drawdown != null) {
    const d = ctx.dd[i];
    const hist = window(ctx.dd, i);
    const pct = hist.length >= MIN_HISTORY ? percentileRank(hist, d) : null;
    out.push({
      key: "drawdown",
      name: "Giảm từ đỉnh",
      value: d,
      display: d === 0 ? "Đang ở đỉnh" : fmtPct(d, 1),
      score: pct != null ? 100 - pct : linearScore(d, 0, -0.3),
      explanation: d === 0 ? "Giá đang ở mức cao nhất trong lịch sử dữ liệu." : `Giá đang thấp hơn đỉnh cao nhất ${fmtPct(-d)}.`,
    });
  }

  if (weights.rsi != null && ctx.rsiAt[i] != null) {
    const r = ctx.rsiAt[i]!;
    out.push({
      key: "rsi",
      name: "RSI tuần",
      value: r,
      display: fmtNum(r, 0),
      score: linearScore(r, 75, 30),
      explanation: `RSI(14) khung tuần = ${fmtNum(r, 0)}, ${rsiZone(r)}.`,
    });
  }

  if (weights.premium != null && input.premium?.length) {
    const pDates = input.premium.map((p) => p[0]);
    const k = indexAtOrBefore(pDates, date);
    const near = k >= 0 && daysBetween(pDates[k], date) <= 10 ? k : -1;
    // Dữ liệu vàng trong nước có thể mới hơn phiên thế giới cuối cùng
    const j = near >= 0 ? near : i === ctx.dates.length - 1 && daysBetween(pDates.at(-1)!, date) <= 10 ? pDates.length - 1 : -1;
    if (j >= 0) {
      const p = input.premium[j][1];
      out.push({
        key: "premium",
        name: "Chênh lệch với thế giới",
        value: p,
        display: fmtPct(p, 1, true),
        score: linearScore(p, 0.2, 0.02),
        explanation: `Giá bán trong nước đang ${p >= 0 ? "cao" : "thấp"} hơn giá thế giới quy đổi ${fmtPct(Math.abs(p))}. Chênh lệch càng cao thì rủi ro mua đắt càng lớn.`,
      });
    }
  }

  return out;
}

function combine(kind: SignalKind, raw: Omit<ScoreComponent, "weight">[]): { score: number; components: ScoreComponent[] } {
  const weights = WEIGHTS[kind];
  const total = raw.reduce((a, c) => a + (weights[c.key] ?? 0), 0);
  if (total === 0) return { score: 50, components: [] };
  const components = raw.map((c) => ({ ...c, weight: ((weights[c.key] ?? 0) / total) * 100 }));
  const score = components.reduce((a, c) => a + (c.score * c.weight) / 100, 0);
  return { score, components };
}

export function computeSignal(input: SignalInput): Signal {
  const ctx = prepare(input);
  const i = ctx.dates.length - 1;
  const { score, components } = combine(input.kind, rawComponents(ctx, i));
  const priceBars = input.priceBars?.length ? input.priceBars : input.bars;
  const sparkSource = priceBars.length >= 10 ? priceBars : input.bars;
  return {
    id: input.id,
    score: Math.round(score * 10) / 10,
    ...levelForScore(score),
    components,
    price: input.price ?? priceBars.at(-1)?.[1] ?? 0,
    change1d: changeOver(priceBars, 1),
    change1m: changeOver(priceBars, 30),
    change1y: changeOver(priceBars, 365),
    asOf: input.asOf ?? priceBars.at(-1)?.[0] ?? new Date().toISOString().slice(0, 10),
    stale: input.stale ?? false,
    spark: toWeekly(sparkSource)
      .slice(-52)
      .map((b) => b[1]),
  };
}

/** Điểm hấp dẫn theo tuần trên toàn bộ lịch sử có đủ dữ liệu (sau 200 phiên khởi động). */
export function scoreHistory(input: SignalInput): Bar[] {
  const ctx = prepare(input);
  const out: Bar[] = [];
  const weekly = toWeekly(input.bars);
  let i = 0;
  for (const [date] of weekly) {
    while (i < ctx.dates.length && ctx.dates[i] < date) i++;
    if (i < 200) continue;
    const { score, components } = combine(input.kind, rawComponents(ctx, i));
    if (components.length) out.push([date, Math.round(score * 10) / 10]);
  }
  return out;
}
