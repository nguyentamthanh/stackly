import type { Bar } from "./types";

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/**
 * Quy đổi tuyến tính `x` từ đoạn [atZero, atHundred] sang thang điểm 0–100.
 * atZero có thể lớn hơn atHundred (ví dụ RSI 70 → 0 điểm, RSI 30 → 100 điểm).
 */
export function linearScore(x: number, atZero: number, atHundred: number): number {
  return clamp(((x - atZero) / (atHundred - atZero)) * 100, 0, 100);
}

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** RSI theo phương pháp làm mượt của Wilder. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const calc = () => (avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  out[period] = calc();
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = calc();
  }
  return out;
}

/** Mức giảm so với đỉnh cao nhất tính đến từng điểm (0 hoặc số âm). */
export function drawdownFromPeak(values: number[]): number[] {
  let peak = -Infinity;
  return values.map((v) => {
    peak = Math.max(peak, v);
    return v / peak - 1;
  });
}

/** Percentile (0–100) của `x` trong tập `xs`: tỷ lệ giá trị nhỏ hơn x, tính nửa phần bằng nhau. */
export function percentileRank(xs: number[], x: number): number {
  if (xs.length === 0) return 50;
  if (xs.length === 1) return 50;
  let below = 0;
  let equal = 0;
  for (const v of xs) {
    if (v < x) below++;
    else if (v === x) equal++;
  }
  return ((below + Math.max(equal - 1, 0) / 2) / (xs.length - 1)) * 100;
}

function isoWeekKey(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // thứ 2 = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // thứ 5 của tuần quyết định năm ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

/** Gộp chuỗi ngày thành chuỗi tuần, lấy phiên cuối cùng của mỗi tuần. */
export function toWeekly(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  let lastKey = "";
  for (const bar of bars) {
    const key = isoWeekKey(bar[0]);
    if (key === lastKey) out[out.length - 1] = bar;
    else out.push(bar);
    lastKey = key;
  }
  return out;
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * % thay đổi của phiên cuối so với phiên gần nhất trước hoặc bằng (ngày cuối − days).
 * Với days = 1 dùng phiên liền trước. Trả null nếu không đủ lịch sử.
 */
export function changeOver(bars: Bar[], days: number): number | null {
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1];
  if (days <= 1) return last[1] / bars[bars.length - 2][1] - 1;
  const target = addDays(last[0], -days);
  if (bars[0][0] > target) return null;
  let ref: Bar | null = null;
  for (let i = bars.length - 2; i >= 0; i--) {
    if (bars[i][0] <= target) {
      ref = bars[i];
      break;
    }
  }
  return ref ? last[1] / ref[1] - 1 : null;
}

/** Tăng trưởng kép hằng năm giữa phiên đầu và phiên cuối. */
export function cagr(bars: Bar[]): number | null {
  if (bars.length < 2) return null;
  const years = (Date.parse(bars[bars.length - 1][0]) - Date.parse(bars[0][0])) / (365.25 * 86400000);
  if (years < 0.5) return null;
  return Math.pow(bars[bars.length - 1][1] / bars[0][1], 1 / years) - 1;
}
