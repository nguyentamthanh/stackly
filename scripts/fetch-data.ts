/**
 * Pipeline dữ liệu: lấy giá từ các nguồn miễn phí → tính điểm hấp dẫn → ghi JSON tĩnh vào public/data.
 * Chạy: npm run data   (GitHub Actions chạy tự động mỗi ngày)
 *
 * Nguyên tắc: nguồn chính lỗi thì thử nguồn dự phòng; mọi nguồn đều lỗi thì giữ dữ liệu cũ và đánh dấu stale.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { computeAllocation, toVnd } from "../lib/allocation";
import { ASSETS } from "../lib/assets";
import { computeSignal, scoreHistory, type SignalKind } from "../lib/signals";
import type { AssetConfig, AssetDetail, Bar, GoldQuote, MarketMeta, SavingsData, Signal, SignalsFile } from "../lib/types";
import { fetchCoingeckoPrice } from "./providers/coingecko";
import { fetchDomesticGold, OZ_PER_LUONG } from "./providers/gold";
import { round } from "./providers/http";
import { fetchVndirect, fetchVnindexPE } from "./providers/vndirect";
import { fetchYahoo } from "./providers/yahoo";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "data");
const errors: string[] = [];

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data));
}

const detailPath = (id: string) => path.join(OUT, "assets", `${id}.json`);

function log(msg: string) {
  console.log(msg);
}

function warn(msg: string) {
  console.warn("⚠ " + msg);
  errors.push(msg);
}

async function fetchSeries(asset: AssetConfig): Promise<{ bars: Bar[]; source: string; stale: boolean }> {
  for (const src of asset.sources) {
    try {
      const bars =
        src.provider === "vndirect" ? await fetchVndirect(src.symbol, src.scale) : await fetchYahoo(src.symbol, src.scale);
      if (bars.length < 30) throw new Error(`chỉ có ${bars.length} phiên`);
      return { bars, source: `${src.provider}:${src.symbol}`, stale: false };
    } catch (err) {
      warn(`${asset.id} – ${src.provider}: ${(err as Error).message}`);
    }
  }
  const old = await readJson<AssetDetail>(detailPath(asset.id));
  if (!old?.bars.length) throw new Error(`${asset.id}: mọi nguồn đều lỗi và không có dữ liệu cũ`);

  // Crypto: nối giá hiện tại từ CoinGecko vào chuỗi cũ
  if (asset.class === "crypto") {
    try {
      const price = await fetchCoingeckoPrice(asset.id);
      const today = new Date().toISOString().slice(0, 10);
      const bars = old.bars.filter((b) => b[0] !== today);
      bars.push([today, price]);
      return { bars, source: "coingecko (nối vào lịch sử cũ)", stale: false };
    } catch (err) {
      warn(`${asset.id} – coingecko: ${(err as Error).message}`);
    }
  }
  return { bars: old.bars, source: old.source, stale: true };
}

/** Ghép hai chuỗi theo ngày, giá trị b lấy theo phiên gần nhất trước đó (forward-fill). */
function combineSeries(a: Bar[], b: Bar[], fn: (x: number, y: number) => number): Bar[] {
  const out: Bar[] = [];
  let j = 0;
  let last: number | null = null;
  for (const [date, x] of a) {
    while (j < b.length && b[j][0] <= date) last = b[j++][1];
    if (last != null) out.push([date, fn(x, last)]);
  }
  return out;
}

