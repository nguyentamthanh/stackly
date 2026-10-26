"use client";

import { useMemo, useState } from "react";
import { fmtNum, fmtPct } from "@/lib/format";
import { ALERT_LEVEL_LABELS, topLevel, type AlertLevel, type FundAlert } from "@/lib/fund-alerts";
import type { FundHistory } from "@/lib/fund-history";
import { monthLabel } from "@/lib/monthly";
import { MonthBars } from "./MonthBars";
import {
  beatsBenchmark,
  FUND_PERIODS,
  FUND_TYPE_LABELS,
  MIN_CAGR_YEARS,
  rankFunds,
  SINCE_INCEPTION,
  type Fund,
  type FundBenchmarks,
  type FundPeriod,
  type FundType,
} from "@/lib/funds";
import { cx } from "@/lib/ui";

type AlertFilter = "all" | "high" | "any" | "none";

const ALERT_FILTERS: { key: AlertFilter; label: string }[] = [
  { key: "all", label: "Tất cả quỹ" },
  { key: "high", label: "Có cảnh báo nghiêm trọng" },
  { key: "any", label: "Có cảnh báo từ mức lưu ý" },
  { key: "none", label: "Không có cảnh báo" },
];

const LEVEL_STYLE: Record<AlertLevel, { color: string; icon: string }> = {
  high: { color: "var(--down)", icon: "●" },
  medium: { color: "var(--t-expensive)", icon: "●" },
  info: { color: "var(--t-neutral)", icon: "●" },
};

const TYPES: (FundType | "all")[] = ["all", "STOCK", "BALANCED", "BOND"];
const GROUPS = [...new Set(FUND_PERIODS.map((p) => p.group))];
/** Tiêu đề cột ngắn cho các kỳ có nhãn dài */
const SHORT_LABEL: Partial<Record<FundPeriod, string>> = { cagr: "%/năm từ khi lập", since: "Tổng từ khi lập" };
const ROW_GRID = "md:grid-cols-[2.5rem_minmax(0,2.4fr)_0.9fr_0.9fr_1fr_0.8fr_0.7fr]";

function Medal({ rank }: { rank: number }) {
  const top = rank <= 3;
  return (
    <span
      className={cx(
        "inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
        top ? "bg-jade text-on-jade" : "bg-paper text-muted",
      )}
    >
      {rank}
    </span>
  );
}

