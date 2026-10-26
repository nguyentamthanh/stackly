import type { NextRequest } from "next/server";
import { getLatestFunds } from "@/lib/fund-data";
import { FUND_PERIODS, rankFunds, type FundPeriod, type FundType } from "@/lib/funds";

/**
 * Bảng xếp hạng quỹ mở mới nhất (nguồn Fmarket, cache 1 giờ).
 *   GET /api/quy                      → toàn bộ danh sách
 *   GET /api/quy?ky=y1&loai=STOCK     → xếp hạng theo kỳ và loại (STOCK, BOND, BALANCED)
 *     ky: m1, m3, m6, ytd, y1, y3, y5, y7, y10; cagr = bình quân năm từ khi thành lập; since = tổng từ khi thành lập
 */
export async function GET(req: NextRequest) {
  const data = await getLatestFunds();
  const ky = req.nextUrl.searchParams.get("ky");
  const loai = req.nextUrl.searchParams.get("loai");
  const headers = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" };
  if (!ky) return Response.json(data, { headers });

  if (!FUND_PERIODS.some((p) => p.key === ky)) {
    return Response.json({ error: `Kỳ không hợp lệ. Dùng ${FUND_PERIODS.map((p) => p.key).join(", ")}.` }, { status: 400 });
  }
  if (loai && !["STOCK", "BOND", "BALANCED"].includes(loai)) {
    return Response.json({ error: "Loại không hợp lệ. Dùng STOCK, BOND hoặc BALANCED." }, { status: 400 });
  }
  const funds = rankFunds(data.funds, ky as FundPeriod, (loai as FundType | null) ?? "all");
  return Response.json({ ...data, funds }, { headers });
}
