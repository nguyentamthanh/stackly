// Bảng xếp hạng quỹ mở Việt Nam. Dữ liệu lấy từ API công khai của Fmarket (nền tảng phân phối chứng chỉ quỹ),
// chuẩn hóa ở đây để dùng chung cho trang web, API nội bộ và pipeline dữ liệu.

export type FundType = "STOCK" | "BOND" | "BALANCED";

export const FUND_TYPE_LABELS: Record<FundType, string> = {
  STOCK: "Cổ phiếu",
  BOND: "Trái phiếu",
  BALANCED: "Cân bằng",
};

export type FundPeriod = "m1" | "m3" | "m6" | "ytd" | "y1" | "y3" | "y5" | "y7" | "y10" | "since" | "cagr";

export type FundPeriodGroup = "Ngắn hạn" | "Dài hạn" | "Từ trước đến nay";

export const FUND_PERIODS: { key: FundPeriod; label: string; days: number; group: FundPeriodGroup }[] = [
  { key: "m1", label: "1 tháng", days: 30, group: "Ngắn hạn" },
  { key: "m3", label: "3 tháng", days: 91, group: "Ngắn hạn" },
  { key: "m6", label: "6 tháng", days: 182, group: "Ngắn hạn" },
  { key: "ytd", label: "Từ đầu năm", days: 0, group: "Ngắn hạn" },
  { key: "y1", label: "1 năm", days: 365, group: "Ngắn hạn" },
  { key: "y3", label: "3 năm", days: 1095, group: "Dài hạn" },
  { key: "y5", label: "5 năm", days: 1826, group: "Dài hạn" },
  { key: "y7", label: "7 năm", days: 2557, group: "Dài hạn" },
  { key: "y10", label: "10 năm", days: 3652, group: "Dài hạn" },
  { key: "cagr", label: "Bình quân/năm từ khi thành lập", days: 0, group: "Từ trước đến nay" },
  { key: "since", label: "Tổng lợi nhuận từ khi thành lập", days: 0, group: "Từ trước đến nay" },
];

/** Kỳ không có mốc so sánh chung vì mỗi quỹ thành lập ở một thời điểm khác nhau */
export const SINCE_INCEPTION: FundPeriod[] = ["since", "cagr"];

/** Tuổi tối thiểu để xếp hạng lợi nhuận bình quân năm: quỹ quá trẻ dễ đứng đầu nhờ may mắn ngắn hạn */
export const MIN_CAGR_YEARS = 3;

export interface Fund {
  id: number;
  code: string;
  name: string;
  /** Tên viết tắt công ty quản lý quỹ */
  manager: string;
  type: FundType;
  nav: number;
  /**
   * Lợi nhuận theo kỳ (tỷ lệ, 0.08 = 8%), null nếu quỹ chưa đủ tuổi.
   * "since" là tổng lợi nhuận từ khi thành lập; "cagr" là lợi nhuận bình quân năm từ khi thành lập (chỉ khi đủ MIN_CAGR_YEARS).
   */
  returns: Record<FundPeriod, number | null>;
  /** Số năm hoạt động tính đến ngày cập nhật NAV */
  ageYears: number | null;
  /** Lợi nhuận bình quân năm trong 3 năm */
  annualized3y: number | null;
  /** Phí quản lý năm (tỷ lệ) */
  managementFee: number | null;
  /** Ngày phát hành lần đầu YYYY-MM-DD */
  inception: string | null;
  website: string | null;
}

export interface FundsFile {
  updatedAt: string;
  /** "fmarket" khi vừa gọi API, "snapshot" khi dùng bản lưu của pipeline */
  source: "fmarket" | "snapshot";
  funds: Fund[];
}

const pct = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x / 100 : null);
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

function toDate(ms: unknown): string | null {
  return typeof ms === "number" && ms > 0 ? new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10) : null;
}

