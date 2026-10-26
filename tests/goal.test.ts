import { describe, expect, it } from "vitest";
import {
  analyzeGoal,
  balancePath,
  futureValue,
  monthlyRate,
  monthPlanRows,
  normCdf,
  progressAlerts,
  progressStatus,
  requiredMonthly,
  requiredRate,
  successProbability,
} from "@/lib/goal";
import { addMonths, lastMonthKeys, maxDrawdownOf, monthLabel, monthlyAnalysis, savingsAnalysis, yearInsights } from "@/lib/monthly";
import type { Bar } from "@/lib/types";

describe("futureValue / balancePath", () => {
  it("lãi 0%: số dư = vốn + tiền góp", () => {
    expect(futureValue(10_000_000, 1_000_000, 0)).toBeCloseTo(22_000_000, 4);
  });
  it("lợi suất năm 12% cho vốn một lần ra đúng 12% sau 12 tháng", () => {
    expect(futureValue(100, 0, 0.12)).toBeCloseTo(112, 8);
  });
  it("đường số dư tăng đều và có 12 mốc", () => {
    const p = balancePath(0, 1_000_000, 0.1);
    expect(p).toHaveLength(12);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThan(p[i - 1]);
    expect(monthlyRate(0.1)).toBeCloseTo(0.007974, 5);
  });
});

describe("requiredRate", () => {
  it("tìm đúng lợi suất đã dùng để tạo ra mục tiêu", () => {
    const target = futureValue(50_000_000, 5_000_000, 0.13);
    expect(requiredRate(50_000_000, 5_000_000, target)).toBeCloseTo(0.13, 6);
  });
  it("mục tiêu thấp hơn tiền bỏ vào cho lợi suất âm", () => {
    expect(requiredRate(10_000_000, 1_000_000, 20_000_000)!).toBeLessThan(0);
  });
  it("không có vốn lẫn tiền góp thì không đạt được", () => {
    expect(requiredRate(0, 0, 1_000_000)).toBeNull();
  });
});

describe("requiredMonthly", () => {
  it("góp theo kết quả thì đạt đúng mục tiêu", () => {
    const m = requiredMonthly(20_000_000, 150_000_000, 0.09);
    expect(futureValue(20_000_000, m, 0.09)).toBeCloseTo(150_000_000, 3);
  });
  it("vốn đã đủ thì không cần góp", () => {
    expect(requiredMonthly(200_000_000, 100_000_000, 0.05)).toBe(0);
  });
  it("lãi 0%: chia đều phần còn thiếu cho 12 tháng", () => {
    expect(requiredMonthly(0, 12_000_000, 0)).toBeCloseTo(1_000_000, 6);
  });
});

describe("xác suất", () => {
  it("normCdf đúng các mốc quen thuộc", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normCdf(-1)).toBeCloseTo(0.1587, 3);
  });
  it("cần đúng bằng kỳ vọng thì 50%; cần thấp hơn thì cao hơn 50%", () => {
    expect(successProbability(0.1, 0.1, 0.1)).toBeCloseTo(0.5, 6);
    expect(successProbability(0.0, 0.1, 0.1)).toBeGreaterThan(0.8);
    expect(successProbability(0.3, 0.1, 0.1)).toBeLessThan(0.03);
  });
  it("không biến động: chắc chắn hoặc không bao giờ", () => {
    expect(successProbability(0.04, 0.05, 0)).toBe(1);
    expect(successProbability(0.06, 0.05, 0)).toBe(0);
  });
});

describe("progressStatus", () => {
  it.each([
    [105, "ahead"],
    [101, "on-track"],
    [95, "behind"],
    [80, "far-behind"],
  ])("thực tế %i so với kế hoạch 100", (actual, status) => {
    expect(progressStatus(actual, 100).status).toBe(status);
  });
});

