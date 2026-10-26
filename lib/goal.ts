import { fmtPct, fmtVndShort } from "./format";
import { addMonths } from "./monthly";

// Mục tiêu tài sản trong một năm. Quy ước giống phần còn lại của app: tiền góp vào đầu mỗi tháng,
// tiền sinh lãi suốt tháng đó, số dư "cuối tháng" là số dư sau khi tăng trưởng.

export const GOAL_MONTHS = 12;

/** Lãi suất tháng tương đương với lãi suất năm (lãi kép) */
export const monthlyRate = (annual: number): number => Math.pow(1 + annual, 1 / 12) - 1;

/** Số dư cuối mỗi tháng khi lợi suất năm không đổi */
export function balancePath(initial: number, monthly: number, annualRate: number, months = GOAL_MONTHS): number[] {
  const r = monthlyRate(annualRate);
  const out: number[] = [];
  let balance = initial;
  for (let i = 0; i < months; i++) {
    balance = (balance + monthly) * (1 + r);
    out.push(balance);
  }
  return out;
}

export function futureValue(initial: number, monthly: number, annualRate: number, months = GOAL_MONTHS): number {
  return balancePath(initial, monthly, annualRate, months).at(-1) ?? initial;
}

/**
 * Lợi suất năm tối thiểu để đạt mục tiêu (tìm bằng chia đôi). Có thể âm khi mục tiêu thấp hơn tổng tiền bỏ vào.
 * null khi không thể đạt dù lợi suất rất cao (ví dụ không có vốn lẫn tiền góp).
 */
export function requiredRate(initial: number, monthly: number, target: number, months = GOAL_MONTHS): number | null {
  let lo = -0.95;
  let hi = 20;
  if (futureValue(initial, monthly, hi, months) < target) return null;
  if (futureValue(initial, monthly, lo, months) >= target) return lo;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (futureValue(initial, monthly, mid, months) >= target) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Số tiền cần góp mỗi tháng để đạt mục tiêu với lợi suất năm cho trước (không âm) */
export function requiredMonthly(initial: number, target: number, annualRate: number, months = GOAL_MONTHS): number {
  const r = monthlyRate(annualRate);
  const growth = Math.pow(1 + r, months);
  const annuity = r === 0 ? months : ((1 + r) * (growth - 1)) / r;
  return Math.max(0, (target - initial * growth) / annuity);
}

/** Hàm phân phối chuẩn tích lũy (xấp xỉ Abramowitz–Stegun 7.1.26) */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return 0.5 * (1 + (x >= 0 ? erf : -erf));
}

/**
 * Xác suất ước lượng đạt mục tiêu: lợi suất 1 năm của danh mục ~ chuẩn(kỳ vọng, biến động).
 * Là xấp xỉ thô: bỏ qua việc tiền góp sau tham gia thị trường ít hơn tiền đầu năm.
 */
export function successProbability(required: number, expected: number, vol: number): number {
  if (vol <= 0) return expected >= required ? 1 : 0;
  return 1 - normCdf((required - expected) / vol);
}

export type GoalStatus = "ahead" | "on-track" | "behind" | "far-behind";

export const STATUS_LABELS: Record<GoalStatus, string> = {
  ahead: "Vượt kế hoạch",
  "on-track": "Đúng kế hoạch",
  behind: "Chậm",
  "far-behind": "Chậm nhiều",
};

/** So số dư thực tế với đường kế hoạch cùng tháng */
export function progressStatus(actual: number, planned: number): { status: GoalStatus; gap: number; ratio: number } {
  const gap = actual - planned;
  const ratio = planned > 0 ? actual / planned - 1 : 0;
  const status: GoalStatus = ratio >= 0.03 ? "ahead" : ratio >= -0.03 ? "on-track" : ratio >= -0.1 ? "behind" : "far-behind";
  return { status, gap, ratio };
}

export interface Scenario {
  id: "bad" | "base" | "good" | "savings";
  label: string;
  annualRate: number;
  path: number[];
}

export interface GoalInput {
  initial: number;
  monthly: number;
  target: number;
  /** Lợi suất kỳ vọng và biến động năm của danh mục đã chọn */
  expected: number;
  vol: number;
  savingsRate: number;
}

export interface GoalAlert {
  id: string;
  level: "high" | "medium" | "info" | "good";
  title: string;
  detail: string;
}

