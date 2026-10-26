import type { Metadata } from "next";
import { PlanWizard } from "@/components/PlanWizard";
import { getAllocation, getSignals } from "@/lib/data";
import { liteAssets } from "@/lib/lite";
import { monthLabel } from "@/lib/ui";

export const metadata: Metadata = { title: "Kế hoạch tích sản tháng này" };

export default function PlanPage() {
  const signals = getSignals();
  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Kế hoạch tích sản tháng {monthLabel(signals.updatedAt)}</h1>
        <p className="mt-3 text-muted leading-relaxed">
          Chọn khẩu vị rủi ro và số tiền để dành mỗi tháng. App chia tiền theo tỷ trọng mục tiêu, rồi tăng hoặc giảm từng phần theo
          điểm hấp dẫn hiện tại. Phần chưa mua dồn vào tiết kiệm để chờ cơ hội.
        </p>
      </header>
      <PlanWizard assets={liteAssets(signals)} usdVnd={signals.usdVnd} alloc={getAllocation()} />
    </div>
  );
}
