import { describe, expect, it } from "vitest";
import { computeAllocation, OPT_PROFILES, toVnd } from "@/lib/allocation";
import type { Bar } from "@/lib/types";

/** Chuỗi giá cuối tháng có lợi nhuận tháng theo hàm f(t) */
function series(months: number, f: (t: number) => number): Bar[] {
  const out: Bar[] = [];
  let p = 100;
  for (let t = 0; t <= months; t++) {
    const d = new Date(Date.UTC(2018, t, 28));
    out.push([d.toISOString().slice(0, 10), p]);
    p *= 1 + f(t);
  }
  return out;
}

const input = {
  series: {
    vn: series(60, (t) => 0.01 + 0.06 * Math.sin(t)),
    us: series(60, (t) => 0.008 + 0.04 * Math.cos(t * 1.3)),
    gold: series(60, (t) => 0.005 + 0.03 * Math.sin(t * 0.7 + 1)),
    crypto: series(60, (t) => 0.03 + 0.2 * Math.sin(t * 2.1)),
  },
  savingsRate: 0.05,
  updatedAt: "2026-10-26T00:00:00Z",
  step: 0.02,
};

describe("toVnd", () => {
  it("nhân với tỷ giá gần nhất trước đó", () => {
    const usd: Bar[] = [
      ["2024-01-02", 10],
      ["2024-01-03", 11],
    ];
    const fx: Bar[] = [["2024-01-01", 25000]];
    expect(toVnd(usd, fx)).toEqual([
      ["2024-01-02", 250000],
      ["2024-01-03", 275000],
    ]);
  });
});

describe("computeAllocation", () => {
  const res = computeAllocation(input);

  it("mỗi hồ sơ: tổng tỷ trọng = 1, nằm trong giới hạn, không vượt biến động mục tiêu", () => {
    for (const [id, p] of Object.entries(res.optimized)) {
      const w = Object.values(p.weights);
      expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
      expect(p.vol).toBeLessThanOrEqual(p.targetVol + 1e-9);
      const bounds = OPT_PROFILES[id as keyof typeof OPT_PROFILES].bounds;
      ["vn", "us", "gold", "crypto", "savings"].forEach((c, i) => {
        expect(p.weights[c as keyof typeof p.weights]).toBeGreaterThanOrEqual(bounds[i][0] - 1e-9);
        expect(p.weights[c as keyof typeof p.weights]).toBeLessThanOrEqual(bounds[i][1] + 1e-9);
      });
    }
  });

  it("hồ sơ rủi ro cao hơn có lợi nhuận kỳ vọng cao hơn", () => {
    expect(res.optimized.balanced.ret).toBeGreaterThan(res.optimized.conservative.ret);
    expect(res.optimized.growth.ret).toBeGreaterThan(res.optimized.balanced.ret);
  });

  it("lợi nhuận kỳ vọng = trung bình giữa lịch sử và giả định dài hạn; tiết kiệm không biến động", () => {
    const vn = res.classes.find((c) => c.cls === "vn")!;
    expect(vn.expReturn).toBeCloseTo((vn.histReturn + 0.1) / 2);
    const sav = res.classes.find((c) => c.cls === "savings")!;
    expect(sav.vol).toBeCloseTo(0);
    expect(sav.expReturn).toBe(0.05);
  });

  it("đường biên tăng dần theo biến động", () => {
    expect(res.frontier.length).toBeGreaterThan(3);
    for (let i = 1; i < res.frontier.length; i++) {
      expect(res.frontier[i].ret).toBeGreaterThan(res.frontier[i - 1].ret);
      expect(res.frontier[i].vol).toBeGreaterThanOrEqual(res.frontier[i - 1].vol);
    }
  });

  it("báo lỗi khi dữ liệu chung quá ngắn", () => {
    expect(() =>
      computeAllocation({ ...input, series: { ...input.series, crypto: series(10, () => 0.01) } }),
    ).toThrow(/24/);
  });
});
