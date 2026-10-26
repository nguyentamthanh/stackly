import { describe, expect, it } from "vitest";
import { computeSignal, levelForScore, scoreHistory } from "@/lib/signals";
import type { Bar } from "@/lib/types";

function makeBars(values: number[], start = "2018-01-01"): Bar[] {
  const d = new Date(start + "T00:00:00Z");
  return values.map((v) => {
    const bar: Bar = [d.toISOString().slice(0, 10), v];
    d.setUTCDate(d.getUTCDate() + 1);
    return bar;
  });
}

// Giá tăng đều rồi tăng tốc ở 100 phiên cuối, kết thúc ở đỉnh
const uptrend = makeBars(
  Array.from({ length: 900 }, (_, i) => 100 * Math.pow(1.001, Math.min(i, 800)) * Math.pow(1.003, Math.max(0, i - 800))),
);
// Tăng rồi sập 40% ở cuối
const crash = makeBars([
  ...Array.from({ length: 800 }, (_, i) => 100 * Math.pow(1.001, i) * (1 + 0.01 * Math.sin(i / 3))),
  ...Array.from({ length: 100 }, (_, i) => 222 * (1 - 0.4 * (i / 99))),
]);

describe("levelForScore", () => {
  it("ánh xạ đúng các ngưỡng biên", () => {
    expect(levelForScore(0).multiplier).toBe(0.5);
    expect(levelForScore(19.9).multiplier).toBe(0.5);
    expect(levelForScore(20).multiplier).toBe(0.75);
    expect(levelForScore(40).multiplier).toBe(1);
    expect(levelForScore(59.9).multiplier).toBe(1);
    expect(levelForScore(60).multiplier).toBe(1.5);
    expect(levelForScore(80).multiplier).toBe(2);
    expect(levelForScore(100).level).toBe("very-cheap");
  });
});

describe("computeSignal", () => {
  it("thị trường tăng liên tục ở đỉnh → điểm thấp (đắt)", () => {
    const s = computeSignal({ id: "x", kind: "equity", bars: uptrend });
    expect(s.score).toBeLessThan(40);
    expect(s.multiplier).toBeLessThanOrEqual(0.75);
  });

  it("vừa sập 40% → điểm cao (rẻ)", () => {
    const s = computeSignal({ id: "x", kind: "equity", bars: crash });
    expect(s.score).toBeGreaterThan(70);
    expect(s.multiplier).toBeGreaterThanOrEqual(1.5);
  });

  it("có thành phần P/E khi truyền lịch sử P/E, trọng số luôn cộng lại = 100", () => {
    const pe = makeBars(Array.from({ length: 900 }, (_, i) => 10 + i / 100));
    const s = computeSignal({ id: "x", kind: "equity", bars: uptrend, pe });
    const pec = s.components.find((c) => c.key === "pe");
    expect(pec).toBeDefined();
    // P/E cuối cùng là cao nhất lịch sử → điểm P/E = 0
    expect(pec!.score).toBe(0);
    expect(s.components.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(100);
  });

  it("vàng: chênh lệch trong nước cao kéo điểm xuống", () => {
    const low = computeSignal({ id: "g", kind: "gold", bars: crash, premium: makeBars([0.02], crash.at(-1)![0]) });
    const high = computeSignal({ id: "g", kind: "gold", bars: crash, premium: makeBars([0.2], crash.at(-1)![0]) });
    expect(low.score - high.score).toBeGreaterThan(30);
    expect(high.components.find((c) => c.key === "premium")!.score).toBe(0);
  });

  it("crypto dùng Mayer Multiple thay cho percentile MA200", () => {
    const s = computeSignal({ id: "c", kind: "crypto", bars: crash });
    expect(s.components.map((c) => c.key).sort()).toEqual(["drawdown", "mayer", "rsi"]);
  });

  it("tiết kiệm chấm theo lãi suất thực", () => {
    const good = computeSignal({ id: "s", kind: "savings", bars: [], realRate: 0.04, price: 0.075 });
    const bad = computeSignal({ id: "s", kind: "savings", bars: [], realRate: -0.01, price: 0.03 });
    expect(good.score).toBe(100);
    expect(bad.score).toBe(0);
  });

  it("dùng priceBars để hiển thị giá khi khác chuỗi chỉ báo", () => {
    const priceBars = makeBars([150_000_000, 151_000_000], "2020-06-01");
    const s = computeSignal({ id: "g", kind: "gold", bars: crash, priceBars });
    expect(s.price).toBe(151_000_000);
    expect(s.change1d).toBeCloseTo(151 / 150 - 1);
  });
});

describe("scoreHistory", () => {
  it("trả về điểm theo tuần, giá trị trong 0–100, điểm cuối khớp computeSignal", () => {
    const h = scoreHistory({ id: "x", kind: "equity", bars: crash });
    expect(h.length).toBeGreaterThan(50);
    expect(h.every(([, v]) => v >= 0 && v <= 100)).toBe(true);
    const s = computeSignal({ id: "x", kind: "equity", bars: crash });
    expect(h.at(-1)![1]).toBeCloseTo(s.score, 0);
  });
});