/** Chuyển một dòng thô của Fmarket thành Fund; bỏ qua dòng thiếu thông tin cốt lõi */
export function parseFmarketRow(row: unknown): Fund | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const type = (r.dataFundAssetType as { code?: string } | null)?.code;
  const code = typeof r.shortName === "string" ? r.shortName : typeof r.code === "string" ? r.code : null;
  const nav = num(r.nav);
  if (!code || nav == null || (type !== "STOCK" && type !== "BOND" && type !== "BALANCED")) return null;
  const c = (r.productNavChange ?? {}) as Record<string, unknown>;
  const owner = (r.owner ?? {}) as Record<string, unknown>;
  const site = typeof r.websiteURL === "string" && r.websiteURL.startsWith("http") ? r.websiteURL : null;
  const since = pct(c.navToEstablish);
  // Quỹ mới trên Fmarket thường thiếu ngày phát hành, khi đó dùng ngày cấp phép
  const issued = num(r.firstIssueAt) || num(r.approveAt);
  const asOf = num(c.updateAt) ?? Date.now();
  const ageYears = issued != null && issued > 0 && asOf > issued ? (asOf - issued) / (365.25 * 86400000) : null;
  const cagr = since != null && since > -1 && ageYears != null && ageYears >= MIN_CAGR_YEARS ? Math.pow(1 + since, 1 / ageYears) - 1 : null;
  return {
    id: num(r.id) ?? 0,
    code,
    name: typeof r.name === "string" ? r.name : code,
    manager: typeof owner.shortName === "string" ? owner.shortName : typeof owner.name === "string" ? owner.name : "",
    type,
    nav,
    returns: {
      m1: pct(c.navTo1Months),
      m3: pct(c.navTo3Months),
      m6: pct(c.navTo6Months),
      ytd: pct(c.navToLastYear),
      y1: pct(c.navTo12Months),
      y3: pct(c.navTo36Months),
      y5: pct(c.navTo60Months),
      y7: pct(c.navTo7Years),
      y10: pct(c.navTo10Years),
      since,
      cagr,
    },
    ageYears: ageYears != null ? Math.round(ageYears * 10) / 10 : null,
    annualized3y: pct(c.annualizedReturn36Months),
    managementFee: pct(r.managementFee),
    inception: toDate(issued),
    website: site,
  };
}

export function parseFmarketResponse(json: unknown): Fund[] {
  const rows = (json as { data?: { rows?: unknown[] } } | null)?.data?.rows;
  if (!Array.isArray(rows)) throw new Error("Phản hồi Fmarket không có danh sách quỹ");
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const f = parseFmarketRow(row);
    if (!f || seen.has(f.code)) return [];
    seen.add(f.code);
    return [f];
  });
}

export interface RankedFund extends Fund {
  rank: number;
  value: number;
}

/** Lọc theo loại quỹ và xếp hạng theo lợi nhuận kỳ đã chọn; quỹ chưa đủ dữ liệu bị loại khỏi bảng xếp hạng */
export function rankFunds(funds: Fund[], period: FundPeriod, type: FundType | "all" = "all"): RankedFund[] {
  return funds
    .filter((f) => (type === "all" || f.type === type) && f.returns[period] != null)
    .sort((a, b) => b.returns[period]! - a.returns[period]! || a.code.localeCompare(b.code))
    .map((f, i) => ({ ...f, rank: i + 1, value: f.returns[period]! }));
}

/** Mốc so sánh cho từng kỳ: VN-Index (quỹ cổ phiếu, cân bằng) và lãi tiết kiệm (quỹ trái phiếu) */
export type FundBenchmarks = Record<FundPeriod, { vnindex: number | null; savings: number | null }>;

export function beatsBenchmark(f: Fund, period: FundPeriod, b: FundBenchmarks): boolean | null {
  const r = f.returns[period];
  const ref = f.type === "BOND" ? b[period].savings : b[period].vnindex;
  return r == null || ref == null ? null : r > ref;
}

// ---------------------------------------------------------------------------
// Gọi API Fmarket (dùng được cả trong Next.js và trong script Node)

export const FMARKET_URL = "https://api.fmarket.vn/res/products/filter";

const FMARKET_BODY = {
  types: ["NEW_FUND", "TRADING_FUND"],
  issuerIds: [],
  sortOrder: "DESC",
  sortField: "navTo12Months",
  page: 1,
  pageSize: 200,
  isIpo: false,
  fundAssetTypes: [],
  bondRemainPeriods: [],
  searchField: "",
  isBuyByReward: false,
  thirdAppIds: [],
};

export const FMARKET_NAV_URL = "https://api.fmarket.vn/res/product/get-nav-history";

const compact = (d: Date) => d.toISOString().slice(0, 10).replaceAll("-", "");

/** Lịch sử NAV của một quỹ (theo id sản phẩm Fmarket) trong khoảng from → to */
export async function fetchFmarketNavHistory(
  productId: number,
  from: Date,
  to: Date,
  timeoutMs = 15000,
): Promise<{ date: string; nav: number }[]> {
  const res = await fetch(FMARKET_NAV_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ isAllData: 0, productId, fromDate: compact(from), toDate: compact(to) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Fmarket NAV HTTP ${res.status}`);
  const data = ((await res.json()) as { data?: { navDate?: unknown; nav?: unknown }[] }).data;
  if (!Array.isArray(data)) throw new Error("Phản hồi lịch sử NAV không có danh sách");
  return data.flatMap((p) =>
    typeof p.navDate === "string" && typeof p.nav === "number" && Number.isFinite(p.nav) ? [{ date: p.navDate.slice(0, 10), nav: p.nav }] : [],
  );
}

export async function fetchFmarketFunds(timeoutMs = 15000): Promise<Fund[]> {
  const res = await fetch(FMARKET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(FMARKET_BODY),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Fmarket HTTP ${res.status}`);
  const funds = parseFmarketResponse(await res.json());
  if (funds.length < 10) throw new Error(`Fmarket chỉ trả ${funds.length} quỹ`);
  return funds;
}
