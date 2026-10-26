import { drawdownFromPeak, percentileRank, rsi, sma, toWeekly } from "./indicators";
import { fmtNum, fmtPct } from "./format";
import { xirr } from "./portfolio";
import { multiplierForScore } from "./signals";
import type { AssetClass, Bar } from "./types";

// Các kiểu đầu tư. Ba kiểu đầu áp dụng cho từng tài sản, hai kiểu sau làm việc trên cả danh mục
// hoặc một khoản tiền lớn. Mọi quy tắc chỉ dùng dữ liệu giá miễn phí đã có trong pipeline.

export type StrategyId = "tich-san" | "xu-huong" | "bat-day" | "co-dinh" | "mot-lan";
/** Các kiểu áp dụng cho từng tài sản, so với mốc "mua đều" */
export type AssetStrategyId = "tich-san" | "xu-huong" | "bat-day";

export interface StrategyInfo {
  id: StrategyId;
  name: string;
  tagline: string;
  description: string;
  rules: string[];
  suits: string;
  /** 1 = thấp, 3 = cao */
  risk: 1 | 2 | 3;
  /** Công theo dõi mỗi tháng */
  effort: string;
}

export const STRATEGIES: StrategyInfo[] = [
  {
    id: "tich-san",
    name: "Tích sản theo điểm",
    tagline: "Mua đều mỗi tháng, mua nhiều hơn khi rẻ",
    description:
      "Mỗi tháng để dành một khoản cố định. Khi điểm hấp dẫn cao thì mua gấp 1,5–2 lần, khi đắt thì chỉ mua 0,5–0,75 lần, phần chưa mua gửi tiết kiệm chờ cơ hội.",
    rules: [
      "Chấm điểm 0–100 từ P/E, độ lệch MA200, mức giảm từ đỉnh và RSI tuần.",
      "Hệ số tiền mua: ×0,5 (rất đắt) đến ×2 (rất rẻ).",
      "Không bán, chỉ điều chỉnh tốc độ mua.",
    ],
    suits: "Người có thu nhập đều, muốn tích lũy dài hạn trên 5 năm.",
    risk: 2,
    effort: "5 phút/tháng",
  },
  {
    id: "xu-huong",
    name: "Theo xu hướng",
    tagline: "Nắm giữ khi thị trường tăng, đứng ngoài khi gãy xu hướng",
    description:
      "Chỉ giữ tài sản khi giá nằm trên đường MA200 và lợi nhuận 12 tháng dương. Khi cả hai tín hiệu xấu, chuyển toàn bộ sang tiết kiệm để tránh các đợt sụt giảm dài.",
    rules: [
      "Giá > MA200: +50% tỷ trọng. Lợi nhuận 12 tháng > 0: +50% tỷ trọng.",
      "Xét lại vào đầu mỗi tháng, mua/bán để về đúng tỷ trọng.",
      "Phần không nắm giữ gửi tiết kiệm.",
    ],
    suits: "Người sợ sụt giảm sâu, chấp nhận đôi khi bán hụt nhịp hồi.",
    risk: 2,
    effort: "10 phút/tháng",
  },
  {
    id: "bat-day",
    name: "Bắt đáy",
    tagline: "Gom tiền chờ, giải ngân mạnh khi thị trường hoảng loạn",
    description:
      "Tiền để dành mỗi tháng được gửi tiết kiệm. Chỉ giải ngân khi giá sụt sâu so với lịch sử của chính tài sản đó và RSI tuần quá bán; chốt lời một phần khi giá quá nóng.",
    rules: [
      "Giải ngân hết tiền chờ: mức giảm từ đỉnh sâu hơn 80% lịch sử và RSI tuần ≤ 45.",
      "Giải ngân 1/3 tiền chờ: giảm sâu hơn 65% lịch sử hoặc RSI tuần ≤ 35.",
      "Chốt lời 20%: giá cao hơn MA200 ở mức top 5% lịch sử và RSI tuần ≥ 70.",
    ],
    suits: "Người kiên nhẫn, chịu được việc giữ nhiều tiền mặt trong thị trường tăng.",
    risk: 3,
    effort: "10 phút/tháng",
  },
  {
    id: "co-dinh",
    name: "Danh mục cố định",
    tagline: "Chia sẵn tỷ trọng, tái cân bằng định kỳ, không cần đoán thị trường",
    description:
      "Chia tiền vào chứng khoán VN, chứng khoán Mỹ, vàng và tiết kiệm theo tỷ trọng cố định. Định kỳ bán phần tăng nhiều, mua phần tăng ít để về lại tỷ trọng ban đầu.",
    rules: [
      "Chọn một mẫu tỷ trọng (Bốn mùa, Cân bằng 60/40, Tăng trưởng).",
      "Tiền mới ưu tiên rót vào kênh đang thiếu tỷ trọng.",
      "Tái cân bằng toàn bộ mỗi năm hoặc khi lệch quá 5 điểm %.",
    ],
    suits: "Người bận rộn, muốn đa dạng hóa và giảm biến động.",
    risk: 1,
    effort: "15 phút/năm",
  },
  {
    id: "mot-lan",
    name: "Một lần hay chia nhỏ",
    tagline: "Có khoản tiền lớn: giải ngân ngay hay chia dần?",
    description:
      "So sánh trên toàn bộ lịch sử: bỏ hết tiền một lần với chia đều trong 3–24 tháng (phần chờ gửi tiết kiệm). Cho biết tỷ lệ thắng, chênh lệch trung bình và trường hợp xấu nhất.",
    rules: [
      "Xét mọi tháng bắt đầu trong lịch sử, cùng một kỳ hạn nắm giữ.",
      "Chia nhỏ: mua đều mỗi tháng, tiền chưa mua hưởng lãi tiết kiệm.",
      "Đo giá trị cuối kỳ của hai cách trên cùng số vốn.",
    ],
    suits: "Người vừa nhận thưởng, bán nhà, đáo hạn sổ tiết kiệm.",
    risk: 2,
    effort: "Một lần",
  },
];