describe("analyzeGoal", () => {
  const base = { initial: 50_000_000, monthly: 5_000_000, expected: 0.12, vol: 0.1, savingsRate: 0.05 };

  it("mục tiêu nhỏ: gửi tiết kiệm là đủ", () => {
    const a = analyzeGoal({ ...base, target: 112_000_000 });
    expect(a.alerts[0].id).toBe("savings-enough");
    expect(a.alerts[0].level).toBe("good");
  });

  it("mục tiêu vừa tầm: xác suất hợp lý và có cảnh báo kịch bản xấu", () => {
    const need = futureValue(base.initial, base.monthly, 0.09);
    const a = analyzeGoal({ ...base, target: need });
    expect(a.required).toBeCloseTo(0.09, 5);
    expect(a.probability!).toBeGreaterThan(0.5);
    expect(a.alerts.map((x) => x.id)).toContain("reachable");
    expect(a.alerts.map((x) => x.id)).toContain("bad-case");
  });

  it("mục tiêu cần hơn kỳ vọng: lưu ý, kèm số tiền góp gợi ý", () => {
    const a = analyzeGoal({ ...base, target: futureValue(base.initial, base.monthly, 0.18) });
    expect(a.alerts[0]).toMatchObject({ id: "stretch", level: "medium" });
    expect(a.monthlyForBase).toBeGreaterThan(base.monthly);
  });

  it("mục tiêu vượt cả kịch bản tốt: nghiêm trọng", () => {
    const a = analyzeGoal({ ...base, target: futureValue(base.initial, base.monthly, 0.5) });
    expect(a.alerts[0]).toMatchObject({ id: "unrealistic", level: "high" });
    expect(a.probability!).toBeLessThan(0.05);
  });

  it("đường kế hoạch kết thúc đúng tại mục tiêu", () => {
    const target = 150_000_000;
    const a = analyzeGoal({ ...base, target });
    expect(a.plan.at(-1)!).toBeCloseTo(target, 2);
  });

  it("kịch bản xấu < kỳ vọng < tốt", () => {
    const [bad, mid, good] = analyzeGoal({ ...base, target: 120_000_000 }).scenarios.map((s) => s.path.at(-1)!);
    expect(bad).toBeLessThan(mid);
    expect(mid).toBeLessThan(good);
  });
});

describe("kế hoạch theo tháng và tiến độ", () => {
  const plan = balancePath(0, 1_000_000, 0.1);
  it("ghép số thực tế đúng tháng", () => {
    const rows = monthPlanRows("2026-10", plan, { "2026-11": plan[1] * 1.2, "2027-01": plan[3] * 0.7 });
    expect(rows[0].month).toBe("2026-10");
    expect(rows[3].month).toBe("2027-01");
    expect(rows[0].actual).toBeUndefined();
    expect(rows[1].status).toBe("ahead");
    expect(rows[3].status).toBe("far-behind");
  });

  it("cảnh báo chậm nhiều và tháng đã qua chưa nhập", () => {
    const rows = monthPlanRows("2026-10", plan, { "2026-10": plan[0] * 0.8 });
    const a = progressAlerts(rows, "2026-12", 12_000_000);
    expect(a.map((x) => x.id)).toEqual(["far-behind", "missing-actuals"]);
    expect(a[0].level).toBe("high");
    expect(a[1].detail).toContain("2026-11");
  });

  it("không báo thiếu khi chưa đến tháng đó", () => {
    const rows = monthPlanRows("2026-10", plan, {});
    expect(progressAlerts(rows, "2026-10", 1)).toEqual([]);
  });
});

