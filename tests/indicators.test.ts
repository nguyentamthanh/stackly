import { describe, expect, it } from "vitest";
import { cagr, clamp, drawdownFromPeak, linearScore, percentileRank, rsi, sma, toWeekly, changeOver } from "@/lib/indicators";
import type { Bar } from "@/lib/types";

describe("sma", () => {
  it("trả null cho các điểm chưa đủ dữ liệu", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("cửa sổ lớn hơn chuỗi thì toàn null", () => {
    expect(sma([1, 2], 5)).toEqual([null, null]);
  });
});

describe("rsi (Wilder)", () => {
  it("chuỗi chỉ tăng thì RSI = 100", () => {
    const up = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(rsi(up, 14).at(-1)).toBe(100);
  });
  it("chuỗi chỉ giảm thì RSI = 0", () => {
    const down = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(rsi(down, 14).at(-1)).toBe(0);
  });
  it("tăng giảm đều nhau thì RSI ≈ 50", () => {
    const zigzag = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 10 : 11));
    expect(rsi(zigzag, 14).at(-1)!).toBeGreaterThan(45);
    expect(rsi(zigzag, 14).at(-1)!).toBeLessThan(55);
  });
  it("giá trị khớp với tính tay cho chu kỳ 2", () => {
    // diffs: +1, -2, +3 → seed avgGain=(1+0)/2=0.5, avgLoss=(0+2)/2=1
    // bước 3: avgGain=(0.5*1+3)/2=1.75, avgLoss=(1*1+0)/2=0.5 → RS=3.5 → RSI=77.78
    const r = rsi([10, 11, 9, 12], 2);
    expect(r[2]).toBeCloseTo(100 - 100 / (1 + 0.5), 5);
    expect(r[3]).toBeCloseTo(100 - 100 / (1 + 3.5), 5);
  });
});

describe("drawdownFromPeak", () => {
  it("tính mức giảm so với đỉnh trước đó", () => {
    const dd = drawdownFromPeak([100, 120, 90, 130, 117]);
    [0, 0, -0.25, 0, -0.1].forEach((v, i) => expect(dd[i]).toBeCloseTo(v, 10));
  });
});

describe("percentileRank", () => {
  it("giá trị nhỏ nhất có percentile 0, lớn nhất 100", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(percentileRank(xs, 1)).toBe(0);
    expect(percentileRank(xs, 5)).toBe(100);
    expect(percentileRank(xs, 3)).toBe(50);
  });
  it("mảng rỗng trả 50", () => {
    expect(percentileRank([], 3)).toBe(50);
  });
});

describe("linearScore & clamp", () => {
  it("nội suy tuyến tính và kẹp trong 0–100", () => {
    expect(linearScore(30, 70, 30)).toBe(100);
    expect(linearScore(70, 70, 30)).toBe(0);
    expect(linearScore(50, 70, 30)).toBe(50);
    expect(linearScore(10, 70, 30)).toBe(100);
    expect(linearScore(90, 70, 30)).toBe(0);
    expect(clamp(5, 0, 3)).toBe(3);
  });
});

describe("toWeekly", () => {
  it("lấy phiên cuối cùng của mỗi tuần ISO", () => {
    const bars: Bar[] = [
      ["2026-10-12", 1], // thứ 2
      ["2026-10-16", 2], // thứ 6
      ["2026-10-19", 3], // thứ 2 tuần sau
      ["2026-10-21", 4],
    ];
    expect(toWeekly(bars)).toEqual([
      ["2026-10-16", 2],
      ["2026-10-21", 4],
    ]);
  });
});

describe("changeOver", () => {
  it("tính % thay đổi so với phiên gần nhất trước mốc ngày", () => {
    const bars: Bar[] = [
      ["2025-10-20", 100],
      ["2026-09-21", 150],
      ["2026-10-20", 200],
      ["2026-10-21", 210],
    ];
    expect(changeOver(bars, 1)).toBeCloseTo(0.05);
    expect(changeOver(bars, 30)).toBeCloseTo(210 / 150 - 1);
    expect(changeOver(bars, 365)).toBeCloseTo(1.1);
    expect(changeOver(bars, 5000)).toBeNull();
  });
});

describe("cagr", () => {
  it("gấp đôi sau ~1 năm thì CAGR ≈ 100%", () => {
    expect(cagr([["2020-01-01", 100], ["2021-01-01", 200]])!).toBeCloseTo(1, 2);
  });
  it("trả null khi lịch sử quá ngắn", () => {
    expect(cagr([["2020-01-01", 100], ["2020-02-01", 200]])).toBeNull();
  });
});
