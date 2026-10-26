import { describe, expect, it } from "vitest";
import { countByLevel, fundAlerts } from "@/lib/fund-alerts";
import { summarizeNav, type FundHistory } from "@/lib/fund-history";
import { parseFmarketRow, type Fund, type FundBenchmarks } from "@/lib/funds";

const bench = {
  y1: { vnindex: 0.05, savings: 0.049 },
  y3: { vnindex: 0.3, savings: 0.15 },
} as FundBenchmarks;

const pc = (x: number | undefined) => (x == null ? null : x * 100);

function fund(code: string, type: string, r: Partial<Record<"m1" | "m3" | "y1" | "y3", number>>, extra: Record<string, unknown> = {}): Fund {
  const t = Date.UTC(2026, 9, 26);
  return parseFmarketRow({
    id: code.length,
    shortName: code,
    nav: 10000,
    managementFee: 1,
    firstIssueAt: Date.UTC(2015, 0, 1),
    owner: { shortName: "X" },
    dataFundAssetType: { code: type },
    // API Fmarket trả phần trăm (8,2 = 8,2%) nên đổi từ tỷ lệ sang phần trăm
    productNavChange: { navTo1Months: pc(r.m1), navTo3Months: pc(r.m3), navTo12Months: pc(r.y1), navTo36Months: pc(r.y3), updateAt: t },
    ...extra,
  })!;
}

const ids = (f: Fund, history?: FundHistory | null, peers: Fund[] = [f]) => fundAlerts(f, { benchmarks: bench, peers, history }).map((a) => a.id);

describe("fundAlerts: lợi nhuận", () => {
  it("thua VN-Index cả 1 và 3 năm: lưu ý, chỉ nghiêm trọng khi thua rất xa", () => {
    const mild = fund("A", "STOCK", { y1: 0.02, y3: 0.2 });
    expect(fundAlerts(mild, { benchmarks: bench, peers: [mild] })[0]).toMatchObject({ id: "lagging-persistent", level: "medium" });
    const far = fund("A2", "STOCK", { y1: -0.08, y3: 0.05 });
    expect(fundAlerts(far, { benchmarks: bench, peers: [far] }).find((a) => a.id === "lagging-persistent")?.level).toBe("high");
  });

  it("chỉ thua 1 năm → lưu ý, không phải nghiêm trọng", () => {
    const f = fund("B", "STOCK", { y1: 0.02, y3: 0.4 });
    const a = fundAlerts(f, { benchmarks: bench, peers: [f] });
    expect(a.map((x) => x.id)).toEqual(["lagging-1y"]);
    expect(a[0].level).toBe("medium");
  });

  it("quỹ trái phiếu được so với lãi tiết kiệm, không phải VN-Index", () => {
    const f = fund("C", "BOND", { y1: 0.045, y3: 0.2 });
    expect(ids(f)).toEqual(["lagging-1y"]);
    const g = fund("D", "BOND", { y1: 0.06, y3: 0.2 });
    expect(ids(g)).toEqual([]);
  });

  it("NAV giảm trong 12 tháng: giảm nhẹ là lưu ý, giảm từ 5% là nghiêm trọng", () => {
    const level = (y1: number) => fundAlerts(fund("E", "STOCK", { y1, y3: 0.5 }), { benchmarks: bench, peers: [] }).find((a) => a.id === "negative-1y")?.level;
    expect(level(-0.03)).toBe("medium");
    expect(level(-0.06)).toBe("high");
    expect(level(0.01)).toBeUndefined();
  });

  it("quỹ trái phiếu giảm 1% trong tháng là nghiêm trọng, quỹ cổ phiếu thì chưa", () => {
    const bond = fundAlerts(fund("F", "BOND", { m1: -0.011, y1: 0.07, y3: 0.2 }), { benchmarks: bench, peers: [] });
    expect(bond[0]).toMatchObject({ id: "drop-1m", level: "high" });
    expect(ids(fund("G", "STOCK", { m1: -0.011, y1: 0.07, y3: 0.5 }))).not.toContain("drop-1m");
  });

  it("không báo giảm 3 tháng khi đã báo giảm 1 tháng", () => {
    const f = fund("H", "STOCK", { m1: -0.07, m3: -0.1, y1: 0.1, y3: 0.5 });
    const a = ids(f);
    expect(a).toContain("drop-1m");
    expect(a).not.toContain("drop-3m");
  });
});

