import { describe, expect, it } from "vitest";
import { alignMonthly, covariance, monthlyReturns, optimize, portfolioStats, type Bounds } from "@/lib/frontier";
import type { Bar } from "@/lib/types";

describe("monthlyReturns", () => {
  it("lấy giá cuối mỗi tháng và tính lợi nhuận tháng", () => {
    const bars: Bar[] = [
      ["2024-01-10", 90],
      ["2024-01-31", 100],
      ["2024-02-15", 105],
      ["2024-02-29", 110],
      ["2024-03-28", 99],
    ];
    const r = monthlyReturns(bars);
    expect([...r.keys()]).toEqual(["2024-02", "2024-03"]);
    expect(r.get("2024-02")).toBeCloseTo(0.1);
    expect(r.get("2024-03")).toBeCloseTo(-0.1);
  });
});

describe("alignMonthly", () => {
  it("chỉ giữ các tháng mà mọi chuỗi đều có", () => {
    const a = new Map([
      ["2024-01", 0.1],
      ["2024-02", 0.2],
      ["2024-03", 0.3],
    ]);
    const b = new Map([
      ["2024-02", 1],
      ["2024-03", 2],
      ["2024-04", 3],
    ]);
    const { months, matrix } = alignMonthly([a, b]);
    expect(months).toEqual(["2024-02", "2024-03"]);
    expect(matrix).toEqual([
      [0.2, 0.3],
      [1, 2],
    ]);
  });
});

describe("covariance", () => {
  it("phương sai mẫu trên đường chéo, hiệp phương sai đối xứng", () => {
    const c = covariance([
      [1, 2, 3],
      [2, 4, 6],
    ]);
    expect(c[0][0]).toBeCloseTo(1);
    expect(c[1][1]).toBeCloseTo(4);
    expect(c[0][1]).toBeCloseTo(2);
    expect(c[1][0]).toBeCloseTo(2);
  });
});

describe("optimize", () => {
  // Tài sản 0: an toàn (lợi nhuận 5%, không biến động) ; 1: lợi nhuận 10%, biến động 20% ; 2: lợi nhuận 8%, biến động 20%, không tương quan với 1
  const mu = [0.05, 0.1, 0.08];
  const cov = [
    [0, 0, 0],
    [0, 0.04, 0],
    [0, 0, 0.04],
  ];
  const open: Bounds = [
    [0, 1],
    [0, 1],
    [0, 1],
  ];

  it("tổng tỷ trọng = 1 và nằm trong giới hạn", () => {
    const res = optimize({ mu, cov, bounds: open, targetVol: 0.1, step: 0.02 })!;
    expect(res.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(res.weights.every((w) => w >= 0 && w <= 1)).toBe(true);
  });

  it("không vượt mức biến động mục tiêu và tận dụng gần hết", () => {
    const res = optimize({ mu, cov, bounds: open, targetVol: 0.1, step: 0.02 })!;
    expect(res.vol).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(res.vol).toBeGreaterThan(0.09);
  });

  it("đa dạng hóa: giữ cả hai tài sản rủi ro không tương quan thay vì dồn vào một", () => {
    const res = optimize({ mu, cov, bounds: open, targetVol: 0.1, step: 0.02 })!;
    expect(res.weights[1]).toBeGreaterThan(0);
    expect(res.weights[2]).toBeGreaterThan(0);
  });

  it("tôn trọng giới hạn min/max", () => {
    const bounds: Bounds = [
      [0.3, 1],
      [0, 0.2],
      [0, 1],
    ];
    const res = optimize({ mu, cov, bounds, targetVol: 0.5, step: 0.02 })!;
    expect(res.weights[0]).toBeGreaterThanOrEqual(0.3 - 1e-9);
    expect(res.weights[1]).toBeLessThanOrEqual(0.2 + 1e-9);
  });

  it("trả null khi không có tổ hợp nào thỏa giới hạn", () => {
    const bounds: Bounds = [
      [0, 0.2],
      [0, 0.2],
      [0, 0.2],
    ];
    expect(optimize({ mu, cov, bounds, targetVol: 1, step: 0.05 })).toBeNull();
  });
});

describe("portfolioStats", () => {
  it("tính lợi nhuận và biến động của danh mục", () => {
    const s = portfolioStats([0.5, 0.5, 0], [0.05, 0.1, 0.08], [
      [0, 0, 0],
      [0, 0.04, 0],
      [0, 0, 0.04],
    ]);
    expect(s.ret).toBeCloseTo(0.075);
    expect(s.vol).toBeCloseTo(0.1);
  });
});
