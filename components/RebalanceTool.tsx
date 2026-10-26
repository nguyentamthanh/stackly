"use client";

import { useMemo, useState } from "react";
import { CLASS_LABELS } from "@/lib/assets";
import { fmtPct, fmtVnd } from "@/lib/format";
import { FIXED_PRESETS, rebalancePlan } from "@/lib/strategies";
import type { AssetClass } from "@/lib/types";
import { CLASS_COLOR, cx } from "@/lib/ui";
import { MoneyInput } from "./MoneyInput";

const CLASSES: AssetClass[] = ["vn", "us", "gold", "crypto", "savings"];
const inputCls = "w-full rounded-lg border border-line bg-paper px-3 py-2 tabular-nums";

const EMPTY: Record<AssetClass, number> = { vn: 0, us: 0, gold: 0, crypto: 0, savings: 0 };

/** Nhập giá trị hiện có từng kênh → số tiền mua/bán để về tỷ trọng mẫu đã chọn */
export function RebalanceTool() {
  const [presetId, setPresetId] = useState(FIXED_PRESETS[0].id);
  const [current, setCurrent] = useState<Record<AssetClass, number>>({ ...EMPTY, vn: 40_000_000, gold: 30_000_000, savings: 50_000_000 });
  const [newMoney, setNewMoney] = useState(10_000_000);
  const [allowSell, setAllowSell] = useState(false);

  const preset = FIXED_PRESETS.find((p) => p.id === presetId)!;
  const plan = useMemo(() => rebalancePlan(current, preset.weights, newMoney, allowSell), [current, preset, newMoney, allowSell]);
  const totalNow = CLASSES.reduce((a, c) => a + current[c], 0);
  const totalAfter = totalNow + newMoney;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mẫu tỷ trọng">
        {FIXED_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === presetId}
            onClick={() => setPresetId(p.id)}
            className={cx(
              "rounded-lg border px-3 py-2 text-sm",
              p.id === presetId ? "border-jade bg-jade-soft font-semibold" : "border-line text-muted hover:text-ink",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CLASSES.map((c) => (
          <label key={c} className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{CLASS_LABELS[c]} đang có</span>
            <MoneyInput
              value={current[c]}
              onValueChange={(v) => setCurrent({ ...current, [c]: Math.max(0, Number(v) || 0) })}
              className={inputCls}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Tiền mới bỏ thêm</span>
          <MoneyInput
            value={newMoney}
            onValueChange={(v) => setNewMoney(Math.max(0, Number(v) || 0))}
            className={inputCls}
          />
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm w-fit">
        <input type="checkbox" checked={allowSell} onChange={(e) => setAllowSell(e.target.checked)} className="size-4 accent-[var(--jade)]" />
        Cho phép bán bớt kênh đang thừa (tái cân bằng toàn bộ)
      </label>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead className="text-muted text-left">
            <tr>
              <th className="font-normal py-2 pr-3">Kênh</th>
              <th className="font-normal py-2 px-3 text-right">Hiện tại</th>
              <th className="font-normal py-2 px-3 text-right">Mục tiêu</th>
              <th className="font-normal py-2 px-3 text-right">Nên làm</th>
              <th className="font-normal py-2 pl-3 text-right">Sau khi làm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CLASSES.filter((c) => preset.weights[c] > 0 || current[c] > 0).map((c) => {
              const amt = plan[c] ?? 0;
              const after = current[c] + amt;
              return (
                <tr key={c}>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className="size-2.5 rounded-sm" style={{ background: CLASS_COLOR[c] }} aria-hidden />
                      {CLASS_LABELS[c]}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">{totalNow ? fmtPct(current[c] / totalNow, 0) : "—"}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{fmtPct(preset.weights[c], 0)}</td>
                  <td className={cx("py-2 px-3 text-right tabular-nums font-semibold", amt > 0.5 ? "text-up" : amt < -0.5 ? "text-down" : "text-muted")}>
                    {amt > 0.5 ? `Mua ${fmtVnd(amt)}` : amt < -0.5 ? `Bán ${fmtVnd(-amt)}` : "Giữ nguyên"}
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums">{totalAfter ? fmtPct(after / totalAfter, 0) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        {allowSell
          ? "Bán phần thừa có thể phát sinh thuế, phí và chênh lệch mua–bán (nhất là vàng). Thường chỉ nên làm mỗi năm một lần."
          : "Chỉ dùng tiền mới để lấp kênh đang thiếu: không tốn phí bán, danh mục tự về dần tỷ trọng mục tiêu."}
      </p>
    </div>
  );
}
