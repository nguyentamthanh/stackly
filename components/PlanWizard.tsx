"use client";

import Link from "next/link";
import { useState } from "react";
import { CLASS_LABELS, CLASS_ORDER } from "@/lib/assets";
import { quantityHint, type LiteAsset } from "@/lib/client-data";
import { fmtNum, fmtPct, fmtVnd } from "@/lib/format";
import { targetWeights, type AllocationFile } from "@/lib/allocation";
import { monthlyPlan, PROFILES, profileFromAnswers, QUIZ, type ProfileId } from "@/lib/plan";
import { FrontierChart, FrontierLegend } from "./FrontierChart";
import { updateState, useAppState } from "@/lib/storage";
import type { AssetClass } from "@/lib/types";
import { CLASS_COLOR, cx, LEVEL_COLOR } from "@/lib/ui";

const BUDGET_PRESETS = [2_000_000, 5_000_000, 10_000_000, 20_000_000];

export function AllocationBar({ weights }: { weights: Record<AssetClass, number> }) {
  return (
    <span className="flex h-2 rounded-full overflow-hidden" aria-hidden>
      {CLASS_ORDER.map((c) =>
        weights[c] > 0 ? <span key={c} style={{ width: `${weights[c] * 100}%`, background: CLASS_COLOR[c] }} /> : null,
      )}
    </span>
  );
}

