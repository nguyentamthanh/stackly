// Chỉ dùng phía server: gọi API Fmarket lấy danh sách quỹ mới nhất, cache 1 giờ.
// Khi Fmarket lỗi hoặc chặn, dùng bản lưu hằng ngày của pipeline (public/data/funds.json) và thử lại sau vài phút.
import { readFileSync } from "node:fs";
import path from "node:path";
import { cacheLife } from "next/cache";
import { averageRate12m, getAssetDetail, getSavings } from "./data";
import { fundAlerts, type FundAlert } from "./fund-alerts";
import type { FundHistory, FundHistoryFile } from "./fund-history";
import { fetchFmarketFunds, FUND_PERIODS, SINCE_INCEPTION, type Fund, type FundBenchmarks, type FundsFile } from "./funds";
import { changeOver } from "./indicators";

function readSnapshot(): FundsFile | null {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "public", "data", "funds.json"), "utf8")) as FundsFile;
  } catch {
    return null;
  }
}

export async function getLatestFunds(): Promise<FundsFile> {
  "use cache";
  try {
    const funds = await fetchFmarketFunds();
    cacheLife("hours");
    return { updatedAt: new Date().toISOString(), source: "fmarket", funds };
  } catch (err) {
    console.warn(`Không gọi được Fmarket, dùng bản lưu: ${(err as Error).message}`);
    cacheLife("minutes");
    return readSnapshot() ?? { updatedAt: new Date(0).toISOString(), source: "snapshot", funds: [] };
  }
}

/** Lợi nhuận VN-Index và lãi tiết kiệm (đơn) ứng với từng kỳ của bảng xếp hạng */
export function getFundBenchmarks(): FundBenchmarks {
  const bars = getAssetDetail("vnindex")?.bars ?? [];
  const rate = averageRate12m(getSavings());
  const last = bars.at(-1);
  const year = last?.[0].slice(0, 4);
  const prevYearClose = year ? bars.findLast((b) => b[0] < `${year}-01-01`)?.[1] : undefined;
  const ytdDays = last ? (Date.parse(last[0]) - Date.parse(`${year}-01-01`)) / 86400000 : 0;
  return Object.fromEntries(
    FUND_PERIODS.map((p) => {
      if (SINCE_INCEPTION.includes(p.key)) return [p.key, { vnindex: null, savings: null }];
      if (p.key === "ytd") {
        return [p.key, { vnindex: last && prevYearClose ? last[1] / prevYearClose - 1 : null, savings: (rate * ytdDays) / 365 }];
      }
      return [p.key, { vnindex: changeOver(bars, p.days), savings: Math.pow(1 + rate, p.days / 365) - 1 }];
    }),
  ) as FundBenchmarks;
}

/** Tóm tắt lịch sử NAV từng quỹ (do pipeline lưu mỗi ngày); rỗng nếu chưa có */
export function getFundHistory(): Record<string, FundHistory> {
  try {
    const file = JSON.parse(readFileSync(path.join(process.cwd(), "public", "data", "fund-history.json"), "utf8")) as FundHistoryFile;
    return file.funds;
  } catch {
    return {};
  }
}

/** VN-Index đang thấp hơn đỉnh 12 tháng bao nhiêu (số dương) */
function vnindexDrawdown(): number | undefined {
  const bars = getAssetDetail("vnindex")?.bars ?? [];
  const last = bars.at(-1);
  if (!last) return undefined;
  const from = new Date(Date.parse(last[0]) - 365 * 86400000).toISOString().slice(0, 10);
  const peak = Math.max(...bars.filter((b) => b[0] >= from).map((b) => b[1]));
  return 1 - last[1] / peak;
}

/** Cảnh báo của từng quỹ, khóa theo mã quỹ; chỉ gồm quỹ có ít nhất một cảnh báo */
export function getFundAlerts(funds: Fund[]): Record<string, FundAlert[]> {
  const benchmarks = getFundBenchmarks();
  const history = getFundHistory();
  const marketDrawdown = vnindexDrawdown();
  const out: Record<string, FundAlert[]> = {};
  for (const f of funds) {
    const alerts = fundAlerts(f, { benchmarks, marketDrawdown, peers: funds, history: history[f.code] });
    if (alerts.length) out[f.code] = alerts;
  }
  return out;
}