export const ASSET_STRATEGIES: AssetStrategyId[] = ["tich-san", "xu-huong", "bat-day"];

export function getStrategy(id: string): StrategyInfo | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Chỉ báo dùng chung

/** Cửa sổ lịch sử để tính percentile: ~10 năm giao dịch (giống lib/signals.ts) */
const LOOKBACK = 2520;
const MIN_HISTORY = 250;

interface Series {
  dates: string[];
  closes: number[];
  ma: (number | null)[];
  dd: number[];
  /** RSI tuần ứng với mỗi phiên ngày */
  rsiAt: (number | null)[];
}

export function prepareSeries(bars: Bar[]): Series {
  const dates = bars.map((b) => b[0]);
  const closes = bars.map((b) => b[1]);
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
  return { dates, closes, ma: sma(closes, 200), dd: drawdownFromPeak(closes), rsiAt };
}

/** Percentile của phần tử i trong cửa sổ lịch sử tới i, null nếu chưa đủ dữ liệu */
function pctAt(values: (number | null)[], i: number): number | null {
  const v = values[i];
  if (v == null) return null;
  const hist: number[] = [];
  for (let k = Math.max(0, i - LOOKBACK + 1); k <= i; k++) if (values[k] != null) hist.push(values[k] as number);
  return hist.length >= MIN_HISTORY ? percentileRank(hist, v) : null;
}

/** Chỉ số phiên đầu tiên của mỗi tháng */
export function monthStarts(dates: string[]): number[] {
  const out: number[] = [];
  let month = "";
  dates.forEach((d, i) => {
    const m = d.slice(0, 7);
    if (m !== month) {
      out.push(i);
      month = m;
    }
  });
  return out;
}

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

// ---------------------------------------------------------------------------
// Trạng thái hiện tại theo từng kiểu

export type Stance = "buy" | "hold" | "wait" | "sell";

export interface StrategyState {
  stance: Stance;
  label: string;
  detail: string;
  /** Tỷ trọng nên nắm giữ (kiểu xu hướng) */
  exposure?: number;
}

export interface TrendReading {
  exposure: 0 | 0.5 | 1;
  /** Giá / MA200 − 1 */
  dev: number | null;
  /** Lợi nhuận ~12 tháng (252 phiên) */
  momentum: number | null;
}

