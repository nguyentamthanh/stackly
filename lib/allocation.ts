import { alignMonthly, covariance, frontierCurve, mean, monthlyReturns, optimize, portfolioStats, type Bounds } from "./frontier";
import { PROFILES, type ProfileId } from "./plan";
import type { AssetClass, Bar } from "./types";

/** Thứ tự nhóm tài sản trong các vector/ma trận tối ưu */
export const OPT_CLASSES: AssetClass[] = ["vn", "us", "gold", "crypto", "savings"];

/**
 * Giả định lợi nhuận dài hạn (năm, tính bằng VND) để "co" lợi nhuận lịch sử về.
 * Lợi nhuận lịch sử ngắn hạn rất nhiễu (BTC hơn 60%/năm) — dùng nguyên sẽ dồn tiền vào kênh vừa tăng mạnh nhất.
 */
export const PRIOR_RETURN: Record<Exclude<AssetClass, "savings">, number> = {
  vn: 0.1,
  us: 0.1,
  gold: 0.06,
  crypto: 0.15,
};
/** Tỷ lệ tin vào lợi nhuận lịch sử (phần còn lại theo giả định dài hạn) */
export const HISTORY_WEIGHT = 0.5;

export interface OptProfile {
  /** Biến động năm tối đa chấp nhận */
  targetVol: number;
  /** Giới hạn tỷ trọng theo thứ tự OPT_CLASSES */
  bounds: Bounds;
}

export const OPT_PROFILES: Record<ProfileId, OptProfile> = {
  conservative: {
    targetVol: 0.06,
    bounds: [
      [0, 0.35],
      [0, 0.25],
      [0.05, 0.3],
      [0, 0],
      [0.3, 0.9],
    ],
  },
  balanced: {
    targetVol: 0.1,
    bounds: [
      [0.1, 0.45],
      [0.1, 0.4],
      [0.05, 0.25],
      [0, 0.05],
      [0.05, 0.5],
    ],
  },
  growth: {
    targetVol: 0.15,
    bounds: [
      [0.15, 0.55],
      [0.15, 0.5],
      [0, 0.2],
      [0, 0.1],
      [0, 0.25],
    ],
  },
};

export interface ClassStat {
  cls: AssetClass;
  /** Lợi nhuận lịch sử trung bình năm */
  histReturn: number;
  /** Lợi nhuận kỳ vọng dùng để tối ưu */
  expReturn: number;
  vol: number;
}

export interface ProfileAllocation {
  weights: Record<AssetClass, number>;
  ret: number;
  vol: number;
  targetVol: number;
}

/** File public/data/allocation.json */
export interface AllocationFile {
  updatedAt: string;
  window: { from: string; to: string; months: number };
  classes: ClassStat[];
  /** Ma trận tương quan theo thứ tự OPT_CLASSES */
  corr: number[][];
  optimized: Record<ProfileId, ProfileAllocation>;
  /** Lợi nhuận/biến động kỳ vọng của tỷ trọng cố định để so sánh */
  fixed: Record<ProfileId, { ret: number; vol: number }>;
  frontier: { vol: number; ret: number }[];
}

/** Quy chuỗi giá USD sang VND theo tỷ giá cùng ngày (lấy tỷ giá gần nhất trước đó). */
export function toVnd(usdBars: Bar[], fx: Bar[]): Bar[] {
  const out: Bar[] = [];
  let j = 0;
  let rate: number | null = null;
  for (const [date, p] of usdBars) {
    while (j < fx.length && fx[j][0] <= date) rate = fx[j++][1];
    if (rate != null) out.push([date, p * rate]);
  }
  return out;
}

function toVector(weights: Record<AssetClass, number>): number[] {
  return OPT_CLASSES.map((c) => weights[c]);
}

function toRecord(w: number[]): Record<AssetClass, number> {
  return Object.fromEntries(OPT_CLASSES.map((c, i) => [c, Math.round(w[i] * 1000) / 1000])) as Record<AssetClass, number>;
}

export interface AllocationInput {
  /** Chuỗi giá đại diện (VND) cho từng nhóm có biến động */
  series: Record<Exclude<AssetClass, "savings">, Bar[]>;
  /** Lãi suất tiết kiệm năm */
  savingsRate: number;
  updatedAt: string;
  /** Bước lưới khi tối ưu, mặc định 1% */
  step?: number;
}

export function computeAllocation({ series, savingsRate, updatedAt, step = 0.01 }: AllocationInput): AllocationFile {
  const risky = OPT_CLASSES.filter((c): c is Exclude<AssetClass, "savings"> => c !== "savings");
  const { months, matrix } = alignMonthly(risky.map((c) => monthlyReturns(series[c])));
  if (months.length < 24) throw new Error(`Chỉ có ${months.length} tháng dữ liệu chung, cần ít nhất 24`);

  // Tiết kiệm: lợi nhuận tháng cố định, không biến động
  const monthlySavings = Math.pow(1 + savingsRate, 1 / 12) - 1;
  const full = [...matrix, months.map(() => monthlySavings)];
  const covMonthly = covariance(full);
  const cov = covMonthly.map((row) => row.map((v) => v * 12));

  const classes: ClassStat[] = OPT_CLASSES.map((cls, i) => {
    const histReturn = Math.pow(1 + mean(full[i]), 12) - 1;
    const expReturn = cls === "savings" ? savingsRate : HISTORY_WEIGHT * histReturn + (1 - HISTORY_WEIGHT) * PRIOR_RETURN[cls];
    return { cls, histReturn, expReturn, vol: Math.sqrt(cov[i][i]) };
  });
  const mu = classes.map((c) => c.expReturn);
  const corr = cov.map((row, i) =>
    row.map((v, j) => {
      const d = Math.sqrt(cov[i][i] * cov[j][j]);
      return d > 0 ? Math.round((v / d) * 100) / 100 : i === j ? 1 : 0;
    }),
  );

  const optimized = {} as Record<ProfileId, ProfileAllocation>;
  const fixed = {} as Record<ProfileId, { ret: number; vol: number }>;
  for (const id of Object.keys(OPT_PROFILES) as ProfileId[]) {
    const { targetVol, bounds } = OPT_PROFILES[id];
    const res = optimize({ mu, cov, bounds, targetVol, step });
    if (!res) throw new Error(`Không tìm được phân bổ thỏa giới hạn cho hồ sơ ${id}`);
    optimized[id] = { weights: toRecord(res.weights), ret: res.ret, vol: res.vol, targetVol };
    fixed[id] = portfolioStats(toVector(PROFILES[id].weights), mu, cov);
  }

  const frontierBounds: Bounds = OPT_CLASSES.map((c) => (c === "crypto" ? [0, 0.1] : [0, 1]));
  return {
    updatedAt,
    window: { from: months[0], to: months[months.length - 1], months: months.length },
    classes,
    corr,
    optimized,
    fixed,
    frontier: frontierCurve({ mu, cov, bounds: frontierBounds, step: 0.02 }),
  };
}

export type AllocationMethod = "optimized" | "fixed";

/** Tỷ trọng mục tiêu theo hồ sơ và cách phân bổ; quay về tỷ trọng cố định nếu chưa có dữ liệu tối ưu. */
export function targetWeights(profile: ProfileId, method: AllocationMethod, alloc: AllocationFile | null): Record<AssetClass, number> {
  return method === "optimized" && alloc ? alloc.optimized[profile].weights : PROFILES[profile].weights;
}
