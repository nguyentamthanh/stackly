import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClassTabs } from "@/components/ClassTabs";
import { ScoreBadge, StaleNote } from "@/components/bits";
import { BacktestNote, PerfCell, StanceBadge, statsFor, StrategyHeader } from "@/components/StrategyBits";
import { Thermometer } from "@/components/Thermometer";
import { CLASS_LABELS, CLASS_ORDER } from "@/lib/assets";
import { fmtPrice } from "@/lib/format";
import { ASSET_STRATEGIES, getStrategy, type AssetStrategyId } from "@/lib/strategies";
import { getBoard, type BoardRow } from "@/lib/strategy-data";

export function generateStaticParams() {
  return ASSET_STRATEGIES.map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/kieu-dau-tu/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getStrategy(id)?.name ?? "Không tìm thấy" };
}

export default function StrategyPage({ params }: PageProps<"/kieu-dau-tu/[id]">) {
  return (
    <Suspense fallback={<div className="h-48 rounded-xl bg-line/60 animate-pulse" aria-busy="true" aria-label="Đang tải" />}>
      <StrategyContent params={params} />
    </Suspense>
  );
}

async function StrategyContent({ params }: { params: PageProps<"/kieu-dau-tu/[id]">["params"] }) {
  const { id } = await params;
  const info = getStrategy(id);
  if (!info || !ASSET_STRATEGIES.includes(id as AssetStrategyId)) notFound();
  const sid = id as AssetStrategyId;
  const rows = getBoard().filter((r) => r.asset.class !== "savings");

  const groups = CLASS_ORDER.flatMap((cls) => {
    const list = rows.filter((r) => r.asset.class === cls);
    return list.length ? [{ key: cls, label: CLASS_LABELS[cls], content: <SignalTable rows={list} sid={sid} /> }] : [];
  });

  return (
    <div className="flex flex-col gap-10">
      <StrategyHeader info={info} />

      {sid === "tich-san" && (
        <section aria-labelledby="h-thermo" className="flex flex-col gap-4">
          <h2 id="h-thermo" className="font-display text-2xl font-semibold">
            Nhiệt kế tích sản
          </h2>
          <Thermometer items={rows.filter((r) => r.asset.investable || r.asset.id === "vnindex")} />
          <Link href="/ke-hoach" className="w-fit rounded-lg bg-jade text-on-jade font-semibold px-4 py-2.5 hover:opacity-90">
            Tính số tiền nên mua tháng này
          </Link>
        </section>
      )}

      <section aria-labelledby="h-signals" className="flex flex-col gap-4">
        <div>
          <h2 id="h-signals" className="font-display text-2xl font-semibold">
            Tín hiệu tháng này
          </h2>
          <p className="text-sm text-muted mt-1 max-w-prose">
            Cột bên phải so sánh kiểu này với mua đều mỗi tháng trên cùng tài sản và cùng số tiền.
          </p>
        </div>
        <ClassTabs groups={groups} />
        <BacktestNote />
      </section>
    </div>
  );
}

const ROW_GRID = "md:grid-cols-[minmax(0,1.6fr)_1fr_minmax(0,2fr)_1.1fr_1.1fr]";

function SignalTable({ rows, sid }: { rows: BoardRow[]; sid: AssetStrategyId }) {
  return (
    <div>
      <div className={`hidden md:grid ${ROW_GRID} gap-4 px-3 pb-2 text-xs text-muted`}>
        <span>Tài sản</span>
        <span className="text-right">Giá</span>
        <span>Tín hiệu</span>
        <span className="text-right">Kiểu này</span>
        <span className="text-right">Mua đều</span>
      </div>
    <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
      {rows.map((r) => (
        <li key={r.asset.id}>
          <Link
            href={`/tai-san/${r.asset.id}`}
            className={`grid grid-cols-[1fr_auto] ${ROW_GRID} gap-x-4 gap-y-2 items-center px-3 py-3 hover:bg-paper/60 first:rounded-t-xl last:rounded-b-xl`}
          >
            <span className="min-w-0">
              <span className="font-semibold">{r.asset.symbol}</span> <span className="text-muted text-sm">{r.asset.name}</span>{" "}
              {!r.asset.investable && <span className="text-xs text-muted">(chỉ số)</span>} <StaleNote show={r.signal.stale} />
            </span>
            <span className="text-right tabular-nums text-sm">{fmtPrice(r.signal.price, r.asset.currency, r.asset.unit)}</span>
            <span className="col-span-2 md:col-span-1">
              {sid === "tich-san" ? (
                <span className="flex flex-col gap-0.5">
                  <ScoreBadge score={r.signal.score} label={r.signal.label} />
                  <span className="text-xs text-muted">{r.signal.action}</span>
                </span>
              ) : (
                <StanceBadge state={sid === "xu-huong" ? r.trend : r.dip} showDetail />
              )}
            </span>
            <span className="text-right text-sm">
              <span className="md:hidden text-xs text-muted block">Kiểu này</span>
              <PerfCell stats={statsFor(r, sid)} best={(statsFor(r, sid)?.irr ?? -1) > (statsFor(r, "plain")?.irr ?? Infinity)} />
            </span>
            <span className="text-right text-sm text-muted">
              <span className="md:hidden text-xs block">Mua đều</span>
              <PerfCell stats={statsFor(r, "plain")} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
    </div>
  );
}
