import { describe, expect, it } from "vitest";
import { backtestDca } from "@/lib/backtest";
import { monthlyPlan, PROFILES, profileFromAnswers } from "@/lib/plan";
import { holdingsFromTransactions, xirr, savingsValue } from "@/lib/portfolio";
import type { Bar } from "@/lib/types";

describe("backtestDca", () => {
  // Giá đầu mỗi tháng: 100, 50, 100 ; điểm: trung tính, rất rẻ, trung tính
  const bars: Bar[] = [
    ["2024-01-02", 100],
    ["2024-01-15", 90],
    ["2024-02-01", 50],
    ["2024-03-01", 100],
  ];
  const scores: Bar[] = [
    ["2023-12-29", 50],
    ["2024-01-26", 90],
    ["2024-02-23", 50],
  ];

  it("DCA đều: mua cố định mỗi tháng vào phiên đầu tháng", () => {
    const r = backtestDca({ bars, scores, monthly: 100, cashRate: 0 });
    expect(r.plain.invested).toBe(300);
    // 1 + 2 + 1 = 4 đơn vị × giá cuối 100
    expect(r.plain.finalValue).toBeCloseTo(400);
  });

  it("DCA theo điểm: mua nhiều hơn khi rẻ, tiền dư giữ lại ở quỹ chờ", () => {
    const r = backtestDca({ bars, scores, monthly: 100, cashRate: 0 });
    // T1: ×1 mua 100 (1 đv) ; T2: ×2 nhưng quỹ chỉ có 100 → mua 100 (2 đv) ; T3: ×1 mua 100 (1 đv)
    expect(r.smart.invested).toBe(300);
    expect(r.smart.finalValue).toBeCloseTo(400);
    expect(r.series).toHaveLength(3);
  });

  it("tiền chờ được tính lãi tiết kiệm", () => {
    const flat: Bar[] = [
      ["2024-01-02", 100],
      ["2024-02-01", 100],
      ["2024-03-01", 100],
    ];
    const expensive: Bar[] = [["2023-12-29", 10]];
    const r = backtestDca({ bars: flat, scores: expensive, monthly: 100, cashRate: 0.12 });
    // mỗi tháng mua 50, dư 50 → quỹ chờ có lãi nên tổng > 300
    expect(r.smart.finalValue).toBeGreaterThan(300);
    expect(r.smart.cash).toBeGreaterThan(150);
  });
});

describe("plan", () => {
  it("các hồ sơ rủi ro có tổng tỷ trọng = 100%", () => {
    for (const p of Object.values(PROFILES)) {
      expect(Object.values(p.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    }
  });

  it("chấm quiz ra đúng hồ sơ", () => {
    expect(profileFromAnswers([0, 0, 0, 0, 0])).toBe("conservative");
    expect(profileFromAnswers([1, 1, 1, 1, 1])).toBe("balanced");
    expect(profileFromAnswers([2, 2, 2, 2, 2])).toBe("growth");
  });

  it("tổng tiền tháng này đúng bằng ngân sách, phần dư dồn vào tiết kiệm", () => {
    const res = monthlyPlan({
      budget: 10_000_000,
      weights: { vn: 0.4, us: 0, gold: 0.2, crypto: 0, savings: 0.4 },
      multipliers: { vn: 0.5, gold: 1 },
    });
    const total = res.items.reduce((a, x) => a + x.amount, 0);
    expect(total).toBeCloseTo(10_000_000);
    expect(res.items.find((x) => x.cls === "vn")!.amount).toBeCloseTo(2_000_000);
    expect(res.items.find((x) => x.cls === "savings")!.amount).toBeCloseTo(6_000_000);
    expect(res.extraSuggested).toBe(0);
  });

  it("khi các kênh đều rẻ vượt ngân sách thì co lại và gợi ý số tiền mua thêm", () => {
    const res = monthlyPlan({
      budget: 10_000_000,
      weights: { vn: 0.5, us: 0.3, gold: 0, crypto: 0, savings: 0.2 },
      multipliers: { vn: 2, us: 2 },
    });
    const total = res.items.reduce((a, x) => a + x.amount, 0);
    expect(total).toBeCloseTo(10_000_000);
    expect(res.items.find((x) => x.cls === "savings")!.amount).toBe(0);
    // muốn mua 16tr nhưng chỉ có 10tr → gợi ý thêm 6tr từ quỹ dự phòng
    expect(res.extraSuggested).toBeCloseTo(6_000_000);
    expect(res.items.find((x) => x.cls === "vn")!.amount).toBeCloseTo(6_250_000);
  });
});

describe("portfolio", () => {
  it("tính số lượng nắm giữ và giá vốn bình quân", () => {
    const h = holdingsFromTransactions([
      { id: "1", assetId: "fpt", type: "buy", date: "2024-01-01", quantity: 100, price: 100_000, fee: 0 },
      { id: "2", assetId: "fpt", type: "buy", date: "2024-02-01", quantity: 100, price: 120_000, fee: 0 },
      { id: "3", assetId: "fpt", type: "sell", date: "2024-03-01", quantity: 50, price: 130_000, fee: 0 },
    ]);
    const fpt = h.get("fpt")!;
    expect(fpt.quantity).toBe(150);
    expect(fpt.avgCost).toBeCloseTo(110_000);
    expect(fpt.realized).toBeCloseTo(50 * 20_000);
  });

  it("xirr khớp với lãi kép 10%/năm", () => {
    const r = xirr([
      { date: "2020-01-01", amount: -1000 },
      { date: "2021-01-01", amount: 1100 },
    ]);
    expect(r!).toBeCloseTo(0.1, 2);
  });

  it("xirr trả null khi dòng tiền không đổi dấu", () => {
    expect(xirr([{ date: "2020-01-01", amount: -1000 }])).toBeNull();
  });

  it("tiền gửi tiết kiệm cộng lãi đơn theo số ngày", () => {
    expect(savingsValue(100_000_000, 0.06, "2025-01-01", "2026-01-01")).toBeCloseTo(106_000_000, -3);
  });
});
