import type { Metadata } from "next";
import { GoalPlanner } from "@/components/GoalPlanner";
import { YearReview } from "@/components/YearReview";
import { countByLevel } from "@/lib/fund-alerts";
import { getFundAlerts, getLatestFunds } from "@/lib/fund-data";
import { averageRate12m, getAllocation, getAssetDetail, getSavings, getSignals } from "@/lib/data";
import { liteAssets } from "@/lib/lite";
import { getYearReview } from "@/lib/strategy-data";

export const metadata: Metadata = { title: "Mục tiêu 1 năm" };

export default async function GoalPage() {
  const signals = getSignals();
  const counts = countByLevel(getFundAlerts((await getLatestFunds()).funds));
  const asOf = getAssetDetail("vnindex")?.bars.at(-1)?.[0] ?? signals.updatedAt.slice(0, 10);
  return (
    <div className="flex flex-col gap-12">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Mục tiêu 1 năm</h1>
        <p className="mt-3 text-muted leading-relaxed">
          Đặt số tiền muốn có sau 12 tháng. App tính lợi suất cần có, xác suất đạt theo khẩu vị rủi ro, kế hoạch từng tháng và cảnh báo khi mục tiêu quá tầm hoặc bạn đang chậm tiến độ.
        </p>
      </header>

      <GoalPlanner
        alloc={getAllocation()}
        assets={liteAssets(signals)}
        usdVnd={signals.usdVnd}
        savingsRate={averageRate12m(getSavings())}
        fundCounts={{ high: counts.high, medium: counts.medium }}
      />

      <section aria-labelledby="h-year" className="flex flex-col gap-3">
        <div>
          <h2 id="h-year" className="font-display text-2xl font-semibold">
            Năm qua của các kênh, từng tháng
          </h2>
          <p className="text-sm text-muted mt-1 max-w-prose">Dùng để đặt mục tiêu thực tế: kênh nào thật sự mang lại bao nhiêu, và những tháng nào thị trường cùng xấu.</p>
        </div>
        <YearReview rows={getYearReview()} asOf={asOf} />
      </section>
    </div>
  );
}
