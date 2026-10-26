"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { AllocationFile } from "@/lib/allocation";
import type { LiteAsset } from "@/lib/client-data";
import { fmtPct, fmtVnd, fmtVndShort } from "@/lib/format";
import {
  analyzeGoal,
  GOAL_MONTHS,
  monthPlanRows,
  progressAlerts,
  STATUS_LABELS,
  type GoalAlert,
  type GoalStatus,
} from "@/lib/goal";
import { addMonths, currentMonth, monthLabel } from "@/lib/monthly";
import { PROFILES, type ProfileId } from "@/lib/plan";
import { valueHoldings } from "@/lib/portfolio";
import { updateState, useAppState, type AppState, type GoalState } from "@/lib/storage";
import type { Bar } from "@/lib/types";
import { cx } from "@/lib/ui";
import { MoneyInput } from "./MoneyInput";
import { StrategyChart } from "./StrategyChart";
import { NumField } from "./Tools";

/** Giả định khi chưa có file phân bổ tối ưu */
const FALLBACK_RETURNS: Record<ProfileId, { ret: number; vol: number }> = {
  conservative: { ret: 0.07, vol: 0.06 },
  balanced: { ret: 0.1, vol: 0.1 },
  growth: { ret: 0.13, vol: 0.15 },
};

const LEVEL_STYLE: Record<GoalAlert["level"], { color: string; label: string }> = {
  high: { color: "var(--down)", label: "Nghiêm trọng" },
  medium: { color: "var(--t-expensive)", label: "Lưu ý" },
  info: { color: "var(--t-neutral)", label: "Thông tin" },
  good: { color: "var(--up)", label: "Tốt" },
};

const STATUS_COLOR: Record<GoalStatus, string> = {
  ahead: "var(--up)",
  "on-track": "var(--jade)",
  behind: "var(--t-expensive)",
  "far-behind": "var(--down)",
};

const monthDate = (m: string) => `${m}-28`;

function defaultGoal(state: AppState): GoalState {
  const monthly = state.plan.budget;
  return { start: currentMonth(), initial: 0, monthly, target: Math.round((monthly * GOAL_MONTHS * 1.05) / 1_000_000) * 1_000_000, actuals: {} };
}