describe("fundAlerts: lịch sử NAV", () => {
  const history = (over: Partial<FundHistory>): FundHistory => ({
    asOf: "2026-10-22",
    months: [],
    vol: 0.1,
    maxDrawdown: -0.05,
    drawdown: -0.02,
    ...over,
  });
  const ok = fund("I", "STOCK", { y1: 0.1, y3: 0.5 });

  it("giảm sâu so với đỉnh: lưu ý rồi nghiêm trọng theo ngưỡng", () => {
    expect(fundAlerts(ok, { benchmarks: bench, peers: [], history: history({ drawdown: -0.12 }) })[0]).toMatchObject({ id: "drawdown", level: "medium" });
    expect(fundAlerts(ok, { benchmarks: bench, peers: [], history: history({ drawdown: -0.2 }) })[0]).toMatchObject({ id: "drawdown", level: "high" });
    expect(ids(ok, history({ drawdown: -0.03 }))).not.toContain("drawdown");
  });

  it("giảm cùng nhịp thị trường chung chỉ là thông tin; giảm sâu hơn thị trường vẫn là cảnh báo", () => {
    const h = history({ drawdown: -0.2 });
    const a = fundAlerts(ok, { benchmarks: bench, marketDrawdown: 0.19, peers: [], history: h })[0];
    expect(a).toMatchObject({ id: "drawdown-market", level: "info" });
    const b = fundAlerts(ok, { benchmarks: bench, marketDrawdown: 0.05, peers: [], history: h })[0];
    expect(b).toMatchObject({ id: "drawdown", level: "high" });
    // Quỹ trái phiếu không so với thị trường cổ phiếu
    const bond = fund("K", "BOND", { y1: 0.07, y3: 0.2 });
    expect(fundAlerts(bond, { benchmarks: bench, marketDrawdown: 0.05, peers: [], history: history({ drawdown: -0.03 }) })[0].id).toBe("drawdown");
  });

  it("biến động vượt mức của loại quỹ", () => {
    expect(ids(ok, history({ vol: 0.3 }))).toContain("volatility");
    const bond = fund("J", "BOND", { y1: 0.07, y3: 0.2 });
    expect(ids(bond, history({ vol: 0.05 }))).toContain("volatility");
    expect(ids(bond, history({ vol: 0.01 }))).not.toContain("volatility");
  });

  it("3 tháng liên tiếp giảm", () => {
    const months = [0.01, -0.01, -0.02, -0.005].map((ret, i) => ({ month: `2026-0${i + 7}`, ret }));
    expect(ids(ok, history({ months }))).toContain("streak");
    const mixed = [-0.01, 0.02, -0.02].map((ret, i) => ({ month: `2026-0${i + 8}`, ret }));
    expect(ids(ok, history({ months: mixed }))).not.toContain("streak");
  });
});

describe("fundAlerts: so với cùng loại và đặc điểm quỹ", () => {
  const peers = Array.from({ length: 10 }, (_, i) => fund(`P${i}`, "STOCK", { y1: 0.1 + i * 0.02, y3: 0.2 + i * 0.05 }));

  it("nhóm 25% yếu nhất", () => {
    expect(ids(peers[0], null, peers)).toContain("bottom-quartile");
    expect(ids(peers[9], null, peers)).not.toContain("bottom-quartile");
  });

  it("phí cao và lợi nhuận 3 năm dưới trung vị", () => {
    const f = fund("Z", "STOCK", { y1: 0.2, y3: 0.1 }, { managementFee: 1.9 });
    expect(ids(f, null, [...peers, f])).toContain("high-fee");
    const cheap = fund("Y", "STOCK", { y1: 0.2, y3: 0.1 }, { managementFee: 0.8 });
    expect(ids(cheap, null, [...peers, cheap])).not.toContain("high-fee");
  });

  it("quỹ dưới 1 năm: cảnh báo thông tin", () => {
    const f = fund("N", "STOCK", { y1: 0.1 }, { firstIssueAt: Date.UTC(2026, 3, 1) });
    const a = fundAlerts(f, { benchmarks: bench, peers: [f] }).find((x) => x.id === "short-history");
    expect(a?.level).toBe("info");
    expect(a?.title).toMatch(/dưới 1 năm/);
  });

  it("sắp xếp nghiêm trọng trước, thông tin sau", () => {
    const f = fund("M", "STOCK", { y1: -0.08, y3: 0.1 }, { firstIssueAt: Date.UTC(2026, 3, 1) });
    const levels = fundAlerts(f, { benchmarks: bench, peers: [f] }).map((a) => a.level);
    expect(levels[0]).toBe("high");
    expect(levels.at(-1)).toBe("info");
  });
});

describe("countByLevel", () => {
  it("đếm mỗi quỹ một lần theo mức cao nhất", () => {
    const a = (level: "high" | "medium" | "info") => ({ id: level, level, title: "", detail: "" });
    expect(countByLevel({ x: [a("medium"), a("high")], y: [a("info")], z: [], w: [a("medium")] })).toEqual({ high: 1, medium: 1, info: 1 });
  });
});

describe("summarizeNav", () => {
  const weekly = (start: string, navs: number[]) => {
    const d = new Date(start + "T00:00:00Z");
    return navs.map((nav) => {
      const p = { date: d.toISOString().slice(0, 10), nav };
      d.setUTCDate(d.getUTCDate() + 7);
      return p;
    });
  };

  it("tính lợi nhuận tháng, sụt giảm và biến động", () => {
    // 60 tuần: tăng đều, sau đó sập 20% ở 8 tuần cuối
    const navs = [...Array.from({ length: 52 }, (_, i) => 100 + i), ...Array.from({ length: 8 }, (_, i) => 151 - (i + 1) * 4)];
    const h = summarizeNav(weekly("2025-09-01", navs))!;
    expect(h.months).toHaveLength(12);
    expect(h.drawdown).toBeLessThan(-0.15);
    expect(h.maxDrawdown).toBeLessThanOrEqual(h.drawdown);
    expect(h.vol).not.toBeNull();
    expect(h.months.at(-1)!.ret).toBeLessThan(0);
  });

  it("quá ít điểm thì không tóm tắt", () => {
    expect(summarizeNav(weekly("2026-01-01", [1, 2, 3]))).toBeNull();
  });

  it("NAV đi ngang: không có sụt giảm", () => {
    const h = summarizeNav(weekly("2025-09-01", Array.from({ length: 56 }, () => 100)))!;
    expect(h.drawdown).toBe(0);
    expect(h.maxDrawdown).toBe(0);
  });
});
