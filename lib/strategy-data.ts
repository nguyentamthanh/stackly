// Chỉ dùng phía server: chạy các kiểu đầu tư trên dữ liệu đã tải, kết quả được prerender lúc build.
import { toVnd } from "./allocation";
import { ASSETS } from "./assets";
import { averageRate12m, getAssetDetail, getSavings, getSignals } from "./data";
import { fmtPct } from "./format";
import { lastMonthKeys, monthlyAnalysis, savingsAnalysis, type MonthlyRow } from "./monthly";
import {
  backtestAsset,
  backtestFixed,
  dipState,
  FIXED_PRESETS,
  lumpVsDca,
  monthlyOpens,
  prepareSeries,
  trendState,
  type AssetBacktest,
  type FixedBacktest,
  type RebalanceMode,
  type StrategyId,
  type StrategyState,
} from "./strategies";
import type { AssetClass, AssetConfig, Bar, Signal } from "./types";

/** Tiền đầu tư mỗi tháng dùng cho các bảng so sánh (chỉ ảnh hưởng quy mô, không ảnh hưởng tỷ suất) */
export const SAMPLE_MONTHLY = 5_000_000;

export interface BoardRow {
  asset: AssetConfig;
  signal: Signal;
  trend: StrategyState | null;
  dip: StrategyState | null;
  backtest: AssetBacktest | null;
}

let fx: Bar[] | null = null;
function usdVndBars(): Bar[] {
  fx ??= getAssetDetail("_usdvnd")?.bars ?? [];
  return fx;
}

/** Giá ngày quy đổi VND (tài sản USD nhân tỷ giá theo ngày) */
export function vndBars(asset: AssetConfig): Bar[] {
  const bars = getAssetDetail(asset.id)?.bars ?? [];
  return asset.currency === "USD" ? toVnd(bars, usdVndBars()) : bars;
}

export function cashRate(): number {
  return averageRate12m(getSavings());
}

let board: BoardRow[] | null = null;

/** Mọi tài sản kèm trạng thái và backtest theo từng kiểu đầu tư */
export function getBoard(): BoardRow[] {
  if (board) return board;
  const { signals } = getSignals();
  const rate = cashRate();
  board = ASSETS.flatMap((asset): BoardRow[] => {
    const signal = signals.find((s) => s.id === asset.id);
    if (!signal) return [];
    if (asset.class === "savings") return [{ asset, signal, trend: null, dip: null, backtest: null }];
    const detail = getAssetDetail(asset.id);
    if (!detail || detail.bars.length < 260) return [{ asset, signal, trend: null, dip: null, backtest: null }];
    // Trạng thái hiện tại dùng giá gốc; backtest dùng giá VND để tiền chờ hưởng lãi VND cho đúng
    const series = prepareSeries(detail.bars);
    return [
      {
        asset,
        signal,
        trend: trendState(series),
        dip: dipState(series),
        backtest: asset.investable
          ? backtestAsset({ bars: vndBars(asset), scores: detail.scoreHistory, monthly: SAMPLE_MONTHLY, cashRate: rate })
          : null,
      },
    ];
  });
  return board;
}

/** Tài sản đại diện mỗi kênh trong bảng so sánh các kiểu đầu tư */
export const SHOWCASE_IDS = ["e1vfvn30", "spy", "vang-nhan", "btc"];

/** Tài sản đại diện cho từng kênh khi ghép danh mục cố định */
export const CLASS_PROXY: Record<Exclude<AssetClass, "savings">, string> = {
  vn: "e1vfvn30",
  us: "spy",
  gold: "vang-nhan",
  crypto: "btc",
};

export function proxySeries(): Partial<Record<AssetClass, Bar[]>> {
  return Object.fromEntries(
    Object.entries(CLASS_PROXY).map(([cls, id]) => [cls, vndBars(ASSETS.find((a) => a.id === id)!)]),
  ) as Partial<Record<AssetClass, Bar[]>>;
}

