"use client";

import { useMemo, useState } from "react";
import { fmtDate, fmtPct, fmtVnd } from "@/lib/format";
import { lumpVsDca, type LumpCase } from "@/lib/strategies";
import type { Bar } from "@/lib/types";
import { cx } from "@/lib/ui";
import { MoneyInput } from "./MoneyInput";
import { StrategyChart } from "./StrategyChart";

export interface LumpAssetLite {
  id: string;
  label: string;
  monthly: Bar[];
}

const SPREADS = [3, 6, 12, 24];
const HORIZONS = [
  { months: 12, label: "1 năm" },
  { months: 36, label: "3 năm" },
  { months: 60, label: "5 năm" },
];

function Segmented<T extends number>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <div className="flex rounded-lg border border-line p-0.5 w-fit" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
            className={cx("px-3 py-1.5 rounded-md", value === o.v ? "bg-ink text-paper font-semibold" : "text-muted hover:text-ink")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LumpSumTool({ assets, cashRate }: { assets: LumpAssetLite[]; cashRate: number }) {
  const [assetId, setAssetId] = useState(assets.find((a) => a.id === "e1vfvn30")?.id ?? assets[0]?.id);
  const [amount, setAmount] = useState(500_000_000);
  const [spread, setSpread] = useState(12);
  const [horizon, setHorizon] = useState(36);
  const asset = assets.find((a) => a.id === assetId) ?? assets[0];

  const result = useMemo(
    () => (asset ? lumpVsDca({ monthly: asset.monthly, spread, horizon: Math.max(horizon, spread), cashRate }) : null),
    [asset, spread, horizon, cashRate],
  );
  const lines = useMemo(
    () =>
      result
        ? [
            { name: "Bỏ một lần", data: result.cases.map((c): Bar => [c.start, c.lump * amount]), color: "--jade" },
            { name: `Chia ${spread} tháng`, data: result.cases.map((c): Bar => [c.start, c.dca * amount]), color: "--t-expensive" },
          ]
        : [],
    [result, amount, spread],
  );

  const verdict = (r: NonNullable<typeof result>) => {
    if (r.lumpWinRate >= 0.6) return `Bỏ một lần thường thắng (${fmtPct(r.lumpWinRate, 0)} số lần), vì tài sản này tăng giá nhiều hơn lãi tiết kiệm trong phần lớn lịch sử.`;
    if (r.lumpWinRate <= 0.4) return `Chia nhỏ thường thắng (${fmtPct(1 - r.lumpWinRate, 0)} số lần) trên tài sản này.`;
    return "Hai cách gần như ngang nhau. Chia nhỏ giúp tránh mua trúng đỉnh và đỡ áp lực tâm lý.";
  };

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-4 sm:p-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Tài sản</span>
          <select value={asset?.id} onChange={(e) => setAssetId(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2">
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Số tiền (VND)</span>
          <MoneyInput
            value={amount}
            onValueChange={(v) => setAmount(Math.max(0, Number(v) || 0))}
            className="rounded-lg border border-line bg-paper px-3 py-2 tabular-nums"
          />
        </label>
        <Segmented label="Chia nhỏ trong" value={spread} onChange={setSpread} options={SPREADS.map((v) => ({ v, label: `${v} tháng` }))} />
        <Segmented label="Đo kết quả sau" value={horizon} onChange={setHorizon} options={HORIZONS.map((h) => ({ v: h.months, label: h.label }))} />
      </div>

      {!result ? (
        <p className="text-muted text-sm">Chưa đủ lịch sử giá cho kỳ hạn này. Hãy chọn kỳ hạn ngắn hơn.</p>
      ) : (
        <>
          <p className="font-medium">{verdict(result)}</p>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Bỏ một lần thắng" value={fmtPct(result.lumpWinRate, 0)} sub={`${result.cases.length} lần thử`} />
            <Stat label="Chênh lệch trung vị" value={fmtPct(result.medianEdge, 1, true)} sub="một lần so với chia nhỏ" />
            <Stat label="Bỏ một lần, trung bình" value={fmtVnd(result.avgLump * amount)} sub={`chia nhỏ: ${fmtVnd(result.avgDca * amount)}`} />
            <Stat
              label="Trường hợp xấu nhất"
              value={fmtVnd(result.worstLump.lump * amount)}
              sub={`một lần, bắt đầu ${fmtStart(result.worstLump)} · chia nhỏ: ${fmtVnd(result.worstDca.dca * amount)}`}
            />
          </dl>
          <div>
            <h3 className="text-sm text-muted mb-2">Giá trị sau {HORIZONS.find((h) => h.months === horizon)?.label} theo tháng bắt đầu</h3>
            <StrategyChart lines={lines} height={260} />
          </div>
        </>
      )}
    </div>
  );
}

function fmtStart(c: LumpCase): string {
  return fmtDate(c.start).slice(3);
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-paper p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted">{sub}</dd>
    </div>
  );
}
