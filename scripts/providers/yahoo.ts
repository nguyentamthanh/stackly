import type { Bar } from "../../lib/types";
import { getJson, round } from "./http";

interface ChartResponse {
  chart: {
    result:
      | {
          meta: { gmtoffset: number };
          timestamp: number[];
          indicators: {
            quote: { close: (number | null)[] }[];
            adjclose?: { adjclose: (number | null)[] }[];
          };
        }[]
      | null;
    error: { description: string } | null;
  };
}

/** Lịch sử giá ngày từ Yahoo Finance; dùng giá điều chỉnh cổ tức nếu có. */
export async function fetchYahoo(symbol: string, scale = 1, range = "10y"): Promise<Bar[]> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  let j: ChartResponse;
  try {
    j = await getJson<ChartResponse>(`https://query1.finance.yahoo.com${path}`);
  } catch {
    j = await getJson<ChartResponse>(`https://query2.finance.yahoo.com${path}`);
  }
  const r = j.chart.result?.[0];
  if (!r?.timestamp?.length) throw new Error(`Yahoo ${symbol}: ${j.chart.error?.description ?? "không có dữ liệu"}`);
  const closes = r.indicators.adjclose?.[0]?.adjclose ?? r.indicators.quote[0].close;
  const out: Bar[] = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    const date = new Date((r.timestamp[i] + r.meta.gmtoffset) * 1000).toISOString().slice(0, 10);
    const bar: Bar = [date, round(c * scale, c * scale > 1000 ? 0 : 4)];
    // Phiên đang giao dịch có thể trùng ngày với phiên trước
    if (out.length && out[out.length - 1][0] === date) out[out.length - 1] = bar;
    else out.push(bar);
  }
  return out;
}
