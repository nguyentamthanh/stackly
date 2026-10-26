import type { Bar } from "./types";

/** Giới hạn [min, max] tỷ trọng của từng tài sản */
export type Bounds = [number, number][];

/** Lợi nhuận theo tháng (giá cuối tháng so với cuối tháng trước), khóa "YYYY-MM". */
export function monthlyReturns(bars: Bar[]): Map<string, number> {
  const monthEnd = new Map<string, number>();
  for (const [date, close] of bars) monthEnd.set(date.slice(0, 7), close);
  const out = new Map<string, number>();
  let prev: number | null = null;
  for (const [month, close] of monthEnd) {
    if (prev != null) out.set(month, close / prev - 1);
    prev = close;
  }
  return out;
}

/** Ghép nhiều chuỗi lợi nhuận tháng, chỉ giữ các tháng chung. matrix[i][t] = lợi nhuận chuỗi i tháng t. */
export function alignMonthly(series: Map<string, number>[]): { months: string[]; matrix: number[][] } {
  const months = [...series[0].keys()].filter((m) => series.every((s) => s.has(m))).sort();
  return { months, matrix: series.map((s) => months.map((m) => s.get(m)!)) };
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Ma trận hiệp phương sai mẫu (chia n − 1). */
export function covariance(matrix: number[][]): number[][] {
  const n = matrix[0]?.length ?? 0;
  const means = matrix.map(mean);
  return matrix.map((a, i) =>
    matrix.map((b, j) => {
      let s = 0;
      for (let t = 0; t < n; t++) s += (a[t] - means[i]) * (b[t] - means[j]);
      return n > 1 ? s / (n - 1) : 0;
    }),
  );
}

export function portfolioStats(w: number[], mu: number[], cov: number[][]): { ret: number; vol: number } {
  let ret = 0;
  let variance = 0;
  for (let i = 0; i < w.length; i++) {
    ret += w[i] * mu[i];
    for (let j = 0; j < w.length; j++) variance += w[i] * w[j] * cov[i][j];
  }
  return { ret, vol: Math.sqrt(Math.max(0, variance)) };
}

export interface OptimizeResult {
  weights: number[];
  ret: number;
  vol: number;
}

/**
 * Duyệt mọi tổ hợp tỷ trọng theo lưới `step` thỏa giới hạn, gọi `visit` cho từng tổ hợp.
 * Với 5 nhóm tài sản và bước 1% là vài triệu tổ hợp — đủ nhanh để chạy trong pipeline.
 */
function enumerate(bounds: Bounds, step: number, visit: (w: number[]) => void) {
  const units = Math.round(1 / step);
  const lo = bounds.map(([l]) => Math.ceil(l / step - 1e-9));
  const hi = bounds.map(([, h]) => Math.floor(h / step + 1e-9));
  const n = bounds.length;
  // Tổng min/max còn lại từ vị trí i trở đi, để cắt nhánh sớm
  const restLo = new Array(n + 1).fill(0);
  const restHi = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    restLo[i] = restLo[i + 1] + lo[i];
    restHi[i] = restHi[i + 1] + hi[i];
  }
  const k = new Array(n).fill(0);
  const w = new Array(n).fill(0);
  const rec = (i: number, left: number) => {
    if (i === n - 1) {
      if (left < lo[i] || left > hi[i]) return;
      k[i] = left;
      for (let j = 0; j < n; j++) w[j] = k[j] / units;
      visit(w);
      return;
    }
    const from = Math.max(lo[i], left - restHi[i + 1]);
    const to = Math.min(hi[i], left - restLo[i + 1]);
    for (let v = from; v <= to; v++) {
      k[i] = v;
      rec(i + 1, left - v);
    }
  };
  rec(0, units);
}

/** Tối đa lợi nhuận kỳ vọng với điều kiện biến động ≤ targetVol (Markowitz, chỉ mua, có giới hạn). */
export function optimize({
  mu,
  cov,
  bounds,
  targetVol,
  step = 0.01,
}: {
  mu: number[];
  cov: number[][];
  bounds: Bounds;
  targetVol: number;
  step?: number;
}): OptimizeResult | null {
  let best: OptimizeResult | null = null;
  enumerate(bounds, step, (w) => {
    const s = portfolioStats(w, mu, cov);
    if (s.vol > targetVol + 1e-12) return;
    if (!best || s.ret > best.ret + 1e-12 || (Math.abs(s.ret - best.ret) <= 1e-12 && s.vol < best.vol)) {
      best = { weights: [...w], ...s };
    }
  });
  return best;
}

/** Đường biên hiệu quả: với mỗi mức biến động, lợi nhuận cao nhất đạt được. */
export function frontierCurve({
  mu,
  cov,
  bounds,
  step = 0.02,
  points = 24,
}: {
  mu: number[];
  cov: number[][];
  bounds: Bounds;
  step?: number;
  points?: number;
}): { vol: number; ret: number }[] {
  const combos: { vol: number; ret: number }[] = [];
  enumerate(bounds, step, (w) => combos.push(portfolioStats(w, mu, cov)));
  if (!combos.length) return [];
  const maxVol = Math.max(...combos.map((c) => c.vol));
  const minVol = Math.min(...combos.map((c) => c.vol));
  const out: { vol: number; ret: number }[] = [];
  for (let p = 0; p < points; p++) {
    const target = minVol + ((maxVol - minVol) * p) / (points - 1);
    let best = -Infinity;
    let bestVol = target;
    for (const c of combos) {
      if (c.vol <= target + 1e-12 && c.ret > best) {
        best = c.ret;
        bestVol = c.vol;
      }
    }
    if (best > -Infinity && (!out.length || best > out[out.length - 1].ret + 1e-9)) out.push({ vol: bestVol, ret: best });
  }
  return out;
}