describe("phân tích theo tháng", () => {
  // Giá cuối mỗi tháng của 14 tháng liên tiếp, tăng 1% mỗi tháng trừ một tháng giảm 10%
  const bars: Bar[] = [];
  let price = 100;
  for (let i = 0; i < 14; i++) {
    const month = addMonths("2025-09", i);
    price *= i === 6 ? 0.9 : 1.01;
    bars.push([`${month}-15`, price * 0.99]);
    bars.push([`${month}-28`, price]);
  }

  it("lastMonthKeys và addMonths đi qua ranh giới năm", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(lastMonthKeys("2026-10-26", 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("tính lợi nhuận từng tháng, tổng, số tháng dương và tháng tệ nhất", () => {
    const keys = lastMonthKeys(bars.at(-1)![0], 12);
    const row = monthlyAnalysis("x", "X", bars, keys);
    expect(row.months).toHaveLength(12);
    expect(row.months.every((m) => m.ret != null)).toBe(true);
    expect(row.worst!.ret).toBeCloseTo(-0.1, 6);
    expect(row.positive).toBe(11);
    expect(row.total!).toBeCloseTo(bars.at(-1)![1] / bars.find((b) => b[0] === `${addMonths(keys[0], -1)}-28`)![1] - 1, 10);
    expect(row.maxDrawdown!).toBeLessThan(-0.09);
    expect(row.vol!).toBeGreaterThan(0);
  });

  it("thiếu giá tháng nào thì tháng đó là null", () => {
    const missing = bars.filter((b) => !b[0].startsWith("2026-02"));
    const row = monthlyAnalysis("x", "X", missing, lastMonthKeys(missing.at(-1)![0], 12));
    expect(row.months.find((m) => m.month === "2026-02")!.ret).toBeNull();
    expect(row.months.find((m) => m.month === "2026-03")!.ret).toBeNull();
  });

  it("tiết kiệm: lãi đều, không sụt giảm", () => {
    const keys = lastMonthKeys("2026-10-26", 12);
    const row = savingsAnalysis("tk", "Tiết kiệm", 0.05, keys);
    expect(row.total!).toBeCloseTo(0.05, 8);
    expect(row.maxDrawdown).toBe(0);
    expect(row.ytd!).toBeCloseTo(Math.pow(1.05, 10 / 12) - 1, 8);
  });

  it("maxDrawdownOf", () => {
    expect(maxDrawdownOf([100, 120, 90, 130, 100])).toBeCloseTo(-0.25, 10);
    expect(maxDrawdownOf([1, 2, 3])).toBe(0);
  });
});

describe("analyzeGoal: mục tiêu thấp hơn tổng tiền góp", () => {
  it("không cần lợi nhuận", () => {
    const a = analyzeGoal({ initial: 50_000_000, monthly: 5_000_000, target: 100_000_000, expected: 0.12, vol: 0.1, savingsRate: 0.05 });
    expect(a.alerts[0]).toMatchObject({ id: "no-growth-needed", level: "good" });
  });
});

describe("yearInsights", () => {
  const keys = lastMonthKeys("2026-10-26", 12);
  const mk = (id: string, label: string, rets: number[]) => ({
    ...savingsAnalysis(id, label, 0, keys),
    months: keys.map((month, i) => ({ month, ret: rets[i] })),
    total: rets.reduce((a, r) => a * (1 + r), 1) - 1,
    maxDrawdown: -0.2,
  });
  it("nêu kênh vượt tiết kiệm, kênh lỗ và tháng cùng giảm", () => {
    const flat = new Array(12).fill(0.01);
    const down = [...flat];
    down[3] = -0.05;
    const a = mk("a", "Kênh A", down);
    const b = mk("b", "Kênh B", down);
    const c = mk("c", "Kênh C", down);
    const d = { ...mk("d", "Kênh D", new Array(12).fill(-0.02)) };
    const sav = savingsAnalysis("tiet-kiem", "Tiết kiệm", 0.05, keys);
    const text = yearInsights([a, b, c, d, sav]).join("\n");
    expect(text).toContain("3/4 kênh vượt tiết kiệm");
    expect(text).toContain("Kênh D giảm giá");
    expect(text).toContain(`${monthLabel(keys[3])} (4/4 kênh)`);
    expect(text).toContain("giảm −20,0% từ đỉnh");
  });
});
