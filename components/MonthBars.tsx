import { fmtPct } from "@/lib/format";
import { monthLabel, type MonthReturn } from "@/lib/monthly";

/** Biểu đồ cột lợi nhuận từng tháng: xanh = tăng, đỏ = giảm. Cột cuối là tháng đang diễn ra (tính đến ngày mới nhất). */
export function MonthBars({ months, className }: { months: MonthReturn[]; className?: string }) {
  const have = months.filter((m) => m.ret != null);
  if (!have.length) return null;
  const max = Math.max(...have.map((m) => Math.abs(m.ret!)), 0.005);
  const colW = 100 / months.length;
  const mid = 50;
  const summary = months.map((m) => `${monthLabel(m.month)}: ${m.ret == null ? "không có dữ liệu" : fmtPct(m.ret, 1, true)}`).join("; ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className ?? "h-16 w-full"} role="img" aria-label={`Lợi nhuận từng tháng. ${summary}`}>
      <line x1="0" x2="100" y1={mid} y2={mid} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {months.map((m, i) => {
        if (m.ret == null) return null;
        const h = (Math.abs(m.ret) / max) * (mid - 3);
        return (
          <rect
            key={m.month}
            x={i * colW + colW * 0.15}
            width={colW * 0.7}
            y={m.ret >= 0 ? mid - h : mid}
            height={Math.max(h, 0.6)}
            fill={m.ret >= 0 ? "var(--up)" : "var(--down)"}
            opacity={i === months.length - 1 ? 0.55 : 1}
          >
            <title>{`${monthLabel(m.month)}: ${fmtPct(m.ret, 1, true)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
