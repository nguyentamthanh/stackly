import { fmtNum, fmtPct } from "@/lib/format";
import { cx, scoreColor } from "@/lib/ui";

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return <span className={cx("block", className)} />;
  const w = 100;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 2) - 1}`).join(" ");
  const up = values.at(-1)! >= values[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cx("block", className)} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--up)" : "var(--down)"}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Change({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className={cx("text-muted", className)}>—</span>;
  return (
    <span className={cx(value > 0 ? "text-up" : value < 0 ? "text-down" : "text-muted", className)}>
      {fmtPct(value, value !== 0 && Math.abs(value) < 0.1 ? 2 : 1, true)}
    </span>
  );
}

/** Thanh điểm 0–100: phần tô màu dài theo điểm */
export function ScoreBar({ score, className }: { score: number; className?: string }) {
  return (
    <span className={cx("block h-1.5 rounded-full bg-line overflow-hidden", className)} aria-hidden>
      <span className="block h-full rounded-full" style={{ width: `${score}%`, background: scoreColor(score) }} />
    </span>
  );
}

export function ScoreBadge({ score, label, size = "md" }: { score: number; label: string; size?: "md" | "lg" }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={cx("font-display font-semibold tabular-nums", size === "lg" ? "text-6xl leading-none" : "text-xl")}
        style={{ color: scoreColor(score) }}
      >
        {fmtNum(score, 0)}
      </span>
      <span className={cx("font-medium", size === "lg" ? "text-lg" : "text-sm")} style={{ color: scoreColor(score) }}>
        {label}
      </span>
    </span>
  );
}

export function StaleNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-block rounded bg-t-expensive/15 text-t-expensive text-xs px-1.5 py-0.5 font-medium">
      Dữ liệu cũ
    </span>
  );
}