export interface GoalAnalysis {
  contributed: number;
  /** Lợi suất năm tối thiểu cần có, null nếu không thể đạt */
  required: number | null;
  scenarios: Scenario[];
  /** Đường kế hoạch: số dư cuối mỗi tháng nếu đạt đúng lợi suất cần có */
  plan: number[];
  probability: number | null;
  /** Số tiền góp mỗi tháng để chắc hơn: đạt mục tiêu ở kịch bản kỳ vọng / ở kịch bản xấu */
  monthlyForBase: number;
  monthlyForBad: number;
  monthlyForSavings: number;
  alerts: GoalAlert[];
}

export function analyzeGoal(g: GoalInput): GoalAnalysis {
  const { initial, monthly, target, expected, vol, savingsRate } = g;
  const contributed = initial + monthly * GOAL_MONTHS;
  const required = requiredRate(initial, monthly, target);
  const bad = expected - vol;
  const scenarios: Scenario[] = [
    { id: "bad", label: "Xấu", annualRate: bad, path: balancePath(initial, monthly, bad) },
    { id: "base", label: "Kỳ vọng", annualRate: expected, path: balancePath(initial, monthly, expected) },
    { id: "good", label: "Tốt", annualRate: expected + vol, path: balancePath(initial, monthly, expected + vol) },
    { id: "savings", label: "Chỉ gửi tiết kiệm", annualRate: savingsRate, path: balancePath(initial, monthly, savingsRate) },
  ];
  const plan = balancePath(initial, monthly, required ?? expected);
  const probability = required == null ? null : successProbability(required, expected, vol);
  const monthlyForBase = requiredMonthly(initial, target, expected);
  const monthlyForBad = requiredMonthly(initial, target, bad);
  const monthlyForSavings = requiredMonthly(initial, target, savingsRate);
  const fv = (id: Scenario["id"]) => scenarios.find((s) => s.id === id)!.path.at(-1)!;

  const alerts: GoalAlert[] = [];
  if (target <= 0 || initial + monthly <= 0) return { contributed, required, scenarios, plan, probability, monthlyForBase, monthlyForBad, monthlyForSavings, alerts };

  if (target <= contributed) {
    alerts.push({
      id: "no-growth-needed",
      level: "good",
      title: "Chỉ cần giữ đủ số tiền góp",
      detail: `Mục tiêu ${fmtVndShort(target)} thấp hơn tổng tiền bạn bỏ vào (${fmtVndShort(contributed)}), không cần lợi nhuận.`,
    });
  } else if (fv("savings") >= target) {
    alerts.push({
      id: "savings-enough",
      level: "good",
      title: "Gửi tiết kiệm là đủ",
      detail: `Với lãi ${fmtPct(savingsRate, 1)}/năm, sau 12 tháng bạn có khoảng ${fmtVndShort(fv("savings"))}, đã vượt mục tiêu. Không cần chịu thêm rủi ro.`,
    });
  } else if (required == null) {
    alerts.push({
      id: "impossible",
      level: "high",
      title: "Không thể đạt với số tiền hiện tại",
      detail: `Dù lợi nhuận rất cao cũng không đạt ${fmtVndShort(target)}. Hãy tăng vốn, tiền góp hoặc giảm mục tiêu.`,
    });
  } else if (required > expected + vol) {
    alerts.push({
      id: "unrealistic",
      level: "high",
      title: "Mục tiêu vượt cả kịch bản tốt",
      detail: `Cần ${fmtPct(required, 1)}/năm, trong khi kịch bản tốt của danh mục này chỉ ${fmtPct(expected + vol, 1)}. Để đạt ở mức kỳ vọng, cần góp khoảng ${fmtVndShort(monthlyForBase)}/tháng; sau 12 tháng bạn thường có ${fmtVndShort(fv("base"))}.`,
    });
  } else if (required > expected) {
    alerts.push({
      id: "stretch",
      level: "medium",
      title: "Mục tiêu cần may mắn hơn mức kỳ vọng",
      detail: `Cần ${fmtPct(required, 1)}/năm, cao hơn kỳ vọng ${fmtPct(expected, 1)} của danh mục. Xác suất đạt ước lượng ${fmtPct(probability ?? 0, 0)}. Góp ${fmtVndShort(monthlyForBase)}/tháng sẽ đạt ngay ở kịch bản kỳ vọng.`,
    });
  } else {
    alerts.push({
      id: "reachable",
      level: "good",
      title: "Mục tiêu nằm trong tầm với",
      detail: `Cần ${fmtPct(required, 1)}/năm, thấp hơn kỳ vọng ${fmtPct(expected, 1)}. Xác suất đạt ước lượng ${fmtPct(probability ?? 0, 0)}.`,
    });
  }

  if (required != null && required <= expected && fv("bad") < target) {
    alerts.push({
      id: "bad-case",
      level: "info",
      title: "Kịch bản xấu sẽ hụt mục tiêu",
      detail: `Nếu năm nay thị trường kém (${fmtPct(bad, 1)}), bạn có khoảng ${fmtVndShort(fv("bad"))}, hụt ${fmtVndShort(target - fv("bad"))}. Muốn chắc hơn cần góp ${fmtVndShort(monthlyForBad)}/tháng.`,
    });
  }
  if (required != null && required < 0 && target > contributed) {
    alerts.push({ id: "below-contrib", level: "info", title: "Chấp nhận lỗ nhẹ", detail: "Mục tiêu thấp hơn tổng tiền bỏ vào, bạn vẫn đạt dù đầu tư có lỗ." });
  }
  return { contributed, required, scenarios, plan, probability, monthlyForBase, monthlyForBad, monthlyForSavings, alerts };
}

