import { toWeekly } from "./indicators";
import { addMonths, maxDrawdownOf, monthEnds, monthOf, type MonthReturn } from "./monthly";
import type { Bar } from "./types";

// Tóm tắt lịch sử NAV của một quỹ để sinh cảnh báo. Tính trong pipeline (scripts/fetch-data.ts)
// rồi lưu vào public/data/fund-history.json, nên trang web không phải tải hàng nghìn điểm NAV.

export interface NavPoint {
  date: string;
  nav: number;
}

export interface FundHistory {
  /** Ngày của NAV mới nhất */
  asOf: string;
  /** Lợi nhuận từng tháng gần nhất; tháng cuối tính từ cuối tháng trước đến asOf */
  months: MonthReturn[];
  /** Biến động năm hóa theo lợi nhuận tuần, null nếu chưa đủ dữ liệu */
  vol: number | null;
  /** Mức giảm lớn nhất từ đỉnh trong 12 tháng (số âm) */
  maxDrawdown: number;
  /** Mức giảm hiện tại so với đỉnh 12 tháng (số âm hoặc 0) */
  drawdown: number;
}

export interface FundHistoryFile {
  updatedAt: string;
  funds: Record<string, FundHistory>;
}

const MIN_POINTS = 8;
const MIN_WEEKS_FOR_VOL = 20;

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function summarizeNav(points: NavPoint[], monthsBack = 12): FundHistory | null {
  const sorted = [...points].filter((p) => p.nav > 0).sort((a, b) => a.date.localeCompare(b.date));
  const bars: Bar[] = [];
  for (const p of sorted) {
    if (bars.length && bars[bars.length - 1][0] === p.date) bars[bars.length - 1] = [p.date, p.nav];
    else bars.push([p.date, p.nav]);
  }
  if (bars.length < MIN_POINTS) return null;

  const asOf = bars[bars.length - 1][0];
  const ends = monthEnds(bars);
  const months: MonthReturn[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const month = addMonths(monthOf(asOf), -i);
    const cur = ends.get(month);
    const prev = ends.get(addMonths(month, -1));
    months.push({ month, ret: cur && prev ? cur[1] / prev[1] - 1 : null });
  }

  const window = bars.filter((b) => b[0] >= addDays(asOf, -365));
  const values = window.map((b) => b[1]);
  const weekly = toWeekly(window);
  let vol: number | null = null;
  if (weekly.length > MIN_WEEKS_FOR_VOL) {
    const rets = weekly.slice(1).map((b, i) => b[1] / weekly[i][1] - 1);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)) * Math.sqrt(52);
  }
  const peak = Math.max(...values);
  return {
    asOf,
    months,
    vol,
    maxDrawdown: maxDrawdownOf(values),
    drawdown: values[values.length - 1] / peak - 1,
  };
}
