import type { Metadata } from "next";
import { Tools, type ReturnPreset } from "@/components/Tools";
import { averageRate12m, getAssetDetail, getSavings, getSignals } from "@/lib/data";
import { cagr } from "@/lib/indicators";
import { liteAssets } from "@/lib/lite";

export const metadata: Metadata = { title: "Công cụ tính toán" };

const PRESET_ASSETS: { id: string; label: string }[] = [
  { id: "vnindex", label: "VN-Index" },
  { id: "spy", label: "S&P 500" },
  { id: "vang-nhan", label: "Vàng" },
  { id: "btc", label: "Bitcoin" },
];

export default function ToolsPage() {
  const signals = getSignals();
  const savingsRate = averageRate12m(getSavings());
  const presets: ReturnPreset[] = [{ label: "Tiết kiệm", rate: savingsRate, since: "lãi suất hiện tại" }];
  for (const p of PRESET_ASSETS) {
    const bars = getAssetDetail(p.id)?.bars ?? [];
    const r = cagr(bars);
    if (r != null) presets.push({ label: p.label, rate: r, since: `từ ${bars[0][0].slice(0, 4)}` });
  }
  const backtestable = liteAssets(signals).filter((a) => a.class !== "savings");

  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Công cụ tính toán</h1>
        <p className="mt-3 text-muted leading-relaxed">
          Ước tính tài sản sau nhiều năm tích sản, số tiền cần để tự do tài chính, và thử tích sản theo điểm với bất kỳ tài sản nào.
        </p>
      </header>
      <Tools presets={presets} assets={backtestable} usdVnd={signals.usdVnd} savingsRate={savingsRate} />
    </div>
  );
}
