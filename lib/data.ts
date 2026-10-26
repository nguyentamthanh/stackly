// Chỉ dùng phía server: đọc JSON do scripts/fetch-data.ts sinh ra.
// readFileSync được Next.js coi là dữ liệu cố định nên trang được prerender lúc build;
// dữ liệu mới đến qua mỗi lần GitHub Actions commit và Vercel deploy lại.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AllocationFile } from "./allocation";
import type { AssetDetail, GoldQuote, MarketMeta, SavingsData, SignalsFile } from "./types";

const PUBLIC_DATA = path.join(process.cwd(), "public", "data");

function read<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function getSignals(): SignalsFile {
  return read<SignalsFile>(path.join(PUBLIC_DATA, "signals.json")) ?? { updatedAt: new Date(0).toISOString(), usdVnd: 25000, signals: [] };
}

export function getAssetDetail(id: string): AssetDetail | null {
  return read<AssetDetail>(path.join(PUBLIC_DATA, "assets", `${id}.json`));
}

export function getMeta(): MarketMeta | null {
  return read<MarketMeta>(path.join(PUBLIC_DATA, "meta.json"));
}

export function getGoldHistory(): GoldQuote[] {
  return read<GoldQuote[]>(path.join(PUBLIC_DATA, "gold-history.json")) ?? [];
}

export function getSavings(): SavingsData & { note?: string } {
  return read<SavingsData & { note?: string }>(path.join(process.cwd(), "data", "savings-rates.json"))!;
}

export function averageRate12m(s: SavingsData): number {
  return s.rates.reduce((a, r) => a + r.m12, 0) / s.rates.length;
}

export function getAllocation(): AllocationFile | null {
  return read<AllocationFile>(path.join(PUBLIC_DATA, "allocation.json"));
}
