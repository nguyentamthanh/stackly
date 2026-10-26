import { describe, expect, it } from "vitest";
import { beatsBenchmark, parseFmarketResponse, parseFmarketRow, rankFunds, type FundBenchmarks } from "@/lib/funds";

const row = (code: string, type: string, y1: number | null, extra: Record<string, unknown> = {}) => ({
  id: code.length,
  name: `QUỸ ${code}`,
  shortName: code,
  nav: 12345.6,
  managementFee: 1.5,
  firstIssueAt: 1364749200000,
  websiteURL: "https://example.com/" + code,
  owner: { shortName: "ABC", name: "CÔNG TY ABC" },
  dataFundAssetType: { code: type },
  productNavChange: { navTo1Months: 1, navTo12Months: y1, navTo36Months: 30, navToLastYear: 5, annualizedReturn36Months: 9.14 },
  ...extra,
});

describe("parseFmarketRow", () => {
  it("đổi phần trăm sang tỷ lệ và lấy đúng các trường", () => {
    const f = parseFmarketRow(row("VFF", "BOND", 8.22))!;
    expect(f.code).toBe("VFF");
    expect(f.type).toBe("BOND");
    expect(f.returns.y1).toBeCloseTo(0.0822, 10);
    expect(f.returns.ytd).toBeCloseTo(0.05, 10);
    expect(f.returns.y5).toBeNull();
    expect(f.annualized3y).toBeCloseTo(0.0914, 10);
    expect(f.managementFee).toBeCloseTo(0.015, 10);
    expect(f.manager).toBe("ABC");
    expect(f.inception).toBe("2013-04-01");
  });

  it("bỏ dòng thiếu NAV hoặc loại quỹ lạ", () => {
    expect(parseFmarketRow(row("X", "BOND", 1, { nav: null }))).toBeNull();
    expect(parseFmarketRow(row("Y", "MMF", 1))).toBeNull();
    expect(parseFmarketRow(null)).toBeNull();
  });

  it("không nhận link website không phải http", () => {
    expect(parseFmarketRow(row("Z", "STOCK", 1, { websiteURL: "javascript:alert(1)" }))!.website).toBeNull();
  });
});

describe("lợi nhuận từ khi thành lập", () => {
  const year = 365.25 * 86400000;
  const issued = Date.UTC(2014, 0, 1);
  const withAge = (code: string, years: number, totalPct: number) =>
    row(code, "STOCK", 1, { firstIssueAt: issued, productNavChange: { navToEstablish: totalPct, navTo10Years: 150, updateAt: issued + years * year } });

  it("tính bình quân năm từ tổng lợi nhuận và tuổi quỹ", () => {
    const f = parseFmarketRow(withAge("OLD", 10, 159.37))!;
    expect(f.returns.since).toBeCloseTo(1.5937, 10);
    expect(f.returns.cagr).toBeCloseTo(0.1, 4);
    expect(f.returns.y10).toBeCloseTo(1.5, 10);
    expect(f.ageYears).toBe(10);
  });

  it("quỹ dưới 3 năm không có lợi nhuận bình quân năm", () => {
    expect(parseFmarketRow(withAge("NEW", 2, 40))!.returns.cagr).toBeNull();
  });

  it("xếp theo bình quân năm thì quỹ trẻ lãi cao vượt quỹ lâu đời có tổng lớn", () => {
    const funds = [parseFmarketRow(withAge("OLD", 20, 500))!, parseFmarketRow(withAge("MID", 5, 100))!];
    expect(rankFunds(funds, "since").map((f) => f.code)).toEqual(["OLD", "MID"]);
    expect(rankFunds(funds, "cagr").map((f) => f.code)).toEqual(["MID", "OLD"]);
  });
});

describe("parseFmarketResponse", () => {
  it("bỏ quỹ trùng mã", () => {
    const funds = parseFmarketResponse({ data: { rows: [row("A", "STOCK", 1), row("A", "STOCK", 2), row("B", "BOND", 3)] } });
    expect(funds.map((f) => f.code)).toEqual(["A", "B"]);
  });
  it("báo lỗi khi phản hồi sai định dạng", () => {
    expect(() => parseFmarketResponse({ data: {} })).toThrow();
  });
});

describe("rankFunds", () => {
  const funds = parseFmarketResponse({
    data: { rows: [row("A", "STOCK", 5), row("B", "BOND", 8), row("C", "STOCK", 12), row("D", "STOCK", null), row("E", "BALANCED", -3)] },
  });

  it("xếp giảm dần theo kỳ, loại quỹ chưa đủ dữ liệu", () => {
    const r = rankFunds(funds, "y1");
    expect(r.map((f) => f.code)).toEqual(["C", "B", "A", "E"]);
    expect(r[0].rank).toBe(1);
    expect(r[0].value).toBeCloseTo(0.12, 10);
  });

  it("lọc theo loại quỹ", () => {
    expect(rankFunds(funds, "y1", "STOCK").map((f) => f.code)).toEqual(["C", "A"]);
  });
});

describe("beatsBenchmark", () => {
  const b = { y1: { vnindex: 0.1, savings: 0.06 } } as FundBenchmarks;
  const [stock, bond] = parseFmarketResponse({ data: { rows: [row("S", "STOCK", 12), row("T", "BOND", 5)] } });
  it("quỹ cổ phiếu so với VN-Index, quỹ trái phiếu so với tiết kiệm", () => {
    expect(beatsBenchmark(stock, "y1", b)).toBe(true);
    expect(beatsBenchmark(bond, "y1", b)).toBe(false);
  });
});
