import { getJson } from "./http";

const IDS: Record<string, string> = { btc: "bitcoin", eth: "ethereum" };

/** Giá USD hiện tại — chỉ dùng dự phòng khi Yahoo lỗi (free API không có lịch sử dài). */
export async function fetchCoingeckoPrice(assetId: string): Promise<number> {
  const id = IDS[assetId];
  if (!id) throw new Error(`CoinGecko: không hỗ trợ ${assetId}`);
  const j = await getJson<Record<string, { usd: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
  );
  const p = j[id]?.usd;
  if (!p) throw new Error(`CoinGecko: không có giá ${id}`);
  return p;
}
