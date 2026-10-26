import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Change, ScoreBadge, StaleNote } from "@/components/bits";
import { BacktestNote, COMPARE_ROWS, ComparisonTable, StanceBadge } from "@/components/StrategyBits";
import { CLASS_DESCRIPTIONS, CLASS_LABELS, CLASS_ORDER } from "@/lib/assets";
import { fmtPrice } from "@/lib/format";
import { getBoard, type BoardRow } from "@/lib/strategy-data";
import type { AssetClass } from "@/lib/types";

export function generateStaticParams() {
  return CLASS_ORDER.map((cls) => ({ cls }));
}

function toClass(cls: string): AssetClass | null {
  return (CLASS_ORDER as string[]).includes(cls) ? (cls as AssetClass) : null;
}

export async function generateMetadata({ params }: PageProps<"/kenh/[cls]">): Promise<Metadata> {
  const cls = toClass((await params).cls);
  return { title: cls ? CLASS_LABELS[cls] : "Không tìm thấy" };
}

export default function ChannelPage({ params }: PageProps<"/kenh/[cls]">) {
  return (
    <Suspense fallback={<div className="h-48 rounded-xl bg-line/60 animate-pulse" aria-busy="true" aria-label="Đang tải" />}>
      <ChannelContent params={params} />
    </Suspense>
  );
}

const ROW_GRID = "md:grid-cols-[minmax(0,1.6fr)_1fr_0.6fr_1.2fr_1.1fr_1.1fr]";

async function ChannelContent({ params }: { params: PageProps<"/kenh/[cls]">["params"] }) {
  const cls = toClass((await params).cls);
  if (!cls) notFound();
  const rows = getBoard().filter((r) => r.asset.class === cls);
  const tested = rows.filter((r) => r.backtest);

  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-2xl">
        <Link href="/kenh" className="text-sm text-muted hover:text-ink">
          ← Các kênh
        </Link>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold tracking-tight">{CLASS_LABELS[cls]}</h1>
        <p className="mt-3 text-muted leading-relaxed">{CLASS_DESCRIPTIONS[cls]}</p>
      </header>

      {cls === "savings" ? (
        <p>
          Tiết kiệm là nơi giữ tiền chờ cho mọi kiểu đầu tư.{" "}
          <Link href="/tai-san/tiet-kiem" className="underline underline-offset-2 text-jade">
            Xem lãi suất các ngân hàng
          </Link>
          .
        </p>
      ) : (
        <>
          <section aria-labelledby="h-now" className="flex flex-col gap-3">
            <h2 id="h-now" className="font-display text-2xl font-semibold">
              Mỗi kiểu đầu tư nói gì lúc này
            </h2>
            <div className={`hidden md:grid ${ROW_GRID} gap-4 px-3 pb-1 text-xs text-muted`}>
              <span>Tài sản</span>
              <span className="text-right">Giá</span>
              <span className="text-right">1 năm</span>
              {COMPARE_ROWS.slice(1).map((k) => (
                <Link key={k.key} href={`/kieu-dau-tu/${k.key}`} className="hover:text-ink">
                  {k.label}
                </Link>
              ))}
            </div>
            <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
              {rows.map((r) => (
                <Row key={r.asset.id} row={r} />
              ))}
            </ul>
          </section>

          {tested.length > 0 && (
            <section aria-labelledby="h-best" className="flex flex-col gap-3">
              <h2 id="h-best" className="font-display text-2xl font-semibold">
                Kiểu nào từng hiệu quả nhất?
              </h2>
              <ComparisonTable rows={tested} />
              <BacktestNote />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Row({ row: r }: { row: BoardRow }) {
  return (
    <li>
      <Link
        href={`/tai-san/${r.asset.id}`}
        className={`grid grid-cols-[1fr_auto] ${ROW_GRID} gap-x-4 gap-y-2 items-center px-3 py-3 hover:bg-paper/60 first:rounded-t-xl last:rounded-b-xl`}
      >
        <span className="min-w-0">
          <span className="font-semibold">{r.asset.symbol}</span> <span className="text-muted text-sm">{r.asset.name}</span>{" "}
          {!r.asset.investable && <span className="text-xs text-muted">(chỉ số)</span>} <StaleNote show={r.signal.stale} />
        </span>
        <span className="text-right tabular-nums text-sm">{fmtPrice(r.signal.price, r.asset.currency, r.asset.unit)}</span>
        <Change value={r.signal.change1y} className="hidden md:block text-right tabular-nums text-sm" />
        <span className="col-span-2 md:col-span-1 grid grid-cols-3 md:contents gap-2">
          <span>
            <span className="md:hidden block text-xs text-muted">Tích sản</span>
            <ScoreBadge score={r.signal.score} label={r.signal.label} />
          </span>
          <span>
            <span className="md:hidden block text-xs text-muted">Xu hướng</span>
            <StanceBadge state={r.trend} />
          </span>
          <span>
            <span className="md:hidden block text-xs text-muted">Bắt đáy</span>
            <StanceBadge state={r.dip} />
          </span>
        </span>
      </Link>
    </li>
  );
}