export interface MonthPlanRow {
  month: string;
  /** Số dư cuối tháng theo đường kế hoạch */
  planned: number;
  /** Số dư thực tế người dùng nhập, undefined nếu chưa nhập */
  actual?: number;
  status?: GoalStatus;
  gap?: number;
}

/** Ghép đường kế hoạch với số thực tế đã nhập theo từng tháng, bắt đầu từ tháng `start` ("YYYY-MM") */
export function monthPlanRows(start: string, plan: number[], actuals: Record<string, number>): MonthPlanRow[] {
  return plan.map((planned, i) => {
    const month = addMonths(start, i);
    const actual = actuals[month];
    if (actual == null || !Number.isFinite(actual)) return { month, planned };
    return { month, planned, actual, ...progressStatus(actual, planned) };
  });
}

/** Cảnh báo tiến độ từ số thực tế: tháng đã nhập gần nhất và các tháng đã qua nhưng chưa nhập */
export function progressAlerts(rows: MonthPlanRow[], currentMonth: string, target: number): GoalAlert[] {
  const out: GoalAlert[] = [];
  const entered = rows.filter((r) => r.actual != null);
  const latest = entered.at(-1);
  if (latest?.status && latest.gap != null) {
    const pct = fmtPct(Math.abs((latest.actual ?? 0) / latest.planned - 1), 1);
    if (latest.status === "far-behind") {
      out.push({ id: "far-behind", level: "high", title: "Đang chậm nhiều so với kế hoạch", detail: `Số dư cuối ${latest.month} thấp hơn kế hoạch ${pct} (${fmtVndShort(-latest.gap)}). Cần tăng tiền góp hoặc điều chỉnh mục tiêu.` });
    } else if (latest.status === "behind") {
      out.push({ id: "behind", level: "medium", title: "Đang chậm so với kế hoạch", detail: `Số dư cuối ${latest.month} thấp hơn kế hoạch ${pct} (${fmtVndShort(-latest.gap)}).` });
    } else if (latest.status === "ahead") {
      out.push({ id: "ahead", level: "good", title: "Đang vượt kế hoạch", detail: `Số dư cuối ${latest.month} cao hơn kế hoạch ${pct}. Có thể giảm tiền góp hoặc nâng mục tiêu.` });
    } else {
      out.push({ id: "on-track", level: "good", title: "Đang đúng kế hoạch", detail: `Số dư cuối ${latest.month} sát đường kế hoạch (lệch ${pct}).` });
    }
    if (latest.month === rows.at(-1)?.month && (latest.actual ?? 0) < target) {
      out.push({ id: "missed", level: "high", title: "Chưa đạt mục tiêu cuối kỳ", detail: `Số dư cuối kỳ ${fmtVndShort(latest.actual ?? 0)}, còn thiếu ${fmtVndShort(target - (latest.actual ?? 0))}.` });
    }
  }
  const missing = rows.filter((r) => r.actual == null && r.month < currentMonth);
  if (missing.length) {
    out.push({ id: "missing-actuals", level: "info", title: `Chưa nhập thực tế ${missing.length} tháng đã qua`, detail: `Nhập số dư cuối tháng (${missing.map((m) => m.month).join(", ")}) để app theo dõi tiến độ.` });
  }
  return out;
}