export function trendAt(s: Series, i: number): TrendReading | null {
  const ma = s.ma[i];
  if (ma == null) return null;
  const dev = s.closes[i] / ma - 1;
  const momentum = i >= 252 ? s.closes[i] / s.closes[i - 252] - 1 : null;
  const exposure = ((dev > 0 ? 0.5 : 0) + (momentum != null && momentum > 0 ? 0.5 : 0)) as 0 | 0.5 | 1;
  return { exposure, dev, momentum };
}

export function trendState(s: Series, i = s.closes.length - 1): StrategyState | null {
  const t = trendAt(s, i);
  if (!t) return null;
  const parts = [
    `Giá ${t.dev! >= 0 ? "trên" : "dưới"} MA200 ${fmtPct(Math.abs(t.dev!))}`,
    t.momentum == null ? "chưa đủ 12 tháng dữ liệu" : `lợi nhuận 12 tháng ${fmtPct(t.momentum, 1, true)}`,
  ];
  const detail = parts.join(", ") + ".";
  if (t.exposure === 1) return { stance: "hold", label: "Nắm giữ 100%", detail, exposure: 1 };
  if (t.exposure === 0.5) return { stance: "wait", label: "Giữ 50%", detail: detail + " Tín hiệu trái chiều.", exposure: 0.5 };
  return { stance: "sell", label: "Đứng ngoài", detail: detail + " Chuyển sang tiết kiệm.", exposure: 0 };
}

export type DipAction = "all-in" | "partial" | "trim" | "wait";

export interface DipReading {
  action: DipAction;
  dd: number;
  /** Percentile mức giảm từ đỉnh (thấp = giảm sâu hiếm gặp) */
  ddPct: number | null;
  rsi: number | null;
  /** Percentile độ lệch so với MA200 */
  devPct: number | null;
}

export function dipAt(s: Series, i: number, devs?: (number | null)[]): DipReading {
  const dev = devs ?? s.closes.map((c, k) => (s.ma[k] == null ? null : c / s.ma[k]! - 1));
  const dd = s.dd[i];
  const ddPct = pctAt(s.dd, i);
  const devPct = pctAt(dev, i);
  const r = s.rsiAt[i];
  // Khi chưa đủ lịch sử để tính percentile, dùng ngưỡng cố định
  const deep = ddPct != null ? ddPct <= 20 : dd <= -0.25;
  const near = ddPct != null ? ddPct <= 35 : dd <= -0.15;
  const hot = devPct != null ? devPct >= 95 : (dev[i] ?? 0) >= 0.3;
  let action: DipAction = "wait";
  if (deep && r != null && r <= 45) action = "all-in";
  else if (near || (r != null && r <= 35)) action = "partial";
  else if (hot && r != null && r >= 70) action = "trim";
  return { action, dd, ddPct, rsi: r, devPct };
}

export function dipState(s: Series, i = s.closes.length - 1): StrategyState {
  const d = dipAt(s, i);
  const ddText = d.dd === 0 ? "Giá đang ở đỉnh" : `Giảm ${fmtPct(-d.dd)} từ đỉnh` + (d.ddPct != null ? ` (sâu hơn ${fmtNum(100 - d.ddPct, 0)}% lịch sử)` : "");
  const detail = `${ddText}${d.rsi != null ? `, RSI tuần ${fmtNum(d.rsi, 0)}` : ""}.`;
  switch (d.action) {
    case "all-in":
      return { stance: "buy", label: "Giải ngân mạnh", detail };
    case "partial":
      return { stance: "buy", label: "Giải ngân 1/3", detail };
    case "trim":
      return { stance: "sell", label: "Chốt lời 20%", detail: detail + " Giá đang quá nóng." };
    default:
      return { stance: "wait", label: "Chờ", detail: detail + " Giữ tiền ở tiết kiệm." };
  }
}

// ---------------------------------------------------------------------------
// Backtest theo tháng cho từng tài sản

export interface PerfStats {
  invested: number;
  finalValue: number;
  /** Giá trị cuối / tổng vốn − 1 */
  totalReturn: number;
  /** Lợi suất theo dòng tiền (XIRR) */
  irr: number | null;
  /** Tăng trưởng kép theo thời gian (loại bỏ ảnh hưởng của tiền nạp thêm) */
  cagr: number | null;
  /** Mức sụt giảm lớn nhất của chỉ số tăng trưởng theo thời gian */
  maxDrawdown: number;
  /** Tỷ trọng tài sản rủi ro trung bình */
  exposure: number;
  /** Số tháng có mua hoặc bán */
  trades: number;
}

