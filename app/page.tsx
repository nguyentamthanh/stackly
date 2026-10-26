import Link from "next/link";
import { ChannelCards } from "@/components/ChannelCards";
import { BacktestNote, ComparisonTable, StrategyCards } from "@/components/StrategyBits";
import { Thermometer } from "@/components/Thermometer";
import { getLatestFunds } from "@/lib/fund-data";
import { FUND_TYPE_LABELS, rankFunds } from "@/lib/funds";
import { getBoard, SHOWCASE_IDS, strategyHighlights } from "@/lib/strategy-data";
import { getSignals } from "@/lib/data";
import { fmtPct } from "@/lib/format";
import { monthLabel } from "@/lib/ui";

export default async function Home() {
  const { updatedAt } = getSignals();
  const board = getBoard();

  if (!board.length) {
    return (
      <p className="text-muted">
        Chưa có dữ liệu. Chạy <code className="font-mono">npm run data</code> để tải giá lần đầu.
      </p>
    );
  }

  const showcase = SHOWCASE_IDS.flatMap((id) => board.find((r) => r.asset.id === id) ?? []);
  const onThermo = board.filter((r) => r.asset.investable || r.asset.id === "vnindex");
  const topFunds = rankFunds((await getLatestFunds()).funds, "y1").slice(0, 5);

  return (
    <div className="flex flex-col gap-14">
      <section className="flex flex-col gap-8">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
            Tháng {monthLabel(updatedAt)}: đầu tư kiểu nào, vào kênh nào?
          </h1>
          <p className="mt-4 text-muted text-base sm:text-lg leading-relaxed">
            Năm kiểu đầu tư chạy trên cùng dữ liệu thị trường: tích sản theo điểm, theo xu hướng, bắt đáy, danh mục cố định và giải ngân
            khoản tiền lớn. Mỗi kiểu cho tín hiệu tháng này và kết quả nếu đã làm từ trước, để bạn chọn cách hợp với mình.
          </p>
        </div>
        <StrategyCards live={strategyHighlights()} />
      </section>

      <section aria-labelledby="h-compare" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="h-compare" className="font-display text-2xl font-semibold">
            Kiểu nào hiệu quả trên kênh nào?
          </h2>
          <Link href="/kieu-dau-tu" className="text-sm text-jade hover:underline">
            Xem chi tiết các kiểu →
          </Link>
        </div>
        <ComparisonTable rows={showcase} />
        <BacktestNote />
      </section>

      <section aria-labelledby="h-channels" className="flex flex-col gap-4">
        <h2 id="h-channels" className="font-display text-2xl font-semibold">
          Theo kênh tài sản
        </h2>
        <ChannelCards />
      </section>

      {topFunds.length > 0 && (
        <section aria-labelledby="h-funds" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="h-funds" className="font-display text-2xl font-semibold">
              Quỹ mở dẫn đầu 12 tháng
            </h2>
            <Link href="/quy" className="text-sm text-jade hover:underline">
              Xem bảng xếp hạng đầy đủ →
            </Link>
          </div>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {topFunds.map((f) => (
              <li key={f.code} className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-1">
                <span className="text-xs text-muted">
                  #{f.rank} · Quỹ {FUND_TYPE_LABELS[f.type].toLowerCase()}
                </span>
                <span className="font-semibold">
                  {f.code} <span className="text-xs font-normal text-muted">{f.manager}</span>
                </span>
                <span className={`text-xl font-semibold tabular-nums ${f.value >= 0 ? "text-up" : "text-down"}`}>{fmtPct(f.value, 1, true)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="h-thermo" className="flex flex-col gap-4">
        <div className="max-w-2xl">
          <h2 id="h-thermo" className="font-display text-2xl font-semibold">
            Nhiệt kế định giá
          </h2>
          <p className="mt-1 text-sm text-muted">
            Điểm hấp dẫn 0–100 từ định giá, độ lệch xu hướng dài hạn và mức giảm từ đỉnh. Điểm càng cao, giá càng hấp dẫn để mua thêm.
          </p>
        </div>
        <Thermometer items={onThermo} />
      </section>
    </div>
  );
}