async function main() {
  const started = Date.now();
  const updatedAt = new Date().toISOString();
  const today = updatedAt.slice(0, 10);

  // --- Dữ liệu dùng chung ---
  let pe: Bar[] = [];
  const pePath = path.join(OUT, "pe-vnindex.json");
  try {
    pe = await fetchVnindexPE();
    await writeJson(pePath, pe);
    log(`P/E VN-Index: ${pe.length} phiên, hiện tại ${pe.at(-1)?.[1]}`);
  } catch (err) {
    warn(`P/E: ${(err as Error).message}`);
    pe = (await readJson<Bar[]>(pePath)) ?? [];
  }

  const fx = await fetchSeries({ ...ASSETS[0], id: "_usdvnd", class: "us", sources: [{ provider: "yahoo", symbol: "VND=X" }] });
  const usdVnd = fx.bars.at(-1)![1];
  log(`USD/VND: ${usdVnd}`);

  const goldUsd = await fetchSeries({ ...ASSETS[0], id: "_gold", class: "us", sources: [{ provider: "yahoo", symbol: "GC=F" }] });
  const worldGoldVnd = combineSeries(goldUsd.bars, fx.bars, (g, v) => Math.round(g * v * OZ_PER_LUONG));
  await writeJson(detailPath("_usdvnd"), { id: "_usdvnd", bars: fx.bars, scoreHistory: [], source: fx.source, stale: fx.stale });
  await writeJson(detailPath("_gold"), { id: "_gold", bars: goldUsd.bars, scoreHistory: [], source: goldUsd.source, stale: goldUsd.stale });

  // Lịch sử vàng trong nước: tích lũy mỗi lần chạy
  const goldHistPath = path.join(OUT, "gold-history.json");
  const goldHist = (await readJson<GoldQuote[]>(goldHistPath)) ?? [];
  let goldStale = false;
  try {
    const g = await fetchDomesticGold();
    const quote: GoldQuote = { date: today, ...g, worldVnd: worldGoldVnd.at(-1)![1] };
    delete (quote as Partial<typeof g>).source;
    const idx = goldHist.findIndex((q) => q.date === today);
    if (idx >= 0) goldHist[idx] = quote;
    else goldHist.push(quote);
    goldHist.sort((a, b) => a.date.localeCompare(b.date));
    await writeJson(goldHistPath, goldHist);
    log(`Vàng SJC bán: ${g.sjcSell.toLocaleString("vi-VN")} ; nhẫn: ${g.ringSell.toLocaleString("vi-VN")} ; thế giới quy đổi: ${quote.worldVnd.toLocaleString("vi-VN")}`);
  } catch (err) {
    warn(`Vàng trong nước: ${(err as Error).message}`);
    goldStale = true;
  }

  const savings = JSON.parse(await readFile(path.join(ROOT, "data", "savings-rates.json"), "utf8")) as SavingsData;
  const avg12 = savings.rates.reduce((a, r) => a + r.m12, 0) / savings.rates.length;

  // --- Từng tài sản ---
  const signals: Signal[] = [];
  for (const asset of ASSETS) {
    try {
      let signal: Signal;
      if (asset.class === "savings") {
        signal = computeSignal({
          id: asset.id,
          kind: "savings",
          bars: [],
          realRate: avg12 - savings.inflation,
          price: avg12,
          asOf: savings.updatedAt,
        });
      } else if (asset.class === "gold") {
        const sell = asset.id === "vang-sjc" ? "sjcSell" : "ringSell";
        const domestic: Bar[] = goldHist.map((q) => [q.date, q[sell]]);
        const premium: Bar[] = goldHist.map((q) => [q.date, round(q[sell] / q.worldVnd - 1, 4)]);
        const input = {
          id: asset.id,
          kind: "gold" as const,
          bars: worldGoldVnd,
          priceBars: domestic,
          premium,
          stale: goldStale || goldUsd.stale,
        };
        signal = computeSignal(input);
        await writeJson(detailPath(asset.id), {
          id: asset.id,
          bars: worldGoldVnd,
          domestic,
          scoreHistory: scoreHistory(input),
          source: `${goldUsd.source} × ${fx.source} ; PNJ`,
          stale: input.stale,
        } satisfies AssetDetail);
      } else {
        const { bars, source, stale } = await fetchSeries(asset);
        const kind: SignalKind = asset.class === "crypto" ? "crypto" : "equity";
        const input = { id: asset.id, kind, bars, pe: asset.usesMarketPE ? pe : undefined, stale };
        signal = computeSignal(input);
        await writeJson(detailPath(asset.id), {
          id: asset.id,
          bars,
          scoreHistory: scoreHistory(input),
          source,
          stale,
        } satisfies AssetDetail);
      }
      signals.push(signal);
      log(`${asset.symbol.padEnd(9)} điểm ${String(signal.score).padStart(5)}  ${signal.label.padEnd(10)} giá ${signal.price}${signal.stale ? "  (dữ liệu cũ)" : ""}`);
    } catch (err) {
      warn((err as Error).message);
    }
  }

  // --- Phân bổ tối ưu theo đường biên hiệu quả ---
  try {
    const bars = async (id: string) => (await readJson<AssetDetail>(detailPath(id)))?.bars ?? [];
    const started = Date.now();
    const allocation = computeAllocation({
      series: {
        vn: await bars("vnindex"),
        us: toVnd(await bars("spy"), fx.bars),
        gold: worldGoldVnd,
        crypto: toVnd(await bars("btc"), fx.bars),
      },
      savingsRate: avg12,
      updatedAt,
    });
    await writeJson(path.join(OUT, "allocation.json"), allocation);
    const fmt = (w: Record<string, number>) =>
      Object.entries(w)
        .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
        .join(", ");
    log(`\nPhân bổ tối ưu (${allocation.window.months} tháng, ${((Date.now() - started) / 1000).toFixed(1)}s):`);
    for (const [id, p] of Object.entries(allocation.optimized)) {
      log(`  ${id.padEnd(12)} kỳ vọng ${(p.ret * 100).toFixed(1)}%/năm, biến động ${(p.vol * 100).toFixed(1)}% → ${fmt(p.weights)}`);
    }
  } catch (err) {
    warn(`Phân bổ tối ưu: ${(err as Error).message}`);
  }

  await writeJson(path.join(OUT, "signals.json"), { updatedAt, usdVnd, signals } satisfies SignalsFile);
  await writeJson(path.join(OUT, "meta.json"), {
    updatedAt,
    usdVnd,
    vnindexPE: pe.at(-1)?.[1] ?? null,
    errors,
  } satisfies MarketMeta);

  log(`\nXong ${signals.length}/${ASSETS.length} tài sản trong ${((Date.now() - started) / 1000).toFixed(1)}s, ${errors.length} cảnh báo.`);
  if (signals.length === 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
