import type { Metadata } from "next";
import { Portfolio } from "@/components/Portfolio";
import { averageRate12m, getAllocation, getSavings, getSignals } from "@/lib/data";
import { liteAssets } from "@/lib/lite";

export const metadata: Metadata = { title: "Danh mục của tôi" };

export default function PortfolioPage() {
  const signals = getSignals();
  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Danh mục của tôi</h1>
        <p className="mt-3 text-muted leading-relaxed">
          Ghi lại các lần mua bán để xem lãi lỗ, tỷ suất sinh lời theo năm và độ lệch so với tỷ trọng mục tiêu. Dữ liệu lưu trên
          trình duyệt này; bật đồng bộ hoặc tải file sao lưu để không bị mất.
        </p>
      </header>
      <Portfolio assets={liteAssets(signals)} usdVnd={signals.usdVnd} defaultSavingsRate={averageRate12m(getSavings())} alloc={getAllocation()} />
    </div>
  );
}