export interface SimResult {
  stats: PerfStats;
  /** Giá trị danh mục đầu mỗi tháng */
  series: Bar[];
}

interface Decision {
  /** Số tiền mua (giới hạn bởi tiền chờ) */
  buy?: number;
  /** Số tiền bán (giới hạn bởi giá trị đang giữ) */
  sell?: number;
}

type Decide = (ctx: { k: number; i: number; price: number; units: number; cash: number; monthly: number }) => Decision;

function simulate(bars: Bar[], idx: number[], monthly: number, cashRate: number, decide: Decide): SimResult {
  const rm = cashRate / 12;
  let units = 0;
  let cash = 0;
  let invested = 0;
  let twr = 1;
  let peak = 1;
  let maxDrawdown = 0;
  let prevPost = 0;
  let exposureSum = 0;
  let trades = 0;
  const series: Bar[] = [];
  const flows: { date: string; amount: number }[] = [];

  idx.forEach((i, k) => {
    const [date, price] = bars[i];
    cash *= 1 + rm;
    const pre = units * price + cash;
    if (prevPost > 0) {
      twr *= pre / prevPost;
      peak = Math.max(peak, twr);
      maxDrawdown = Math.min(maxDrawdown, twr / peak - 1);
    }
    cash += monthly;
    invested += monthly;
    flows.push({ date, amount: -monthly });

    const { buy = 0, sell = 0 } = decide({ k, i, price, units, cash, monthly });
    const s = Math.min(Math.max(sell, 0), units * price);
    units -= s / price;
    cash += s;
    const b = Math.min(Math.max(buy, 0), cash);
    units += b / price;
    cash -= b;
    if (s > 1e-9 || b > 1e-9) trades++;

    const post = units * price + cash;
    exposureSum += post > 0 ? (units * price) / post : 0;
    prevPost = post;
    series.push([date, post]);
  });

  const last = bars.at(-1)!;
  const lastI = idx.at(-1) ?? 0;
  // Định giá cuối kỳ theo giá phiên cuối, tiền chờ hưởng thêm lãi phần ngày lẻ
  const days = (Date.parse(last[0]) - Date.parse(bars[lastI][0])) / 86400000;
  const finalCash = cash * (1 + (cashRate * days) / 365);
  const finalValue = units * last[1] + finalCash;
  if (prevPost > 0) {
    twr *= finalValue / prevPost;
    peak = Math.max(peak, twr);
    maxDrawdown = Math.min(maxDrawdown, twr / peak - 1);
  }
  const years = idx.length ? (Date.parse(last[0]) - Date.parse(bars[idx[0]][0])) / (365.25 * 86400000) : 0;
  return {
    stats: {
      invested,
      finalValue,
      totalReturn: invested ? finalValue / invested - 1 : 0,
      irr: invested ? xirr([...flows, { date: last[0], amount: finalValue }]) : null,
      cagr: years >= 1 ? Math.pow(twr, 1 / years) - 1 : null,
      maxDrawdown,
      exposure: idx.length ? exposureSum / idx.length : 0,
      trades,
    },
    series,
  };
}

function scoreAtFactory(scores: Bar[]) {
  const dates = scores.map((s) => s[0]);
  return (date: string): number | null => {
    const j = indexAtOrBefore(dates, date);
    return j >= 0 ? scores[j][1] : null;
  };
}

export interface AssetBacktestInput {
  /** Giá ngày, đã quy đổi VND nếu là tài sản USD */
  bars: Bar[];
  /** Điểm hấp dẫn theo tuần (lib/signals.ts scoreHistory) */
  scores: Bar[];
  monthly: number;
  cashRate: number;
}

export interface AssetBacktest {
  start: string;
  months: number;
  plain: SimResult;
  results: Record<AssetStrategyId, SimResult>;
}

/**
 * Chạy cùng một dòng tiền tháng qua bốn cách: mua đều, tích sản theo điểm, theo xu hướng, bắt đáy.
 * Bắt đầu khi đủ dữ liệu cho mọi kiểu (sau MA200 và có điểm hấp dẫn), để so sánh công bằng.
 */