export function FundRanking({
  funds,
  benchmarks,
  alerts,
  history,
}: {
  funds: Fund[];
  benchmarks: FundBenchmarks;
  /** Cảnh báo theo mã quỹ, đã sắp xếp từ nghiêm trọng đến thông tin */
  alerts: Record<string, FundAlert[]>;
  history: Record<string, FundHistory>;
}) {
  const [period, setPeriod] = useState<FundPeriod>("y1");
  const [type, setType] = useState<FundType | "all">("all");
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const ranked = useMemo(() => {
    const keep = (code: string) => {
      const top = topLevel(alerts[code] ?? []);
      if (alertFilter === "high") return top === "high";
      if (alertFilter === "any") return top === "high" || top === "medium";
      if (alertFilter === "none") return top == null;
      return true;
    };
    return rankFunds(funds, period, type).filter((f) => keep(f.code));
  }, [funds, period, type, alerts, alertFilter]);
  const missing = funds.filter((f) => (type === "all" || f.type === type) && f.returns[period] == null).length;
  const b = benchmarks[period];
  const periodLabel = FUND_PERIODS.find((p) => p.key === period)!.label;
  const beat = ranked.filter((f) => beatsBenchmark(f, period, benchmarks)).length;
  const sinceInception = SINCE_INCEPTION.includes(period);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Loại quỹ">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              onClick={() => setType(t)}
              className={cx(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap",
                type === t ? "border-ink bg-ink text-paper font-semibold" : "border-line text-muted hover:text-ink",
              )}
            >
              {t === "all" ? "Tất cả" : `Quỹ ${FUND_TYPE_LABELS[t].toLowerCase()}`}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted shrink-0">Xếp theo lợi nhuận</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as FundPeriod)}
            className="rounded-lg border border-line bg-paper px-3 py-1.5"
          >
            {GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {FUND_PERIODS.filter((p) => p.group === g).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm w-fit">
        <span className="text-muted shrink-0">Cảnh báo</span>
        <select value={alertFilter} onChange={(e) => setAlertFilter(e.target.value as AlertFilter)} className="rounded-lg border border-line bg-paper px-3 py-1.5">
          {ALERT_FILTERS.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted self-center">Chọn nhanh:</span>
        {(
          [
            ["y1", "Mạnh nhất 1 năm"],
            ["y5", "Bền vững 5 năm"],
            ["cagr", "Hiệu quả nhất từ trước đến nay"],
          ] as [FundPeriod, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={period === k}
            onClick={() => setPeriod(k)}
            className={cx(
              "rounded-lg border px-3 py-1",
              period === k ? "border-jade bg-jade-soft font-semibold" : "border-line text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {sinceInception ? (
        <p className="text-sm text-muted">
          {period === "cagr"
            ? `Xếp theo lợi nhuận bình quân mỗi năm kể từ ngày thành lập, công bằng giữa quỹ lâu năm và quỹ mới. Chỉ xếp quỹ hoạt động từ ${MIN_CAGR_YEARS} năm trở lên`
            : "Tổng lợi nhuận từ ngày thành lập nghiêng về quỹ lâu đời; xem thêm cột bình quân năm để so sánh công bằng"}
          {missing > 0 && ` · ${missing} quỹ chưa đủ điều kiện`}. Mỗi quỹ thành lập ở thời điểm khác nhau nên không có mốc so sánh chung.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Mốc {periodLabel.toLowerCase()}: VN-Index <strong className="text-ink">{fmtPct(b.vnindex, 1, true)}</strong>, tiết kiệm{" "}
          <strong className="text-ink">{fmtPct(b.savings, 1, true)}</strong>. {beat}/{ranked.length} quỹ vượt mốc của loại mình
          {missing > 0 && ` · ${missing} quỹ chưa đủ ${periodLabel.toLowerCase()} hoạt động nên không xếp hạng`}.
        </p>
      )}

      <div className={`hidden md:grid ${ROW_GRID} gap-4 px-3 text-xs text-muted`}>
        <span>#</span>
        <span>Quỹ</span>
        <span>Loại</span>
        <span className="text-right">NAV/CCQ</span>
        <span className="text-right">{SHORT_LABEL[period] ?? periodLabel}</span>
        <span className="text-right">3 năm/năm</span>
        <span className="text-right">Phí QL</span>
      </div>
      <ol className="rounded-xl border border-line bg-surface divide-y divide-line">
        {ranked.map((f) => {
          const wins = beatsBenchmark(f, period, benchmarks);
          return (
            <li key={f.code} className={`grid grid-cols-[2.5rem_1fr_auto] ${ROW_GRID} gap-x-4 gap-y-1 items-center px-3 py-3`}>
              <Medal rank={f.rank} />
              <span className="min-w-0">
                {f.website ? (
                  <a href={f.website} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                    {f.code}
                  </a>
                ) : (
                  <span className="font-semibold">{f.code}</span>
                )}{" "}
                <span className="text-xs text-muted">{f.manager}</span> <AlertBadge alerts={alerts[f.code]} />
                <span className="block text-xs text-muted truncate" title={f.name}>
                  {f.name}
                </span>
              </span>
              <span className="row-start-1 col-start-3 md:row-auto md:col-auto flex flex-col items-end md:items-start">
                <span className="text-sm">{FUND_TYPE_LABELS[f.type]}</span>
              </span>
              <span className="hidden md:block text-right tabular-nums text-sm">{fmtNum(f.nav, 0)}</span>
              <span className="col-start-2 md:col-auto md:text-right flex md:flex-col items-baseline md:items-end gap-2 md:gap-0">
                <span className={cx("font-semibold tabular-nums", f.value > 0 ? "text-up" : f.value < 0 ? "text-down" : "")}>
                  {fmtPct(f.value, 1, true)}
                </span>
                {sinceInception && (
                  <span className="text-xs text-muted">
                    {period === "cagr" ? `tổng ${fmtPct(f.returns.since, 0, true)}` : f.returns.cagr != null ? `${fmtPct(f.returns.cagr)}/năm` : ""}
                    {f.inception && ` · từ ${f.inception.slice(0, 4)}`}
                  </span>
                )}
                {wins != null && (
                  <span className={cx("text-xs", wins ? "text-jade" : "text-muted")}>
                    {wins ? "vượt " : "thua "}
                    {f.type === "BOND" ? "tiết kiệm" : "VN-Index"}
                  </span>
                )}
              </span>
              <span className="hidden md:block text-right tabular-nums text-sm">{fmtPct(f.annualized3y)}</span>
              <span className="hidden md:block text-right tabular-nums text-sm text-muted">{fmtPct(f.managementFee, 2)}</span>
              <AlertDetails alerts={alerts[f.code]} history={history[f.code]} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Huy hiệu số cảnh báo, màu theo mức cao nhất */
function AlertBadge({ alerts }: { alerts: FundAlert[] | undefined }) {
  const top = topLevel(alerts ?? []);
  if (!alerts || !top) return null;
  const n = alerts.filter((a) => a.level !== "info").length;
  const { color } = LEVEL_STYLE[top];
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium align-middle"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
      title={ALERT_LEVEL_LABELS[top]}
    >
      <span aria-hidden>▲</span>
      {n > 0 ? `${n} cảnh báo` : "Lưu ý"}
      <span className="sr-only">mức cao nhất: {ALERT_LEVEL_LABELS[top]}</span>
    </span>
  );
}

/** Mở rộng từng quỹ: danh sách cảnh báo kèm lợi nhuận 12 tháng gần nhất theo từng tháng */
function AlertDetails({ alerts, history }: { alerts: FundAlert[] | undefined; history: FundHistory | undefined }) {
  if (!alerts?.length && !history) return null;
  const months = history?.months ?? [];
  return (
    <details className="col-span-full group">
      <summary className="cursor-pointer text-xs text-muted hover:text-ink select-none w-fit">
        {alerts?.length ? `Xem ${alerts.length} cảnh báo và lợi nhuận từng tháng` : "Xem lợi nhuận từng tháng"}
      </summary>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {alerts?.length ? (
          <ul className="flex flex-col gap-2">
            {alerts.map((a) => (
              <li key={a.id} className="text-sm leading-snug">
                <span className="font-medium" style={{ color: LEVEL_STYLE[a.level].color }}>
                  {ALERT_LEVEL_LABELS[a.level]} · {a.title}
                </span>
                <span className="block text-muted">{a.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Không có cảnh báo nào cho quỹ này.</p>
        )}
        {history && months.some((m) => m.ret != null) && (
          <div>
            <div className="text-xs text-muted mb-1">
              12 tháng gần nhất, {monthLabel(months[0].month)} → {monthLabel(months.at(-1)!.month)} (cột cuối đến {history.asOf.split("-").reverse().join("/")})
            </div>
            <MonthBars months={months} />
            <div className="mt-1 flex justify-between text-xs text-muted tabular-nums">
              <span>Giảm sâu nhất: {fmtPct(history.maxDrawdown, 1)}</span>
              <span>Biến động: {history.vol != null ? fmtPct(history.vol, 1) + "/năm" : "—"}</span>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
