import type { AssetClass } from "./types";

export type ProfileId = "conservative" | "balanced" | "growth";

export interface Profile {
  id: ProfileId;
  name: string;
  description: string;
  weights: Record<AssetClass, number>;
}

export const PROFILES: Record<ProfileId, Profile> = {
  conservative: {
    id: "conservative",
    name: "Thận trọng",
    description: "Ưu tiên giữ vốn, chấp nhận lợi nhuận thấp hơn để ngủ ngon.",
    weights: { savings: 0.45, gold: 0.2, vn: 0.25, us: 0.1, crypto: 0 },
  },
  balanced: {
    id: "balanced",
    name: "Cân bằng",
    description: "Cân bằng giữa tăng trưởng và an toàn, phù hợp đa số người tích sản.",
    weights: { savings: 0.2, gold: 0.15, vn: 0.35, us: 0.25, crypto: 0.05 },
  },
  growth: {
    id: "growth",
    name: "Tăng trưởng",
    description: "Tầm nhìn dài hạn trên 10 năm, chịu được sụt giảm 30–50%.",
    weights: { savings: 0.05, gold: 0.1, vn: 0.4, us: 0.35, crypto: 0.1 },
  },
};

export const QUIZ: { question: string; options: string[] }[] = [
  {
    question: "Bạn dự định giữ khoản đầu tư này trong bao lâu?",
    options: ["Dưới 3 năm", "3–10 năm", "Trên 10 năm"],
  },
  {
    question: "Nếu danh mục giảm 30% trong một năm, bạn sẽ làm gì?",
    options: ["Bán bớt để cắt lỗ", "Giữ nguyên, chờ hồi phục", "Mua thêm vì giá rẻ"],
  },
  {
    question: "Bạn đã có quỹ dự phòng ít nhất 6 tháng chi tiêu chưa?",
    options: ["Chưa có", "Có, khoảng 3–6 tháng", "Có, trên 6 tháng"],
  },
  {
    question: "Thu nhập của bạn ổn định thế nào?",
    options: ["Không ổn định", "Khá ổn định", "Rất ổn định, có nhiều nguồn"],
  },
  {
    question: "Kinh nghiệm đầu tư của bạn?",
    options: ["Mới bắt đầu", "Đã đầu tư 1–3 năm", "Trên 3 năm, đã trải qua thị trường giảm"],
  },
];

/** Mỗi câu trả lời là chỉ số 0–2; tổng điểm 0–10 quyết định hồ sơ. */
export function profileFromAnswers(answers: number[]): ProfileId {
  const total = answers.reduce((a, b) => a + b, 0);
  if (total <= 3) return "conservative";
  if (total <= 6) return "balanced";
  return "growth";
}

export interface PlanInput {
  budget: number;
  weights: Record<AssetClass, number>;
  /** Hệ số DCA theo tín hiệu của tài sản đại diện mỗi nhóm (tiết kiệm không cần) */
  multipliers: Partial<Record<AssetClass, number>>;
}

export interface PlanItem {
  cls: AssetClass;
  weight: number;
  multiplier: number;
  /** Số tiền muốn mua theo tín hiệu (chưa co về ngân sách) */
  desired: number;
  /** Số tiền nên mua tháng này */
  amount: number;
}

export interface PlanResult {
  items: PlanItem[];
  /** Phần muốn mua vượt ngân sách — có thể lấy từ quỹ dự phòng nếu muốn */
  extraSuggested: number;
}

const RISKY: AssetClass[] = ["vn", "us", "gold", "crypto"];

/**
 * Tiền tháng này = tỷ trọng × ngân sách × hệ số tín hiệu cho các kênh rủi ro.
 * Tiết kiệm đóng vai trò "tiền chờ": nhận phần còn lại của ngân sách.
 * Nếu các kênh rủi ro muốn mua vượt ngân sách thì co lại theo tỷ lệ.
 */
export function monthlyPlan({ budget, weights, multipliers }: PlanInput): PlanResult {
  const risky = RISKY.map((cls) => {
    const multiplier = multipliers[cls] ?? 1;
    return { cls, weight: weights[cls], multiplier, desired: budget * weights[cls] * multiplier, amount: 0 };
  });
  const wanted = risky.reduce((a, x) => a + x.desired, 0);
  const scale = wanted > budget ? budget / wanted : 1;
  for (const x of risky) x.amount = x.desired * scale;
  const used = risky.reduce((a, x) => a + x.amount, 0);
  const savings: PlanItem = {
    cls: "savings",
    weight: weights.savings,
    multiplier: 1,
    desired: budget * weights.savings,
    amount: Math.max(0, budget - used),
  };
  return { items: [...risky, savings], extraSuggested: Math.max(0, wanted - budget) };
}