export function backtestAsset({ bars, scores, monthly, cashRate }: AssetBacktestInput): AssetBacktest | null {
  if (bars.length < 260 || !scores.length) return null;
  const s = prepareSeries(bars);
  const begin = scores[0][0] > bars[200][0] ? scores[0][0] : bars[200][0];
  const idx = monthStarts(s.dates).filter((i) => s.dates[i] >= begin);
  if (idx.length < 12) return null;

  const scoreAt = scoreAtFactory(scores);
  const devs = s.closes.map((c, k) => (s.ma[k] == null ? null : c / s.ma[k]! - 1));

  const plain = simulate(bars, idx, monthly, cashRate, ({ cash }) => ({ buy: cash }));
  const dca = simulate(bars, idx, monthly, cashRate, ({ i, monthly: m }) => {
    const score = scoreAt(s.dates[i]);
    return { buy: m * (score == null ? 1 : multiplierForScore(score)) };
  });
  const trend = simulate(bars, idx, monthly, cashRate, ({ i, price, units, cash }) => {
    const t = trendAt(s, i);
    const target = (t?.exposure ?? 1) * (units * price + cash);
    const diff = target - units * price;
    return diff >= 0 ? { buy: diff } : { sell: -diff };
  });
  const dip = simulate(bars, idx, monthly, cashRate, ({ i, price, units, cash }) => {
    const d = dipAt(s, i, devs);
    if (d.action === "all-in") return { buy: cash };
    if (d.action === "partial") return { buy: cash / 3 };
    if (d.action === "trim") return { sell: units * price * 0.2 };
    return {};
  });

  return {
    start: s.dates[idx[0]],
    months: idx.length,
    plain,
    results: { "tich-san": dca, "xu-huong": trend, "bat-day": dip },
  };
}

// ---------------------------------------------------------------------------
// Danh mục cố định

export interface FixedPreset {
  id: string;
  name: string;
  description: string;
  weights: Record<AssetClass, number>;
}

export const FIXED_PRESETS: FixedPreset[] = [
  {
    id: "bon-mua",
    name: "Bốn mùa",
    description: "Chia đều bốn kênh. Mùa nào cũng có một kênh chống đỡ: tăng trưởng, lạm phát, khủng hoảng, giảm phát.",
    weights: { vn: 0.25, us: 0.25, gold: 0.25, savings: 0.25, crypto: 0 },
  },
  {
    id: "can-bang",
    name: "Cân bằng 60/40",
    description: "60% cổ phiếu VN và Mỹ để tăng trưởng, 40% vàng và tiết kiệm để giảm sốc.",
    weights: { vn: 0.35, us: 0.25, gold: 0.1, savings: 0.3, crypto: 0 },
  },
  {
    id: "tang-truong",
    name: "Tăng trưởng",
    description: "80% cổ phiếu, một ít vàng và crypto. Biến động lớn, hợp với tầm nhìn trên 10 năm.",
    weights: { vn: 0.4, us: 0.4, gold: 0.1, savings: 0.05, crypto: 0.05 },
  },
];

export type RebalanceMode = "none" | "yearly" | "band";

export const REBALANCE_LABELS: Record<RebalanceMode, string> = {
  none: "Không tái cân bằng",
  yearly: "Tái cân bằng hằng năm",
  band: "Khi lệch quá 5 điểm %",
};

const RISKY_CLASSES: AssetClass[] = ["vn", "us", "gold", "crypto"];

/**
 * Chia khoản tiền mới (và tùy chọn bán bớt) để đưa danh mục về gần tỷ trọng mục tiêu.
 * Trả số tiền mua (+) hoặc bán (−) cho từng kênh.
 * Không cho bán: rót tiền mới vào các kênh thiếu tỷ trọng theo tỷ lệ phần thiếu, phần dư chia theo tỷ trọng.
 */
