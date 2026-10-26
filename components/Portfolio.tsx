"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { targetWeights, type AllocationFile } from "@/lib/allocation";
import { CLASS_LABELS, CLASS_ORDER } from "@/lib/assets";
import { priceVnd, type LiteAsset } from "@/lib/client-data";
import { fmtDate, fmtNum, fmtPct, fmtVnd } from "@/lib/format";
import { PROFILES } from "@/lib/plan";
import { holdingsFromTransactions, savingsValue, xirr, type CashFlow, type Transaction } from "@/lib/portfolio";
import { exportState, importStateFromFile, updateState, useAppState } from "@/lib/storage";
import type { AssetClass } from "@/lib/types";
import { CLASS_COLOR, cx } from "@/lib/ui";

interface Row {
  asset: LiteAsset;
  quantity: number;
  costVnd: number;
  valueVnd: number;
  realizedVnd: number;
}

function quantityLabel(a: LiteAsset | undefined): string {
  if (!a) return "Số lượng";
  if (a.class === "savings") return "Số tiền gửi (VND)";
  if (a.class === "gold") return "Số lượng (lượng, 1 chỉ = 0,1)";
  if (a.class === "crypto") return `Số lượng ${a.symbol}`;
  return "Số lượng (cổ phiếu/CCQ)";
}