export function PlanWizard({ assets, usdVnd, alloc }: { assets: LiteAsset[]; usdVnd: number; alloc: AllocationFile | null }) {
  const state = useAppState();
  const [quizOpen, setQuizOpen] = useState(false);
  const [draft, setDraft] = useState<(number | null)[]>(() => QUIZ.map(() => null));

  if (!state) return <div className="h-96 rounded-xl bg-surface border border-line animate-pulse" aria-busy="true" />;

  const { plan } = state;
  const profile = PROFILES[plan.profile];
  const method = alloc ? plan.method : "fixed";
  const weightsFor = (id: ProfileId) => targetWeights(id, method, alloc);
  const setPlan = (patch: Partial<typeof plan>) => updateState((s) => ({ ...s, plan: { ...s.plan, ...patch } }));

  const pickFor = (cls: AssetClass): LiteAsset | undefined =>
    assets.find((a) => a.id === plan.picks[cls]) ?? assets.find((a) => a.class === cls);

  const result = monthlyPlan({
    budget: plan.budget,
    weights: weightsFor(plan.profile),
    multipliers: Object.fromEntries(CLASS_ORDER.map((c) => [c, pickFor(c)?.multiplier ?? 1])),
  });
  const quizDone = draft.every((a) => a != null);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="h-profile">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h2 id="h-profile" className="font-display text-2xl font-semibold">
            Khẩu vị rủi ro
          </h2>
          {alloc && (
            <div className="flex rounded-lg border border-line p-0.5 text-sm" role="radiogroup" aria-label="Cách phân bổ">
              {(
                [
                  ["optimized", "Tối ưu theo đường biên"],
                  ["fixed", "Tỷ trọng cố định"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  onClick={() => setPlan({ method: m })}
                  className={cx("px-3 py-1.5 rounded-md", method === m ? "bg-ink text-paper font-semibold" : "text-muted hover:text-ink")}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid md:grid-cols-3 gap-3" role="radiogroup" aria-labelledby="h-profile">
          {Object.values(PROFILES).map((profileItem) => {
            const p = { ...profileItem, weights: weightsFor(profileItem.id) };
            const stats = alloc ? (method === "optimized" ? alloc.optimized[p.id] : alloc.fixed[p.id]) : null;
            const active = p.id === plan.profile;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPlan({ profile: p.id })}
                className={cx(
                  "text-left rounded-xl border p-4 flex flex-col gap-2 bg-surface",
                  active ? "border-jade ring-2 ring-jade/30" : "border-line hover:border-muted",
                )}
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-sm text-muted">{p.description}</span>
                <AllocationBar weights={p.weights} />
                <span className="text-xs text-muted">
                  {CLASS_ORDER.filter((c) => p.weights[c] > 0)
                    .map((c) => `${CLASS_LABELS[c]} ${fmtPct(p.weights[c], 0)}`)
                    .join(", ")}
                </span>
                {stats && (
                  <span className="text-xs tabular-nums">
                    Kỳ vọng <strong>{fmtPct(stats.ret, 1)}</strong>/năm · biến động {fmtPct(stats.vol, 1)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {alloc && <FrontierExplainer alloc={alloc} profile={plan.profile} />}

        <button type="button" onClick={() => setQuizOpen((o) => !o)} aria-expanded={quizOpen} className="mt-3 text-sm text-jade font-medium hover:underline">
          {quizOpen ? "Đóng bài trắc nghiệm" : "Chưa chắc chọn gì? Trả lời 5 câu hỏi"}
        </button>
        {quizOpen && (
          <form
            className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-5 flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!quizDone) return;
              const answers = draft as number[];
              setPlan({ answers, profile: profileFromAnswers(answers) });
              setQuizOpen(false);
            }}
          >
            {QUIZ.map((q, qi) => (
              <fieldset key={qi} className="flex flex-col gap-2">
                <legend className="font-medium mb-1">
                  {qi + 1}. {q.question}
                </legend>
                <div className="flex flex-col sm:flex-row gap-2">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={cx(
                        "flex-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer",
                        draft[qi] === oi ? "border-jade bg-jade-soft" : "border-line hover:border-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name={`q${qi}`}
                        checked={draft[qi] === oi}
                        onChange={() => setDraft((d) => d.map((v, i) => (i === qi ? oi : v)))}
                        className="accent-[var(--jade)]"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <button
              type="submit"
              disabled={!quizDone}
              className="self-start rounded-lg bg-jade text-on-jade font-semibold px-4 py-2.5 disabled:opacity-40"
            >
              {quizDone ? `Áp dụng kết quả: ${PROFILES[profileFromAnswers(draft as number[])].name}` : "Trả lời đủ 5 câu để xem kết quả"}
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="h-budget">
        <h2 id="h-budget" className="font-display text-2xl font-semibold mb-3">
          Số tiền để dành mỗi tháng
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="relative sm:w-64">
            <span className="sr-only">Ngân sách hàng tháng (VND)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={500000}
              value={plan.budget}
              onChange={(e) => setPlan({ budget: Math.max(0, Number(e.target.value)) })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 pr-12 text-lg font-semibold tabular-nums"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">VND</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {BUDGET_PRESETS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setPlan({ budget: b })}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-sm",
                  plan.budget === b ? "border-jade bg-jade-soft font-semibold" : "border-line hover:border-muted",
                )}
              >
                {fmtNum(b / 1e6)} triệu
              </button>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="h-result">
        <h2 id="h-result" className="font-display text-2xl font-semibold mb-1">
          Tháng này nên mua
        </h2>
        <p className="text-sm text-muted mb-4">Hồ sơ {profile.name}. Đổi tài sản đại diện của từng nhóm trong ô chọn.</p>
        <div className="rounded-xl border border-line bg-surface divide-y divide-line">
          {result.items
            .filter((it) => it.weight > 0)
            .map((it) => {
              const asset = pickFor(it.cls);
              const options = assets.filter((a) => a.class === it.cls);
              return (
                <div key={it.cls} className="grid grid-cols-1 sm:grid-cols-[1.4fr_1.2fr_1fr] gap-3 p-4 items-center">
                  <div className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-2 text-sm text-muted">
                      <span className="size-2.5 rounded-full" style={{ background: CLASS_COLOR[it.cls] }} aria-hidden />
                      {CLASS_LABELS[it.cls]} · mục tiêu {fmtPct(it.weight, 0)}
                    </span>
                    {options.length > 1 ? (
                      <select
                        aria-label={`Tài sản đại diện cho ${CLASS_LABELS[it.cls]}`}
                        value={asset?.id}
                        onChange={(e) => setPlan({ picks: { ...plan.picks, [it.cls]: e.target.value } })}
                        className="rounded-lg border border-line bg-paper px-2.5 py-1.5 font-medium max-w-xs"
                      >
                        {options.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.symbol} – {a.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-medium">{asset?.name}</span>
                    )}
                  </div>
                  <div className="text-sm">
                    {asset && it.cls !== "savings" ? (
                      <>
                        <Link href={`/tai-san/${asset.id}`} className="font-semibold hover:underline" style={{ color: LEVEL_COLOR[asset.level] }}>
                          {fmtNum(asset.score, 0)} điểm · {asset.label}
                        </Link>
                        <span className="block text-muted">Hệ số ×{String(it.multiplier).replace(".", ",")}</span>
                      </>
                    ) : (
                      <span className="text-muted">Nhận phần tiền còn lại, làm quỹ chờ cơ hội</span>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <span className="block text-xl font-semibold tabular-nums">{fmtVnd(it.amount)}</span>
                    {asset && <span className="text-sm text-muted">{quantityHint(asset, it.amount, usdVnd)}</span>}
                  </div>
                </div>
              );
            })}
          <div className="flex justify-between items-baseline p-4 bg-paper/50 rounded-b-xl">
            <span className="font-medium">Tổng</span>
            <span className="text-xl font-semibold tabular-nums">{fmtVnd(result.items.reduce((a, x) => a + x.amount, 0))}</span>
          </div>
        </div>
        {result.extraSuggested > 0 && (
          <p className="mt-4 rounded-lg bg-t-very-cheap/10 border border-t-very-cheap/30 p-3 text-sm">
            Nhiều kênh đang rẻ. Nếu có tiền nhàn rỗi ngoài quỹ dự phòng, có thể mua thêm khoảng{" "}
            <strong>{fmtVnd(result.extraSuggested)}</strong> theo đúng tỷ lệ trên.
          </p>
        )}
        <p className="mt-4 text-sm text-muted max-w-prose">
          Đã mua xong? Ghi lại giao dịch ở{" "}
          <Link href="/danh-muc" className="text-jade font-medium hover:underline">
            Danh mục
          </Link>{" "}
          để theo dõi lãi lỗ và tỷ trọng.
        </p>
      </section>
    </div>
  );
}

function FrontierExplainer({ alloc, profile }: { alloc: AllocationFile; profile: ProfileId }) {
  const ids = Object.keys(alloc.optimized) as ProfileId[];
  return (
    <details className="mt-4 rounded-xl border border-line bg-surface group">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium flex items-center justify-between gap-2">
        Vì sao phân bổ như vậy?
        <span className="text-muted text-sm group-open:rotate-180 transition-transform" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="px-4 pb-5 flex flex-col gap-4">
        <p className="text-sm text-muted max-w-prose">
          Từ lợi nhuận và mức tương quan của các kênh trong {alloc.window.months} tháng ({alloc.window.from.replace("-", "/")} –{" "}
          {alloc.window.to.replace("-", "/")}), app tìm tỷ trọng cho lợi nhuận kỳ vọng cao nhất ở mỗi mức rủi ro. Các kênh ít đi cùng
          chiều nhau giúp giảm rủi ro chung, nên danh mục tối ưu nằm cao hơn và lệch trái so với tỷ trọng cố định.
        </p>
        <FrontierLegend />
        <FrontierChart alloc={alloc} profile={profile} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-muted text-left">
              <tr>
                <th className="font-normal py-1.5">Hồ sơ</th>
                <th className="font-normal py-1.5 text-right">Cố định: kỳ vọng / biến động</th>
                <th className="font-normal py-1.5 text-right">Tối ưu: kỳ vọng / biến động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {ids.map((id) => (
                <tr key={id} className={id === profile ? "font-semibold" : ""}>
                  <td className="py-2">{PROFILES[id].name}</td>
                  <td className="py-2 text-right">
                    {fmtPct(alloc.fixed[id].ret)} / {fmtPct(alloc.fixed[id].vol)}
                  </td>
                  <td className="py-2 text-right text-jade">
                    {fmtPct(alloc.optimized[id].ret)} / {fmtPct(alloc.optimized[id].vol)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-muted text-left">
              <tr>
                <th className="font-normal py-1.5">Kênh (quy ra VND)</th>
                <th className="font-normal py-1.5 text-right">Lịch sử/năm</th>
                <th className="font-normal py-1.5 text-right">Kỳ vọng dùng để tính</th>
                <th className="font-normal py-1.5 text-right">Biến động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {alloc.classes.map((c) => (
                <tr key={c.cls}>
                  <td className="py-2">{CLASS_LABELS[c.cls]}</td>
                  <td className="py-2 text-right">{fmtPct(c.histReturn)}</td>
                  <td className="py-2 text-right">{fmtPct(c.expReturn)}</td>
                  <td className="py-2 text-right">{fmtPct(c.vol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted max-w-prose">
          Lợi nhuận kỳ vọng lấy một nửa từ lịch sử và một nửa từ giả định dài hạn, để không dồn tiền vào kênh vừa tăng mạnh. Mỗi hồ sơ
          có giới hạn tối thiểu và tối đa cho từng kênh (crypto tối đa 0%, 5%, 10%). Đại diện: VN-Index, S&amp;P 500, vàng thế giới, Bitcoin.
          Quá khứ không đảm bảo tương lai.
        </p>
      </div>
    </details>
  );
}