export function rebalancePlan(
  current: Record<AssetClass, number>,
  weights: Record<AssetClass, number>,
  newMoney: number,
  allowSell: boolean,
): Record<AssetClass, number> {
  const classes = Object.keys(weights) as AssetClass[];
  const total = classes.reduce((a, c) => a + (current[c] ?? 0), 0) + newMoney;
  const out = Object.fromEntries(classes.map((c) => [c, 0])) as Record<AssetClass, number>;
  if (total <= 0) return out;
  if (allowSell) {
    for (const c of classes) out[c] = weights[c] * total - (current[c] ?? 0);
    return out;
  }
  const deficits = classes.map((c) => Math.max(0, weights[c] * total - (current[c] ?? 0)));
  const sumDef = deficits.reduce((a, b) => a + b, 0);
  if (sumDef >= newMoney) {
    classes.forEach((c, k) => (out[c] = sumDef > 0 ? (deficits[k] / sumDef) * newMoney : 0));
  } else {
    const rest = newMoney - sumDef;
    classes.forEach((c, k) => (out[c] = deficits[k] + rest * weights[c]));
  }
  return out;
}

export interface FixedBacktestInput {
  /** Giá VND theo kênh (không cần tiết kiệm) */
  series: Partial<Record<AssetClass, Bar[]>>;
  weights: Record<AssetClass, number>;
  monthly: number;
  cashRate: number;
  mode: RebalanceMode;
}

export interface FixedBacktest {
  start: string;
  months: number;
  stats: PerfStats;
  series: Bar[];
  /** Tỷ trọng cuối kỳ */
  finalWeights: Record<AssetClass, number>;
}

/** Giá phiên đầu tiên của mỗi tháng, khóa "YYYY-MM" */
function monthOpenMap(bars: Bar[]): Map<string, Bar> {
  const out = new Map<string, Bar>();
  for (const b of bars) {
    const m = b[0].slice(0, 7);
    if (!out.has(m)) out.set(m, b);
  }
  return out;
}

export function backtestFixed({ series, weights, monthly, cashRate, mode }: FixedBacktestInput): FixedBacktest | null {
  const used = RISKY_CLASSES.filter((c) => weights[c] > 0);
  const maps = used.map((c) => monthOpenMap(series[c] ?? []));
  if (maps.some((m) => m.size === 0)) return null;
  if (used.length === 0) return null;
  const months = [...maps[0].keys()].filter((m) => maps.every((x) => x.has(m))).sort();
  if (months.length < 12) return null;

  const rm = cashRate / 12;
  const all: AssetClass[] = [...used, "savings"];
  const units: Record<string, number> = Object.fromEntries(used.map((c) => [c, 0]));
  let cash = 0;
  let invested = 0;
  let twr = 1;
  let peak = 1;
  let maxDrawdown = 0;
  let prevPost = 0;
  let exposureSum = 0;
  let trades = 0;
  const out: Bar[] = [];
  const flows: { date: string; amount: number }[] = [];
  let lastYear = "";

  const values = (prices: Record<string, number>) =>
    Object.fromEntries(all.map((c) => [c, c === "savings" ? cash : units[c] * prices[c]])) as Record<AssetClass, number>;

  for (const m of months) {
    const prices: Record<string, number> = {};
    used.forEach((c, k) => (prices[c] = maps[k].get(m)![1]));
    const date = maps.map((x) => x.get(m)![0]).sort()[0];
    cash *= 1 + rm;
    let v = values(prices);
    const pre = all.reduce((a, c) => a + v[c], 0);
    if (prevPost > 0) {
      twr *= pre / prevPost;
      peak = Math.max(peak, twr);
      maxDrawdown = Math.min(maxDrawdown, twr / peak - 1);
    }
    invested += monthly;
    flows.push({ date, amount: -monthly });

    const total = pre + monthly;
    const drift = all.some((c) => Math.abs((v[c] ?? 0) / Math.max(total, 1) - weights[c]) > 0.05);
    const full = mode === "yearly" ? m.slice(0, 4) !== lastYear && lastYear !== "" : mode === "band" ? drift : false;
    lastYear = m.slice(0, 4);
    const plan =
      mode === "none"
        ? (Object.fromEntries(all.map((c) => [c, monthly * weights[c]])) as Record<AssetClass, number>)
        : rebalancePlan(v, weights, monthly, full);
    // Tiền mới vào quỹ tiết kiệm trước, sau đó chuyển sang các kênh theo kế hoạch
    cash += monthly;
    for (const c of used) {
      const amt = plan[c] ?? 0;
      if (Math.abs(amt) > 1e-9) {
        units[c] += amt / prices[c];
        cash -= amt;
      }
    }
    if (full) trades++;
    v = values(prices);
    const post = all.reduce((a, c) => a + v[c], 0);
    exposureSum += post > 0 ? (post - cash) / post : 0;
    prevPost = post;
    out.push([date, post]);
  }

  // Định giá cuối kỳ theo giá cuối cùng của từng kênh
  const lastPrices: Record<string, number> = {};
  used.forEach((c) => (lastPrices[c] = series[c]!.at(-1)![1]));
  const lastDate = used.map((c) => series[c]!.at(-1)![0]).sort()[0];
  const v = values(lastPrices);
  const finalValue = all.reduce((a, c) => a + v[c], 0);
  if (prevPost > 0) {
    twr *= finalValue / prevPost;
    peak = Math.max(peak, twr);
    maxDrawdown = Math.min(maxDrawdown, twr / peak - 1);
  }
  const years = (Date.parse(lastDate) - Date.parse(out[0][0])) / (365.25 * 86400000);
  return {
    start: out[0][0],
    months: months.length,
    stats: {
      invested,
      finalValue,
      totalReturn: finalValue / invested - 1,
      irr: xirr([...flows, { date: lastDate, amount: finalValue }]),
      cagr: years >= 1 ? Math.pow(twr, 1 / years) - 1 : null,
      maxDrawdown,
      exposure: exposureSum / months.length,
      trades,
    },
    series: out,
    finalWeights: Object.fromEntries(
      (Object.keys(weights) as AssetClass[]).map((c) => [c, finalValue > 0 ? (v[c] ?? 0) / finalValue : 0]),
    ) as Record<AssetClass, number>,
  };
}

