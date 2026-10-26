import Link from "next/link";
import { Thermometer } from "@/components/Thermometer";
import { Change, ScoreBadge, ScoreBar, Sparkline, StaleNote } from "@/components/bits";
import { ASSETS, CLASS_LABELS, CLASS_ORDER } from "@/lib/assets";
import { getSignals } from "@/lib/data";
import { fmtPrice } from "@/lib/format";
import type { AssetConfig, Signal, SignalLevel } from "@/lib/types";
import { LEVEL_COLOR, monthLabel } from "@/lib/ui";

const LEVEL_ORDER: { level: SignalLevel; label: string }[] = [
  { level: "very-cheap", label: "rất rẻ" },
  { level: "cheap", label: "rẻ" },
  { level: "neutral", label: "trung tính" },
  { level: "expensive", label: "hơi đắt" },
  { level: "very-expensive", label: "rất đắt" },
];

export default function Home() {
  const { updatedAt, signals } = getSignals();
  const bySignal = new Map(signals.map((s) => [s.id, s]));
  const rows = ASSETS.flatMap((asset) => {
    const signal = bySignal.get(asset.id);
    return signal ? [{ asset, signal }] : [];
  });
  const onThermo = rows.filter((r) => r.asset.investable || r.asset.id === "vnindex");
  const counts = LEVEL_ORDER.map((l) => ({ ...l, n: onThermo.filter((r) => r.signal.level === l.level && r.asset.investable).length })).filter(
    (l) => l.n > 0,
  );

  if (!rows.length) {
    return (
      <p className="text-muted">
        Chưa có dữ liệu. Chạy <code className="font-mono">npm run data</code> để tải giá lần đầu.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-8">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
            Tháng {monthLabel(updatedAt)}: nên tích sản gì, bao nhiêu?
          </h1>
          <p className="mt-4 text-muted text-base sm:text-lg leading-relaxed">
            Mỗi tài sản được chấm điểm 0–100 dựa trên định giá, độ lệch so với xu hướng dài hạn và mức giảm từ đỉnh. Điểm càng
            cao, giá càng hấp dẫn để mua thêm. Bấm vào một tài sản để xem vì sao.
          </p>
        </div>

        <Thermometer items={onThermo} />

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between rounded-xl bg-surface border border-line p-4 sm:p-5">
          <p className="text-sm sm:text-base">
            Trong {onThermo.filter((r) => r.asset.investable).length} tài sản có thể mua:{" "}
            {counts.map((c, i) => (
              <span key={c.level}>
                <strong style={{ color: LEVEL_COLOR[c.level] }}>
                  {c.n} {c.label}
                </strong>
                {i < counts.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
          <Link
            href="/ke-hoach"
            className="shrink-0 inline-flex justify-center rounded-lg bg-jade text-on-jade font-semibold px-4 py-2.5 hover:opacity-90"
          >
            Tính số tiền nên mua tháng này
          </Link>
        </div>
      </section>

      {CLASS_ORDER.map((cls) => {
        const group = rows.filter((r) => r.asset.class === cls);
        if (!group.length) return null;
        return (
          <section key={cls} id={cls} aria-labelledby={`h-${cls}`} className="scroll-mt-20">
            <h2 id={`h-${cls}`} className="font-display text-2xl font-semibold mb-3">
              {CLASS_LABELS[cls]}
            </h2>
            <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_1.3fr_0.7fr_0.7fr_1fr_1.6fr] gap-4 px-3 pb-2 text-xs text-muted">
              <span>Tài sản</span>
              <span className="text-right">Giá</span>
              <span className="text-right">1 ngày</span>
              <span className="text-right">1 năm</span>
              <span>52 tuần</span>
              <span>Điểm hấp dẫn</span>
            </div>
            <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
              {group.map((r) => (
                <AssetRow key={r.asset.id} {...r} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function AssetRow({ asset, signal }: { asset: AssetConfig; signal: Signal }) {
  return (
    <li>
      <Link
        href={`/tai-san/${asset.id}`}
        className="grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2.2fr)_1.3fr_0.7fr_0.7fr_1fr_1.6fr] gap-x-4 gap-y-2 items-center px-3 py-3 hover:bg-paper/60 first:rounded-t-xl last:rounded-b-xl"
      >
        <span className="min-w-0">
          <span className="font-semibold">{asset.symbol}</span>{" "}
          <span className="text-muted text-sm">{asset.name}</span>{" "}
          {!asset.investable && <span className="text-xs text-muted">(chỉ số tham chiếu)</span>} <StaleNote show={signal.stale} />
        </span>
        <span className="text-right tabular-nums font-medium">
          {fmtPrice(signal.price, asset.currency, asset.unit)}
          <Change value={signal.change1d} className="md:hidden block text-xs font-normal" />
        </span>
        <Change value={signal.change1d} className="hidden md:block text-right tabular-nums text-sm" />
        <Change value={signal.change1y} className="hidden md:block text-right tabular-nums text-sm" />
        <Sparkline values={signal.spark} className="hidden md:block h-7 w-full" />
        <span className="col-span-2 md:col-span-1 flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <ScoreBadge score={signal.score} label={signal.label} />
            <span className="text-xs text-muted">×{String(signal.multiplier).replace(".", ",")}</span>
          </span>
          <ScoreBar score={signal.score} />
        </span>
      </Link>
    </li>
  );
}
