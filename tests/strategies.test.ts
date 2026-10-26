import { describe, expect, it } from "vitest";
import {
  backtestAsset,
  backtestFixed,
  dipState,
  lumpVsDca,
  monthStarts,
  prepareSeries,
  rebalancePlan,
  trendState,
} from "@/lib/strategies";
import type { AssetClass, Bar } from "@/lib/types";

function makeBars(values: number[], start = "2015-01-01"): Bar[] {
  const d = new Date(start + "T00:00:00Z");
  return values.map((v) => {
    const bar: Bar = [d.toISOString().slice(0, 10), v];
    d.setUTCDate(d.getUTCDate() + 1);
    return bar;
  });
}

const uptrend = makeBars(Array.from({ length: 1500 }, (_, i) => 100 * Math.pow(1.0006, i) * (1 + 0.02 * Math.sin(i / 20))));
// Tăng 1000 phiên rồi sập 50% trong 300 phiên
const crash = makeBars([
  ...Array.from({ length: 1000 }, (_, i) => 100 * Math.pow(1.0008, i) * (1 + 0.01 * Math.sin(i / 7))),
  ...Array.from({ length: 300 }, (_, i) => 222 * (1 - 0.5 * (i / 299))),
]);
const weeklyScores = (bars: Bar[], score: number): Bar[] => bars.filter((_, i) => i % 7 === 0).map(([d]) => [d, score]);

describe("monthStarts", () => {
  it("lấy phiên đầu tiên của mỗi tháng", () => {
    const idx = monthStarts(["2020-01-02", "2020-01-03", "2020-02-03", "2020-02-04", "2020-03-02"]);
    expect(idx).toEqual([0, 2, 4]);
  });
});

describe("trendState", () => {
  it("xu hướng tăng → nắm giữ 100%", () => {
    expect(trendState(prepareSeries(uptrend))?.exposure).toBe(1);
  });
  it("sau khi sập 50% → đứng ngoài", () => {
    const st = trendState(prepareSeries(crash))!;
    expect(st.exposure).toBe(0);
    expect(st.stance).toBe("sell");
  });
});

describe("dipState", () => {
  it("giảm sâu hiếm gặp → giải ngân", () => {
    expect(dipState(prepareSeries(crash)).stance).toBe("buy");
  });
  it("đang ở gần đỉnh → không giải ngân", () => {
    expect(dipState(prepareSeries(uptrend)).stance).not.toBe("buy");
  });
});

describe("backtestAsset", () => {
  it("mọi kiểu nhận cùng số vốn; mua đều luôn nắm giữ 100%", () => {
    const bt = backtestAsset({ bars: crash, scores: weeklyScores(crash, 50), monthly: 1_000_000, cashRate: 0.05 })!;
    expect(bt).not.toBeNull();
    for (const r of Object.values(bt.results)) expect(r.stats.invested).toBe(bt.plain.stats.invested);
    expect(bt.plain.stats.exposure).toBeCloseTo(1, 5);
    expect(bt.plain.stats.maxDrawdown).toBeLessThan(-0.4);
  });

  it("điểm trung tính (×1) cho kết quả giống mua đều", () => {
    const bt = backtestAsset({ bars: uptrend, scores: weeklyScores(uptrend, 50), monthly: 1, cashRate: 0.05 })!;
    expect(bt.results["tich-san"].stats.finalValue).toBeCloseTo(bt.plain.stats.finalValue, 6);
  });

  it("theo xu hướng giảm được mức sụt giảm khi thị trường sập kéo dài", () => {
    const bt = backtestAsset({ bars: crash, scores: weeklyScores(crash, 50), monthly: 1, cashRate: 0.05 })!;
    expect(bt.results["xu-huong"].stats.maxDrawdown).toBeGreaterThan(bt.plain.stats.maxDrawdown);
  });

  it("thiếu dữ liệu → null", () => {
    expect(backtestAsset({ bars: uptrend.slice(0, 100), scores: [], monthly: 1, cashRate: 0 })).toBeNull();
  });
});

const W = (vn: number, us: number, gold: number, savings: number, crypto = 0): Record<AssetClass, number> => ({ vn, us, gold, savings, crypto });

describe("rebalancePlan", () => {
  it("chỉ rót tiền mới vào kênh thiếu tỷ trọng khi không bán", () => {
    const plan = rebalancePlan(W(60, 20, 20, 0), W(0.25, 0.25, 0.25, 0.25), 20, false);
    expect(plan.vn).toBe(0);
    expect(plan.savings).toBeGreaterThan(plan.us);
    const total = Object.values(plan).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(20, 9);
  });

  it("phần dư sau khi lấp đủ thiếu hụt chia theo tỷ trọng", () => {
    const plan = rebalancePlan(W(25, 25, 25, 25), W(0.25, 0.25, 0.25, 0.25), 40, false);
    for (const c of ["vn", "us", "gold", "savings"] as const) expect(plan[c]).toBeCloseTo(10, 9);
  });

  it("cho phép bán → đưa đúng về tỷ trọng mục tiêu", () => {
    const cur = W(60, 20, 20, 0);
    const plan = rebalancePlan(cur, W(0.25, 0.25, 0.25, 0.25), 0, true);
    expect(plan.vn).toBeCloseTo(-35, 9);
    expect(plan.savings).toBeCloseTo(25, 9);
  });
});

describe("backtestFixed", () => {
  const series = { vn: crash, us: uptrend.slice(0, 1300), gold: makeBars(Array.from({ length: 1300 }, (_, i) => 100 + i * 0.05)) };
  it("tái cân bằng giữ tỷ trọng cuối kỳ gần mục tiêu hơn", () => {
    const weights = W(0.25, 0.25, 0.25, 0.25);
    const none = backtestFixed({ series, weights, monthly: 1, cashRate: 0.05, mode: "none" })!;
    const yearly = backtestFixed({ series, weights, monthly: 1, cashRate: 0.05, mode: "yearly" })!;
    const err = (w: Record<AssetClass, number>) => (["vn", "us", "gold", "savings"] as const).reduce((a, c) => a + Math.abs(w[c] - 0.25), 0);
    expect(err(yearly.finalWeights)).toBeLessThan(err(none.finalWeights));
    expect(yearly.stats.invested).toBe(none.stats.invested);
  });
});

describe("lumpVsDca", () => {
  it("thị trường tăng đều → bỏ một lần thắng gần như mọi lúc", () => {
    const monthly: Bar[] = Array.from({ length: 60 }, (_, i) => [`20${String(10 + Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, "0")}-01`, 100 * Math.pow(1.01, i)]);
    const r = lumpVsDca({ monthly, spread: 6, horizon: 12, cashRate: 0.03 })!;
    expect(r.lumpWinRate).toBe(1);
    expect(r.medianEdge).toBeGreaterThan(0);
  });

  it("thị trường giảm đều → chia nhỏ thắng", () => {
    const monthly: Bar[] = Array.from({ length: 40 }, (_, i) => [`20${String(10 + Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, "0")}-01`, 100 * Math.pow(0.98, i)]);
    const r = lumpVsDca({ monthly, spread: 6, horizon: 12, cashRate: 0.03 })!;
    expect(r.lumpWinRate).toBe(0);
  });

  it("chia 1 tháng = bỏ một lần", () => {
    const monthly: Bar[] = Array.from({ length: 30 }, (_, i) => [`2015-${i}`, 100 + 10 * Math.sin(i)]);
    const r = lumpVsDca({ monthly, spread: 1, horizon: 6, cashRate: 0.03 })!;
    for (const c of r.cases) expect(c.dca).toBeCloseTo(c.lump, 9);
  });
});