// ---------------------------------------------------------------------------
// Một lần hay chia nhỏ

export interface LumpInput {
  /** Giá đầu mỗi tháng (đã quy đổi VND) */
  monthly: Bar[];
  /** Số tháng chia nhỏ */
  spread: number;
  /** Kỳ hạn nắm giữ tính từ lúc bắt đầu (tháng), >= spread */
  horizon: number;
  cashRate: number;
}

export interface LumpCase {
  start: string;
  /** Giá trị cuối kỳ của 1 đồng vốn */
  lump: number;
  dca: number;
}

export interface LumpResult {
  cases: LumpCase[];
  lumpWinRate: number;
  /** Trung vị (lump − dca) / dca */
  medianEdge: number;
  avgLump: number;
  avgDca: number;
  worstLump: LumpCase;
  worstDca: LumpCase;
}

/** Thu gọn giá ngày thành giá phiên đầu mỗi tháng */
export function monthlyOpens(bars: Bar[]): Bar[] {
  return [...monthOpenMap(bars).values()];
}

export function lumpVsDca({ monthly, spread, horizon, cashRate }: LumpInput): LumpResult | null {
  const n = Math.max(1, Math.round(spread));
  const h = Math.max(n, Math.round(horizon));
  const rm = cashRate / 12;
  const cases: LumpCase[] = [];
  for (let s = 0; s + h < monthly.length; s++) {
    const p = (k: number) => monthly[s + k][1];
    const end = p(h);
    const lump = end / p(0);
    let cash = 1;
    let units = 0;
    for (let k = 0; k < n; k++) {
      if (k > 0) cash *= 1 + rm;
      // Số tiền mỗi lần = phần còn lại chia đều cho số lần còn lại (đã gồm lãi)
      const buy = cash / (n - k);
      units += buy / p(k);
      cash -= buy;
    }
    cases.push({ start: monthly[s][0], lump, dca: units * end + cash });
  }
  if (!cases.length) return null;
  const edges = cases.map((c) => c.lump / c.dca - 1).sort((a, b) => a - b);
  const mid = edges.length >> 1;
  const medianEdge = edges.length % 2 ? edges[mid] : (edges[mid - 1] + edges[mid]) / 2;
  return {
    cases,
    lumpWinRate: cases.filter((c) => c.lump > c.dca).length / cases.length,
    medianEdge,
    avgLump: cases.reduce((a, c) => a + c.lump, 0) / cases.length,
    avgDca: cases.reduce((a, c) => a + c.dca, 0) / cases.length,
    worstLump: cases.reduce((a, c) => (c.lump < a.lump ? c : a)),
    worstDca: cases.reduce((a, c) => (c.dca < a.dca ? c : a)),
  };
}
