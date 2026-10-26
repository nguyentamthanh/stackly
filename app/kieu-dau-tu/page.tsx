import type { Metadata } from "next";
import { BacktestNote, ComparisonTable, StrategyCards } from "@/components/StrategyBits";
import { getBoard, SHOWCASE_IDS, strategyHighlights } from "@/lib/strategy-data";

export const metadata: Metadata = { title: "Các kiểu đầu tư" };

export default function StrategiesPage() {
  const board = getBoard();
  const showcase = SHOWCASE_IDS.flatMap((id) => board.find((r) => r.asset.id === id) ?? []);
  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Các kiểu đầu tư</h1>
        <p className="mt-3 text-muted leading-relaxed">
          Không có kiểu nào tốt nhất cho mọi người. Mỗi kiểu đánh đổi giữa lợi nhuận, mức sụt giảm phải chịu và công theo dõi. Chọn kiểu
          hợp với bạn, hoặc kết hợp: ví dụ danh mục cố định làm nền, tích sản theo điểm cho phần cổ phiếu.
        </p>
      </header>
      <StrategyCards live={strategyHighlights()} />
      <section aria-labelledby="h-compare" className="flex flex-col gap-3">
        <h2 id="h-compare" className="font-display text-2xl font-semibold">
          So sánh trên tài sản tiêu biểu
        </h2>
        <ComparisonTable rows={showcase} />
        <BacktestNote />
      </section>
    </div>
  );
}
