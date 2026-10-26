import type { Bar } from "./types";

// Phân tích theo tháng: lợi nhuận từng tháng, tổng 12 tháng, sụt giảm và biến động.
// Dùng chung cho các kênh tài sản (trang mục tiêu) và lịch sử NAV của quỹ (cảnh báo quỹ).

/** Khóa tháng "YYYY-MM" của một ngày "YYYY-MM-DD" */
export const monthOf = (date: string): string => date.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** "2026-10" → "T10/2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `T${Number(m)}/${y}`;
}

/** Tháng hiện tại theo giờ Việt Nam */
export function currentMonth(now = Date.now()): string {
  return new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 7);
}

/** Giá của phiên cuối cùng trong mỗi tháng (chuỗi cần được sắp theo ngày) */
export function monthEnds(bars: Bar[]): Map<string, Bar> {
  const out = new Map<string, Bar>();
  for (const b of bars) out.set(monthOf(b[0]), b);
  return out;
}

/** n khóa tháng liên tiếp, tháng cuối là tháng của phiên mới nhất */
export function lastMonthKeys(latestDate: string, n = 12): string[] {
  const last = monthOf(latestDate);
  return Array.from({ length: n }, (_, i) => addMonths(last, i - n + 1));
}

export interface MonthReturn {
  month: string;
  /** null khi thiếu giá cuối tháng hoặc cuối tháng trước */
  ret: number | null;
}

export interface MonthlyRow {
  id: string;
  label: string;
  months: MonthReturn[];
  /** Lợi nhuận từ cuối tháng trước tháng đầu đến phiên mới nhất */
  total: number | null;
  /** Lợi nhuận từ đầu năm dương lịch */
  ytd: number | null;
  /** Số tháng có lợi nhuận dương / số tháng có dữ liệu */
  positive: number;
  counted: number;
  best: MonthReturn | null;
  worst: MonthReturn | null;
  /** Độ lệch chuẩn lợi nhuận tháng nhân căn 12 */
  vol: number | null;
  /** Mức giảm lớn nhất từ đỉnh trong cửa sổ (số âm) */
  maxDrawdown: number | null;
}

function stdev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function maxDrawdownOf(values: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, v / peak - 1);
  }
  return worst;
}

export function monthlyAnalysis(id: string, label: string, bars: Bar[], keys: string[]): MonthlyRow {
  const ends = monthEnds(bars);
  const months: MonthReturn[] = keys.map((month) => {
    const cur = ends.get(month);
    const prev = ends.get(addMonths(month, -1));
    return { month, ret: cur && prev ? cur[1] / prev[1] - 1 : null };
  });
  const have = months.filter((m): m is MonthReturn & { ret: number } => m.ret != null);
  const baseBar = ends.get(addMonths(keys[0], -1));
  const lastBar = ends.get(keys[keys.length - 1]);
  const total = baseBar && lastBar ? lastBar[1] / baseBar[1] - 1 : null;
  const yearBase = lastBar ? ends.get(`${Number(keys[keys.length - 1].slice(0, 4)) - 1}-12`) : undefined;
  const window = baseBar ? bars.filter((b) => b[0] >= baseBar[0]).map((b) => b[1]) : [];
  return {
    id,
    label,
    months,
    total,
    ytd: yearBase && lastBar ? lastBar[1] / yearBase[1] - 1 : null,
    positive: have.filter((m) => m.ret > 0).length,
    counted: have.length,
    best: have.length ? have.reduce((a, b) => (b.ret > a.ret ? b : a)) : null,
    worst: have.length ? have.reduce((a, b) => (b.ret < a.ret ? b : a)) : null,
    vol: have.length >= 6 ? stdev(have.map((m) => m.ret)) * Math.sqrt(12) : null,
    maxDrawdown: window.length > 1 ? maxDrawdownOf(window) : null,
  };
}

/** Tiết kiệm: lãi tích lũy đều mỗi tháng theo lãi suất năm */
export function savingsAnalysis(id: string, label: string, annualRate: number, keys: string[]): MonthlyRow {
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  const months = keys.map((month) => ({ month, ret: r }));
  const yearStart = Number(keys[keys.length - 1].slice(5, 7));
  return {
    id,
    label,
    months,
    total: Math.pow(1 + r, keys.length) - 1,
    ytd: Math.pow(1 + r, yearStart) - 1,
    positive: keys.length,
    counted: keys.length,
    best: months[0],
    worst: months[0],
    vol: 0,
    maxDrawdown: 0,
  };
}

/** Nhận xét tự động cho phân tích cả năm: kênh nào vượt tiết kiệm, tháng nào thị trường cùng xấu, kênh nào rủi ro nhất */
export function yearInsights(rows: MonthlyRow[], savingsId = "tiet-kiem"): string[] {
  const savings = rows.find((r) => r.id === savingsId);
  const risky = rows.filter((r) => r.id !== savingsId && r.total != null);
  const out: string[] = [];
  const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1).replace(".", ",")}%`;

  if (savings?.total != null && risky.length) {
    const beat = risky.filter((r) => r.total! > savings.total!);
    out.push(
      beat.length === 0
        ? `Không kênh nào vượt tiết kiệm (${pct(savings.total)}) trong 12 tháng qua: ${risky.map((r) => `${r.label} ${pct(r.total!)}`).join(", ")}.`
        : `${beat.length}/${risky.length} kênh vượt tiết kiệm (${pct(savings.total)}): ${beat.map((r) => `${r.label} ${pct(r.total!)}`).join(", ")}.`,
    );
    const lose = risky.filter((r) => r.total! < 0);
    if (lose.length) out.push(`${lose.map((r) => r.label).join(", ")} giảm giá trong 12 tháng: người giữ cả năm đang lỗ.`);
  }

  // Tháng nhiều kênh rủi ro cùng giảm
  const months = rows[0]?.months.map((m) => m.month) ?? [];
  const bad = months
    .map((month) => ({ month, down: risky.filter((r) => (r.months.find((m) => m.month === month)?.ret ?? 0) < 0).length }))
    .filter((m) => m.down >= Math.max(3, Math.ceil(risky.length * 0.75)));
  if (bad.length) out.push(`Tháng nhiều kênh cùng giảm: ${bad.map((m) => `${monthLabel(m.month)} (${m.down}/${risky.length} kênh)`).join(", ")}. Đa dạng hóa ít hiệu quả trong những tháng này.`);

  const volatile = [...risky].filter((r) => r.maxDrawdown != null).sort((a, b) => a.maxDrawdown! - b.maxDrawdown!)[0];
  if (volatile?.maxDrawdown != null && volatile.maxDrawdown < -0.1) {
    out.push(`${volatile.label} có lúc giảm ${pct(volatile.maxDrawdown)} từ đỉnh trong năm: khoản tiền cần dùng trong 1 năm không nên để hết ở kênh này.`);
  }
  return out;
}