export function GoalPlanner({
  alloc,
  assets,
  usdVnd,
  savingsRate,
  fundCounts,
}: {
  alloc: AllocationFile | null;
  assets: LiteAsset[];
  usdVnd: number;
  savingsRate: number;
  /** Số quỹ đang có cảnh báo, để nhắc người dùng sang trang Quỹ */
  fundCounts: { high: number; medium: number };
}) {
  const state = useAppState();
  const goal = state?.goal ?? (state ? defaultGoal(state) : null);
  const profile = state?.plan.profile ?? "balanced";
  const { ret, vol } = alloc?.optimized[profile] ?? FALLBACK_RETURNS[profile];
  const analysis = useMemo(
    () => (goal ? analyzeGoal({ initial: goal.initial, monthly: goal.monthly, target: goal.target, expected: ret, vol, savingsRate }) : null),
    [goal, ret, vol, savingsRate],
  );
  const rows = useMemo(() => (goal && analysis ? monthPlanRows(goal.start, analysis.plan, goal.actuals) : []), [goal, analysis]);
  const lines = useMemo(() => {
    if (!goal || !analysis) return [];
    const toBars = (path: number[]): Bar[] => path.map((v, i) => [monthDate(addMonths(goal.start, i)), v]);
    const actual: Bar[] = rows.flatMap((r) => (r.actual == null ? [] : [[monthDate(r.month), r.actual] as Bar]));
    const get = (id: string) => analysis.scenarios.find((s) => s.id === id)!.path;
    return [
      { name: "Kế hoạch", data: toBars(analysis.plan), color: "--ink" },
      { name: "Kịch bản xấu", data: toBars(get("bad")), color: "--t-very-expensive", dashed: true },
      { name: "Kỳ vọng", data: toBars(get("base")), color: "--jade" },
      { name: "Kịch bản tốt", data: toBars(get("good")), color: "--t-very-cheap", dashed: true },
      ...(actual.length ? [{ name: "Thực tế", data: actual, color: "--t-expensive" }] : []),
    ];
  }, [goal, analysis, rows]);

  if (!state || !goal || !analysis) return <div className="h-96 rounded-xl bg-surface border border-line animate-pulse" aria-busy="true" />;

  // Chỉ tới đây khi đã đọc được localStorage (phía trình duyệt), nên dùng giờ hiện tại không ảnh hưởng prerender
  const now = currentMonth();
  const save = (patch: Partial<GoalState>) => updateState((s) => ({ ...s, goal: { ...(s.goal ?? defaultGoal(s)), ...patch } }));
  const setActual = (month: string, value: string) =>
    updateState((s) => {
      const g = s.goal ?? defaultGoal(s);
      const actuals = { ...g.actuals };
      if (value === "" || !Number.isFinite(Number(value))) delete actuals[month];
      else actuals[month] = Math.max(0, Number(value));
      return { ...s, goal: { ...g, actuals } };
    });

  const portfolioValue = valueHoldings(state.transactions, assets, usdVnd, savingsRate, new Date().toISOString().slice(0, 10)).reduce((a, r) => a + r.valueVnd, 0);
  const alerts: GoalAlert[] = [...progressAlerts(rows, now, goal.target), ...analysis.alerts];
  if (fundCounts.high > 0) {
    alerts.push({
      id: "fund-alerts",
      level: "info",
      title: `${fundCounts.high} quỹ mở đang có cảnh báo nghiêm trọng`,
      detail: "Nếu bạn định đầu tư qua quỹ mở để đạt mục tiêu, hãy xem cảnh báo của từng quỹ trước khi chọn.",
    });
  }
  const order = { high: 0, medium: 1, info: 2, good: 3 } as const;
  alerts.sort((a, b) => order[a.level] - order[b.level]);

  const scenario = (id: string) => analysis.scenarios.find((s) => s.id === id)!;
  const end = (id: string) => scenario(id).path.at(-1)!;
  const endMonth = addMonths(goal.start, GOAL_MONTHS - 1);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-line bg-surface p-4 sm:p-6 flex flex-col gap-5" aria-labelledby="h-goal-input">
        <h2 id="h-goal-input" className="font-display text-xl font-semibold">
          Mục tiêu của bạn
        </h2>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">Khẩu vị rủi ro (quyết định lợi nhuận kỳ vọng)</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Khẩu vị rủi ro">
            {(Object.keys(PROFILES) as ProfileId[]).map((id) => {
              const p = alloc?.optimized[id] ?? FALLBACK_RETURNS[id];
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={profile === id}
                  onClick={() => updateState((s) => ({ ...s, plan: { ...s.plan, profile: id } }))}
                  className={cx("rounded-lg border px-3 py-2 text-sm text-left", profile === id ? "border-jade bg-jade-soft" : "border-line text-muted hover:text-ink")}
                >
                  <span className="font-semibold block">{PROFILES[id].name}</span>
                  <span className="text-xs">
                    kỳ vọng {fmtPct(p.ret, 1)} · biến động {fmtPct(p.vol, 0)}/năm
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Tháng bắt đầu</span>
            <input
              type="month"
              value={goal.start}
              onChange={(e) => e.target.value && save({ start: e.target.value })}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2"
            />
          </label>
          <NumField label="Vốn hiện có" value={goal.initial} onChange={(v) => save({ initial: v })} step={1_000_000} suffix="VND" />
          <NumField label="Góp mỗi tháng" value={goal.monthly} onChange={(v) => save({ monthly: v })} step={500_000} suffix="VND" />
          <NumField label={`Mục tiêu cuối ${monthLabel(endMonth)}`} value={goal.target} onChange={(v) => save({ target: v })} step={5_000_000} suffix="VND" />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {portfolioValue > 0 ? (
            <button type="button" onClick={() => save({ initial: Math.round(portfolioValue) })} className="rounded-lg border border-line px-3 py-1.5 hover:border-jade">
              Lấy vốn từ Danh mục ({fmtVndShort(portfolioValue)})
            </button>
          ) : (
            <span className="text-muted">
              Chưa có giao dịch nào trong <Link href="/danh-muc" className="underline underline-offset-2">Danh mục</Link> để lấy vốn hiện có.
            </span>
          )}
          <button
            type="button"
            onClick={() => save({ target: Math.ceil(analysis.scenarios.find((s) => s.id === "base")!.path.at(-1)! / 1_000_000) * 1_000_000 })}
            className="rounded-lg border border-line px-3 py-1.5 hover:border-jade"
          >
            Đặt mục tiêu = kết quả kỳ vọng ({fmtVndShort(end("base"))})
          </button>
        </div>
      </section>

      <section aria-labelledby="h-goal-result" className="flex flex-col gap-4">
        <h2 id="h-goal-result" className="font-display text-2xl font-semibold">
          Phân tích cả năm
        </h2>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Lợi suất cần có" value={analysis.required == null ? "Không thể" : fmtPct(analysis.required, 1)} sub={`so với kỳ vọng ${fmtPct(ret, 1)}/năm`} tone={analysis.required != null && analysis.required > ret ? "bad" : "ok"} />
          <Stat label="Xác suất đạt (ước lượng)" value={analysis.probability == null ? "—" : fmtPct(analysis.probability, 0)} sub={`biến động ${fmtPct(vol, 0)}/năm`} tone={analysis.probability != null && analysis.probability < 0.4 ? "bad" : "ok"} />
          <Stat label="Tổng tiền bỏ vào" value={fmtVndShort(analysis.contributed)} sub={`${fmtVndShort(goal.initial)} vốn + ${GOAL_MONTHS} × ${fmtVndShort(goal.monthly)}`} />
          <Stat label="Cần góp để chắc hơn" value={`${fmtVndShort(analysis.monthlyForBad)}/tháng`} sub={`đạt cả ở kịch bản xấu; mức kỳ vọng: ${fmtVndShort(analysis.monthlyForBase)}`} />
        </dl>

        <ul className="flex flex-col gap-2" aria-label="Cảnh báo và nhận xét">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm" style={{ borderLeft: `4px solid ${LEVEL_STYLE[a.level].color}` }}>
              <span className="font-semibold" style={{ color: LEVEL_STYLE[a.level].color }}>
                {LEVEL_STYLE[a.level].label} · {a.title}
              </span>
              <span className="block text-muted">{a.detail}</span>
              {a.id === "fund-alerts" && (
                <Link href="/quy" className="text-jade underline underline-offset-2">
                  Xem cảnh báo quỹ
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-muted text-left">
              <tr>
                <th className="font-normal px-4 py-2">Kịch bản</th>
                <th className="font-normal px-4 py-2 text-right">Lợi suất năm</th>
                <th className="font-normal px-4 py-2 text-right">Sau 12 tháng</th>
                <th className="font-normal px-4 py-2 text-right">So với mục tiêu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {analysis.scenarios.map((s) => {
                const v = s.path.at(-1)!;
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium">{s.label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtPct(s.annualRate, 1, true)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtVnd(v)}</td>
                    <td className={cx("px-4 py-2 text-right tabular-nums font-medium", v >= goal.target ? "text-up" : "text-down")}>
                      {v >= goal.target ? "Đạt, dư " : "Thiếu "}
                      {fmtVndShort(Math.abs(v - goal.target))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h-goal-months" className="flex flex-col gap-4">
        <div>
          <h2 id="h-goal-months" className="font-display text-2xl font-semibold">
            Kế hoạch theo từng tháng
          </h2>
          <p className="text-sm text-muted mt-1 max-w-prose">
            Cột Kế hoạch là số dư cuối tháng cần đạt để chạm mục tiêu. Cuối mỗi tháng, nhập số dư thực tế của bạn (tổng giá trị các khoản đã đầu tư và tiền chờ) để theo dõi tiến độ.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3 sm:p-4">
          <StrategyChart lines={lines} height={280} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="text-muted text-left">
              <tr>
                <th className="font-normal px-3 py-2">Tháng</th>
                <th className="font-normal px-3 py-2 text-right">Góp đầu tháng</th>
                <th className="font-normal px-3 py-2 text-right">Kế hoạch</th>
                <th className="font-normal px-3 py-2 text-right">Xấu</th>
                <th className="font-normal px-3 py-2 text-right">Kỳ vọng</th>
                <th className="font-normal px-3 py-2 text-right">Tốt</th>
                <th className="font-normal px-3 py-2 text-right">Thực tế cuối tháng</th>
                <th className="font-normal px-3 py-2">Tiến độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => {
                const isNow = r.month === now;
                const future = r.month > now;
                return (
                  <tr key={r.month} className={cx(isNow && "bg-jade-soft/60")}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {monthLabel(r.month)}
                      {isNow && <span className="ml-1.5 text-xs text-jade">tháng này</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtVndShort(goal.monthly)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtVndShort(r.planned)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{fmtVndShort(scenario("bad").path[i])}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{fmtVndShort(scenario("base").path[i])}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{fmtVndShort(scenario("good").path[i])}</td>
                    <td className="px-3 py-1.5 text-right">
                      <MoneyInput
                        aria-label={`Số dư thực tế cuối ${monthLabel(r.month)}`}
                        value={r.actual ?? ""}
                        placeholder={future ? "chưa tới" : "nhập"}
                        onValueChange={(v) => setActual(r.month, v)}
                        className="w-36 rounded-md border border-line bg-paper px-2 py-1 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      {r.status ? (
                        <span style={{ color: STATUS_COLOR[r.status] }} className="font-medium">
                          {STATUS_LABELS[r.status]}{" "}
                          <span className="tabular-nums">
                            ({r.gap! >= 0 ? "+" : "−"}
                            {fmtVndShort(Math.abs(r.gap!))})
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted max-w-prose">
          Lợi suất kỳ vọng và biến động lấy từ danh mục tối ưu theo khẩu vị rủi ro, tính trên dữ liệu quá khứ nên chỉ mang tính tham khảo. Xác suất là ước lượng thô (phân phối chuẩn trên lợi
          nhuận 1 năm), bỏ qua việc tiền góp về sau chịu rủi ro ngắn hơn tiền đầu năm. Chưa tính phí giao dịch và thuế. Dữ liệu mục tiêu lưu trên trình duyệt, sao lưu và đồng bộ cùng với Danh mục.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3 sm:p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cx("text-xl sm:text-2xl font-semibold tabular-nums", tone === "bad" && "text-down")}>{value}</dd>
      {sub && <dd className="text-xs text-muted mt-0.5">{sub}</dd>}
    </div>
  );
}
