import type { Bar } from "../../lib/types";
import { getJson, round } from "./http";

interface DchartResponse {
  s: string;
  t: number[];
  c: number[];
}

/** Lịch sử giá ngày từ VNDirect dchart (có dữ liệu từ khoảng 2017). */
export async function fetchVndirect(symbol: string, scale = 1): Promise<Bar[]> {
  const to = Math.floor(Date.now() / 1000);
  const from = Math.floor(Date.UTC(2010, 0, 1) / 1000);
  const j = await getJson<DchartResponse>(
    `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`,
  );
  if (j.s !== "ok" || !j.t?.length) throw new Error(`dchart ${symbol}: không có dữ liệu (${j.s})`);
  return j.t.map((t, i) => [new Date(t * 1000).toISOString().slice(0, 10), round(j.c[i] * scale, 2)] as Bar);
}

interface RatioResponse {
  data: { reportDate: string; value: number }[];
}

/** Lịch sử P/E VN-Index theo ngày (từ cuối 2017). */
export async function fetchVnindexPE(): Promise<Bar[]> {
  const j = await getJson<RatioResponse>(
    "https://api-finfo.vndirect.com.vn/v4/ratios?q=code:VNINDEX~ratioCode:PRICE_TO_EARNINGS&sort=reportDate:asc&size=10000",
  );
  if (!j.data?.length) throw new Error("finfo: không có dữ liệu P/E");
  return j.data.filter((d) => d.value > 0).map((d) => [d.reportDate, round(d.value, 3)] as Bar);
}