export interface FixedRow {
  presetId: string;
  mode: RebalanceMode;
  result: FixedBacktest | null;
}

let fixed: FixedRow[] | null = null;

export function getFixedBacktests(): FixedRow[] {
  if (fixed) return fixed;
  const series = proxySeries();
  const rate = cashRate();
  fixed = FIXED_PRESETS.flatMap((p) =>
    (["none", "yearly", "band"] as RebalanceMode[]).map((mode) => ({
      presetId: p.id,
      mode,
      result: backtestFixed({ series, weights: p.weights, monthly: SAMPLE_MONTHLY, cashRate: rate, mode }),
    })),
  );
  return fixed;
}

export interface LumpAsset {
  id: string;
  label: string;
  /** Giá đầu tháng quy đổi VND */
  monthly: Bar[];
}

/** Chuỗi giá tháng gọn nhẹ để công cụ "một lần hay chia nhỏ" tính ngay trên trình duyệt */
export function getLumpAssets(): LumpAsset[] {
  return ASSETS.filter((a) => a.investable && a.class !== "savings").flatMap((a) => {
    const monthly = monthlyOpens(vndBars(a)).map(([d, p]): Bar => [d, Math.round(p * 100) / 100]);
    return monthly.length >= 36 ? [{ id: a.id, label: `${a.symbol} · ${a.name}`, monthly }] : [];
  });
}

/** Một dòng tóm tắt trạng thái hiện tại cho thẻ của từng kiểu đầu tư */
export function strategyHighlights(): Partial<Record<StrategyId, string>> {
  const rows = getBoard().filter((r) => r.asset.investable && r.asset.class !== "savings");
  const cheap = rows.filter((r) => r.signal.score >= 60).length;
  const trending = rows.filter((r) => r.trend?.exposure === 1).length;
  const dips = rows.filter((r) => r.dip?.stance === "buy").length;
  const bonMua = getFixedBacktests().find((f) => f.presetId === "bon-mua" && f.mode === "yearly")?.result;
  const vn30 = getLumpAssets().find((a) => a.id === "e1vfvn30");
  const lump = vn30 ? lumpVsDca({ monthly: vn30.monthly, spread: 12, horizon: 36, cashRate: cashRate() }) : null;
  return {
    "tich-san": `${cheap}/${rows.length} tài sản đang rẻ hoặc rất rẻ`,
    "xu-huong": `${trending}/${rows.length} tài sản trong xu hướng tăng`,
    "bat-day": `${dips}/${rows.length} tài sản ở vùng giải ngân`,
    "co-dinh": bonMua?.stats.irr != null ? `Bốn mùa: ${fmtPct(bonMua.stats.irr)}/năm, sụt tối đa ${fmtPct(bonMua.stats.maxDrawdown, 0)}` : undefined,
    "mot-lan": lump ? `E1VFVN30: bỏ một lần thắng ${fmtPct(lump.lumpWinRate, 0)} số lần so với chia 12 tháng` : undefined,
  };
}

/** Phân tích 12 tháng gần nhất theo từng tháng cho các kênh chính + tiết kiệm */
export function getYearReview(): MonthlyRow[] {
  const latest = getAssetDetail("vnindex")?.bars.at(-1)?.[0];
  if (!latest) return [];
  const keys = lastMonthKeys(latest, 12);
  const spec: [string, string][] = [
    ["vnindex", "VN-Index"],
    ["spy", "S&P 500 (quy VND)"],
    ["vang-nhan", "Vàng (thế giới, quy VND)"],
    ["btc", "Bitcoin (quy VND)"],
  ];
  const rows = spec.flatMap(([id, label]) => {
    const asset = ASSETS.find((a) => a.id === id);
    return asset ? [monthlyAnalysis(id, label, vndBars(asset), keys)] : [];
  });
  return [...rows, savingsAnalysis("tiet-kiem", "Tiết kiệm", cashRate(), keys)];
}
