import Link from "next/link";
import { fmtPct } from "@/lib/format";
import { STRATEGIES, type AssetStrategyId, type PerfStats, type StrategyId, type StrategyInfo, type StrategyState } from "@/lib/strategies";
import type { BoardRow } from "@/lib/strategy-data";
import { cx, STANCE_COLOR } from "@/lib/ui";

export function StanceBadge({ state, showDetail = false }: { state: StrategyState | null; showDetail?: boolean }) {
  if (!state) return <span className="text-muted text-sm">—</span>;
  const color = STANCE_COLOR[state.stance];
  return (
    <span className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color }}>
        <span className="inline-block size-2 rounded-full" style={{ background: color }} aria-hidden />
        {state.label}
      </span>
      {showDetail && <span className="text-xs text-muted">{state.detail}</span>}
    </span>
  );
}

export function RiskDots({ risk }: { risk: 1 | 2 | 3 }) {
  const label = ["", "Rủi ro thấp", "Rủi ro vừa", "Rủi ro cao"][risk];
  return (
    <span className="inline-flex items-center gap-1" title={label} aria-label={label}>
      {[1, 2, 3].map((k) => (
        <span key={k} className={cx("inline-block size-2 rounded-full", k <= risk ? "bg-ink" : "bg-line")} aria-hidden />
      ))}
    </span>
  );
}

/** Lợi suất năm (XIRR) và mức sụt giảm lớn nhất */
export function PerfCell({ stats, best = false }: { stats: PerfStats | undefined; best?: boolean }) {
  if (!stats) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className={cx("tabular-nums", best ? "font-semibold text-jade" : "font-medium")}>{fmtPct(stats.irr)}/năm</span>
      <span className="text-xs text-down tabular-nums">sụt {fmtPct(stats.maxDrawdown, 0)}</span>
    </span>
  );
}

export type CompareKey = "plain" | AssetStrategyId;

export const COMPARE_ROWS: { key: CompareKey; label: string }[] = [
  { key: "plain", label: "Mua đều mỗi tháng" },
  { key: "tich-san", label: "Tích sản theo điểm" },
  { key: "xu-huong", label: "Theo xu hướng" },
  { key: "bat-day", label: "Bắt đáy" },
];

export function statsFor(row: BoardRow, key: CompareKey): PerfStats | undefined {
  const bt = row.backtest;
  if (!bt) return undefined;
  return key === "plain" ? bt.plain.stats : bt.results[key].stats;
}

/** Bảng: hàng = kiểu đầu tư, cột = tài sản. Tô đậm kiểu có lợi suất cao nhất ở mỗi cột. */
export function ComparisonTable({ rows }: { rows: BoardRow[] }) {
  const cols = rows.filter((r) => r.backtest);
  const irr = (r: BoardRow, key: CompareKey) => statsFor(r, key)?.irr ?? -Infinity;
  const best = new Map(
    cols.map((r) => [r.asset.id, COMPARE_ROWS.reduce<CompareKey>((top, k) => (irr(r, k.key) > irr(r, top) ? k.key : top), "plain")]),
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-muted text-left">
            <th className="font-normal px-4 py-3">Kiểu đầu tư</th>
            {cols.map((r) => (
              <th key={r.asset.id} className="font-normal px-4 py-3 text-right">
                <Link href={`/tai-san/${r.asset.id}`} className="font-semibold text-ink hover:underline">
                  {r.asset.symbol}
                </Link>
                <span className="block text-xs">từ {r.backtest!.start.slice(0, 4)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {COMPARE_ROWS.map((k) => (
            <tr key={k.key}>
              <td className="px-4 py-3 font-medium">
                {k.key === "plain" ? (
                  <span className="text-muted">{k.label}</span>
                ) : (
                  <Link href={`/kieu-dau-tu/${k.key}`} className="hover:underline">
                    {k.label}
                  </Link>
                )}
              </td>
              {cols.map((r) => (
                <td key={r.asset.id} className="px-4 py-3 text-right">
                  <PerfCell stats={statsFor(r, k.key)} best={best.get(r.asset.id) === k.key} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StrategyCards({ live }: { live: Partial<Record<StrategyId, string>> }) {
  return (
    <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {STRATEGIES.map((s) => (
        <li key={s.id}>
          <Link
            href={`/kieu-dau-tu/${s.id}`}
            className="h-full flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 sm:p-5 hover:border-jade transition-colors"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-display text-lg font-semibold">{s.name}</span>
              <RiskDots risk={s.risk} />
            </span>
            <span className="text-sm text-muted">{s.tagline}</span>
            {live[s.id] && <span className="mt-auto pt-2 text-sm font-medium text-jade">{live[s.id]}</span>}
            <span className="text-xs text-muted">Công theo dõi: {s.effort}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BacktestNote({ start }: { start?: string }) {
  return (
    <p className="text-xs text-muted max-w-prose">
      Mô phỏng góp cùng một số tiền vào đầu mỗi tháng{start ? ` từ ${start.slice(0, 7).split("-").reverse().join("/")}` : ""}, giá quy đổi
      VND, tiền chờ hưởng lãi tiết kiệm hiện tại, chưa tính phí giao dịch và thuế. Lợi suất/năm là XIRR theo dòng tiền; “sụt” là mức
      giảm lớn nhất từ đỉnh của danh mục. Quá khứ không bảo đảm tương lai.
    </p>
  );
}

export function StrategyHeader({ info }: { info: StrategyInfo }) {
  return (
    <header className="grid lg:grid-cols-[1fr_320px] gap-6 lg:gap-10">
      <div className="max-w-2xl">
        <Link href="/kieu-dau-tu" className="text-sm text-muted hover:text-ink">
          ← Các kiểu đầu tư
        </Link>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold tracking-tight">{info.name}</h1>
        <p className="mt-2 text-lg">{info.tagline}</p>
        <p className="mt-3 text-muted leading-relaxed">{info.description}</p>
      </div>
      <aside className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-3 self-start">
        <h2 className="text-sm text-muted">Quy tắc</h2>
        <ul className="flex flex-col gap-2 text-sm list-disc pl-4">
          {info.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm border-t border-line pt-3">
          <dt className="text-muted">Rủi ro</dt>
          <dd>
            <RiskDots risk={info.risk} />
          </dd>
          <dt className="text-muted">Theo dõi</dt>
          <dd>{info.effort}</dd>
          <dt className="text-muted">Hợp với</dt>
          <dd>{info.suits}</dd>
        </dl>
      </aside>
    </header>
  );
}