export function Portfolio({
  assets,
  usdVnd,
  defaultSavingsRate,
  alloc,
}: {
  assets: LiteAsset[];
  usdVnd: number;
  defaultSavingsRate: number;
  alloc: AllocationFile | null;
}) {
  const state = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (!state) return <div className="h-96 rounded-xl bg-surface border border-line animate-pulse" aria-busy="true" />;

  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map(assets.map((a) => [a.id, a]));
  const txs = state.transactions;
  const fxOf = (a: LiteAsset) => (a.currency === "USD" ? usdVnd : 1);

  // Tổng hợp nắm giữ
  const holdings = holdingsFromTransactions(txs);
  const rows: Row[] = [];
  for (const h of holdings.values()) {
    const asset = byId.get(h.assetId);
    if (!asset) continue;
    let valueVnd: number;
    if (asset.class === "savings") {
      const deposits = txs.filter((t) => t.assetId === asset.id);
      valueVnd = deposits.reduce(
        (a, t) => a + (t.type === "buy" ? savingsValue(t.quantity, t.rate ?? defaultSavingsRate, t.date, today) : -t.quantity),
        0,
      );
    } else valueVnd = h.quantity * priceVnd(asset, usdVnd);
    if (h.quantity <= 0 && h.realized === 0) continue;
    rows.push({ asset, quantity: h.quantity, costVnd: h.cost * fxOf(asset), valueVnd: Math.max(0, valueVnd), realizedVnd: h.realized * fxOf(asset) });
  }
  const totalValue = rows.reduce((a, r) => a + r.valueVnd, 0);
  const totalCost = rows.reduce((a, r) => a + r.costVnd, 0);
  const totalRealized = rows.reduce((a, r) => a + r.realizedVnd, 0);

  const flows: CashFlow[] = [...txs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((t) => {
      const a = byId.get(t.assetId);
      if (!a) return [];
      const gross = t.quantity * t.price * fxOf(a);
      return [{ date: t.date, amount: t.type === "buy" ? -(gross + t.fee * fxOf(a)) : gross - t.fee * fxOf(a) }];
    });
  if (totalValue > 0) flows.push({ date: today, amount: totalValue });
  const irr = flows.length >= 2 && flows[0].date < today ? xirr(flows) : null;

  // Phân bổ thực tế so với mục tiêu
  const target = targetWeights(state.plan.profile, alloc ? state.plan.method : "fixed", alloc);
  const actual = Object.fromEntries(CLASS_ORDER.map((c) => [c, 0])) as Record<AssetClass, number>;
  for (const r of rows) actual[r.asset.class] += totalValue ? r.valueVnd / totalValue : 0;

  const removeTx = (id: string) => updateState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));

  return (
    <div className="flex flex-col gap-10">
      {rows.length > 0 && (
        <section aria-label="Tổng quan danh mục" className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl overflow-hidden border border-line bg-line">
          <Stat label="Giá trị hiện tại" value={fmtVnd(totalValue)} />
          <Stat label="Vốn đang đầu tư" value={fmtVnd(totalCost)} />
          <Stat
            label="Lãi/lỗ chưa chốt"
            value={fmtVnd(totalValue - totalCost)}
            sub={fmtPct(totalCost ? totalValue / totalCost - 1 : 0, 1, true)}
            tone={totalValue - totalCost}
          />
          <Stat
            label="Tỷ suất theo năm (XIRR)"
            value={irr == null ? "—" : fmtPct(irr, 1, true)}
            sub={totalRealized ? `Đã chốt ${fmtVnd(totalRealized)}` : undefined}
            tone={irr ?? 0}
          />
        </section>
      )}

      {rows.length > 0 && (
        <section aria-labelledby="h-holdings">
          <h2 id="h-holdings" className="font-display text-2xl font-semibold mb-3">
            Đang nắm giữ
          </h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-muted text-left">
                <tr>
                  <th className="font-normal px-4 py-2">Tài sản</th>
                  <th className="font-normal px-4 py-2 text-right">Số lượng</th>
                  <th className="font-normal px-4 py-2 text-right">Vốn</th>
                  <th className="font-normal px-4 py-2 text-right">Giá trị</th>
                  <th className="font-normal px-4 py-2 text-right">Lãi/lỗ</th>
                  <th className="font-normal px-4 py-2 text-right">Tỷ trọng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows
                  .filter((r) => r.quantity > 0)
                  .sort((a, b) => b.valueVnd - a.valueVnd)
                  .map((r) => {
                    const pl = r.valueVnd - r.costVnd;
                    return (
                      <tr key={r.asset.id}>
                        <td className="px-4 py-2.5">
                          <Link href={`/tai-san/${r.asset.id}`} className="font-semibold hover:underline">
                            {r.asset.symbol}
                          </Link>{" "}
                          <span className="text-muted">{r.asset.name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.asset.class === "savings" ? "—" : fmtNum(r.quantity, 4)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtVnd(r.costVnd)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmtVnd(r.valueVnd)}</td>
                        <td className={cx("px-4 py-2.5 text-right tabular-nums", pl > 0 ? "text-up" : pl < 0 ? "text-down" : "")}>
                          {fmtPct(r.costVnd ? pl / r.costVnd : 0, 1, true)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtPct(totalValue ? r.valueVnd / totalValue : 0)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {assets.some((a) => a.currency === "USD") && (
            <p className="text-xs text-muted mt-2">Tài sản tính bằng USD được quy đổi theo tỷ giá hiện tại {fmtNum(usdVnd)} VND/USD.</p>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <section aria-labelledby="h-alloc">
          <h2 id="h-alloc" className="font-display text-2xl font-semibold mb-1">
            Tỷ trọng so với mục tiêu
          </h2>
          <p className="text-sm text-muted mb-4">
            Mục tiêu theo hồ sơ {PROFILES[state.plan.profile].name}, {alloc && state.plan.method === "optimized" ? "phân bổ tối ưu" : "tỷ trọng cố định"} (đổi ở{" "}
            <Link href="/ke-hoach" className="text-jade hover:underline">
              Kế hoạch
            </Link>
            ).
          </p>
          <ul className="flex flex-col gap-4">
            {CLASS_ORDER.filter((c) => target[c] > 0 || actual[c] > 0).map((c) => {
              const gap = actual[c] - target[c];
              return (
                <li key={c} className="grid grid-cols-[8rem_1fr] sm:grid-cols-[10rem_1fr_16rem] gap-x-4 gap-y-1 items-center">
                  <span className="font-medium">{CLASS_LABELS[c]}</span>
                  <span className="relative h-3 rounded-full bg-line">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, actual[c] * 100)}%`, background: CLASS_COLOR[c] }} />
                    <span className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `${target[c] * 100}%` }} title="Mục tiêu" />
                  </span>
                  <span className="col-span-2 sm:col-span-1 text-sm text-muted">
                    {fmtPct(actual[c], 0)} / mục tiêu {fmtPct(target[c], 0)}
                    {Math.abs(gap) >= 0.05 && (
                      <strong className={cx("ml-1 font-medium", gap > 0 ? "text-t-expensive" : "text-t-very-cheap")}>
                        {gap > 0 ? "· tạm ngừng mua thêm" : "· ưu tiên mua thêm"}
                      </strong>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted mt-3">Vạch đen là tỷ trọng mục tiêu. Lệch từ 5 điểm % trở lên thì nên cân bằng lại bằng tiền mua mới thay vì bán ra.</p>
        </section>
      )}

      <AddTransaction assets={assets} defaultSavingsRate={defaultSavingsRate} today={today} />

      <section aria-labelledby="h-txs">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h2 id="h-txs" className="font-display text-2xl font-semibold">
            Lịch sử giao dịch
          </h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => exportState(state)} className="rounded-lg border border-line px-3 py-2 text-sm hover:border-muted">
              Tải file sao lưu
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-line px-3 py-2 text-sm hover:border-muted">
              Khôi phục từ file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const s = await importStateFromFile(f);
                  setMessage({ kind: "ok", text: `Đã khôi phục ${s.transactions.length} giao dịch và kế hoạch.` });
                } catch (err) {
                  setMessage({ kind: "error", text: (err as Error).message });
                }
              }}
            />
          </div>
        </div>
        {message && (
          <p role="status" className={cx("mb-3 text-sm rounded-lg px-3 py-2", message.kind === "ok" ? "bg-jade-soft" : "bg-down/10 text-down")}>
            {message.text}
          </p>
        )}
        {txs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-muted text-center">
            Chưa có giao dịch nào. Thêm lần mua đầu tiên ở biểu mẫu phía trên.
          </p>
        ) : (
          <ul className="rounded-xl border border-line bg-surface divide-y divide-line text-sm">
            {[...txs]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((t) => {
                const a = byId.get(t.assetId);
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                    <span className="tabular-nums text-muted w-24">{fmtDate(t.date)}</span>
                    <span className={cx("font-medium w-12", t.type === "buy" ? "text-up" : "text-down")}>{t.type === "buy" ? "Mua" : "Bán"}</span>
                    <span className="font-semibold">{a?.symbol ?? t.assetId}</span>
                    <span className="tabular-nums text-muted">
                      {a?.class === "savings"
                        ? `${fmtVnd(t.quantity)} · lãi ${fmtPct(t.rate ?? defaultSavingsRate, 2)}`
                        : `${fmtNum(t.quantity, 4)} × ${a?.currency === "USD" ? "$" + fmtNum(t.price, 2) : fmtVnd(t.price)}`}
                    </span>
                    {t.note && <span className="text-muted italic truncate max-w-48">{t.note}</span>}
                    <button
                      type="button"
                      onClick={() => removeTx(t.id)}
                      className="ml-auto text-muted hover:text-down text-xs"
                      aria-label={`Xóa giao dịch ${a?.symbol ?? ""} ngày ${fmtDate(t.date)}`}
                    >
                      Xóa
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) {
  return (
    <div className="bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={cx(
          "text-lg sm:text-xl font-semibold tabular-nums mt-1",
          tone != null && Math.abs(tone) > 1e-4 && (tone > 0 ? "text-up" : "text-down"),
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted mt-0.5 tabular-nums">{sub}</div>}
    </div>
  );
}

function AddTransaction({ assets, defaultSavingsRate, today }: { assets: LiteAsset[]; defaultSavingsRate: number; today: string }) {
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const asset = assets.find((a) => a.id === assetId);
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(() => String(asset?.price ?? ""));
  const [fee, setFee] = useState("0");
  const [rate, setRate] = useState(String(Math.round(defaultSavingsRate * 1000) / 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const savings = asset?.class === "savings";

  const pickAsset = (id: string) => {
    setAssetId(id);
    const a = assets.find((x) => x.id === id);
    setPrice(a?.class === "savings" ? "1" : String(a?.price ?? ""));
  };

  return (
    <section aria-labelledby="h-add">
      <h2 id="h-add" className="font-display text-2xl font-semibold mb-3">
        Thêm giao dịch
      </h2>
      <form
        className="rounded-xl border border-line bg-surface p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const q = Number(quantity);
          const p = savings ? 1 : Number(price);
          if (!asset) return setError("Hãy chọn tài sản.");
          if (!(q > 0)) return setError("Số lượng phải lớn hơn 0.");
          if (!(p > 0)) return setError("Giá phải lớn hơn 0.");
          if (date > today) return setError("Ngày giao dịch không được ở tương lai.");
          const tx: Transaction = {
            id: crypto.randomUUID(),
            assetId,
            type,
            date,
            quantity: q,
            price: p,
            fee: Number(fee) || 0,
            ...(savings ? { rate: Number(rate) / 100 } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          };
          updateState((s) => ({ ...s, transactions: [...s.transactions, tx] }));
          setQuantity("");
          setNote("");
          setError("");
        }}
      >
        <Field label="Tài sản">
          <select value={assetId} onChange={(e) => pickAsset(e.target.value)} className={inputCls}>
            {CLASS_ORDER.map((c) => (
              <optgroup key={c} label={CLASS_LABELS[c]}>
                {assets
                  .filter((a) => a.class === c)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.symbol} – {a.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted" id="tx-type">
            Loại
          </span>
          <div className="flex rounded-lg border border-line p-0.5" role="radiogroup" aria-labelledby="tx-type">
            {(["buy", "sell"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={cx("flex-1 rounded-md py-1.5 text-sm", type === t ? "bg-ink text-paper font-semibold" : "text-muted")}
              >
                {savings ? (t === "buy" ? "Gửi" : "Rút") : t === "buy" ? "Mua" : "Bán"}
              </button>
            ))}
          </div>
        </div>
        <Field label="Ngày">
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
        </Field>
        <Field label={quantityLabel(asset)}>
          <input type="number" inputMode="decimal" step="any" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} required />
        </Field>
        {savings ? (
          <Field label="Lãi suất (%/năm)">
            <input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} />
          </Field>
        ) : (
          <Field label={`Giá mỗi đơn vị (${asset?.currency === "USD" ? "USD" : asset?.class === "gold" ? "VND/lượng" : "VND"})`}>
            <input type="number" inputMode="decimal" step="any" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} required />
          </Field>
        )}
        <Field label={`Phí (${asset?.currency ?? "VND"})`}>
          <input type="number" inputMode="decimal" step="any" min="0" value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Ghi chú (không bắt buộc)" className="sm:col-span-2 lg:col-span-1">
          <input type="text" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>
        <div className="flex flex-col justify-end gap-1">
          <button type="submit" className="rounded-lg bg-jade text-on-jade font-semibold px-4 py-2.5 hover:opacity-90">
            {savings ? (type === "buy" ? "Thêm khoản gửi" : "Thêm khoản rút") : type === "buy" ? "Thêm lệnh mua" : "Thêm lệnh bán"}
          </button>
        </div>
        {error && (
          <p role="alert" className="sm:col-span-2 lg:col-span-4 text-sm text-down">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

const inputCls = "w-full rounded-lg border border-line bg-paper px-3 py-2 tabular-nums";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1 text-sm", className)}>
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}
