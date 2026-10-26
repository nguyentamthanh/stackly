"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LiteAsset } from "@/lib/client-data";
import { fmtNum, fmtPct, fmtVnd, fmtVndShort } from "@/lib/format";
import type { AssetDetail } from "@/lib/types";
import { cx } from "@/lib/ui";
import { BacktestPanel } from "./BacktestPanel";
import { MoneyInput } from "./MoneyInput";

export interface ReturnPreset {
  label: string;
  rate: number;
  since: string;
}

const inputCls = "w-full rounded-lg border border-line bg-paper px-3 py-2 tabular-nums";

export function NumField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="relative">
        {suffix === "VND" ? (
          <MoneyInput value={value} onValueChange={(v) => onChange(Math.max(min, Number(v) || 0))} className={cx(inputCls, "pr-14")} />
        ) : (
          <input
            type="number"
            inputMode="decimal"
            value={value}
            step={step}
            min={min}
            onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
            className={cx(inputCls, suffix && "pr-14")}
          />
        )}
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">{suffix}</span>}
      </span>
    </label>
  );
}

/** Mô phỏng góp hằng tháng với lãi kép theo tháng. */
function project(initial: number, monthly: number, annualRate: number, years: number) {
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  const points: { year: number; contributed: number; value: number }[] = [{ year: 0, contributed: initial, value: initial }];
  let value = initial;
  let contributed = initial;
  for (let m = 1; m <= years * 12; m++) {
    value = value * (1 + r) + monthly;
    contributed += monthly;
    if (m % 12 === 0) points.push({ year: m / 12, contributed, value });
  }
  return points;
}

export function Tools({
  presets,
  assets,
  usdVnd,
  savingsRate,
}: {
  presets: ReturnPreset[];
  assets: LiteAsset[];
  usdVnd: number;
  savingsRate: number;
}) {
  return (
    <div className="flex flex-col gap-12">
      <Compound presets={presets} />
      <Fire />
      <CustomBacktest assets={assets} usdVnd={usdVnd} savingsRate={savingsRate} />
    </div>
  );
}

function Compound({ presets }: { presets: ReturnPreset[] }) {
  const [initial, setInitial] = useState(10_000_000);
  const [monthly, setMonthly] = useState(5_000_000);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(15);
  const points = useMemo(() => project(initial, monthly, rate / 100, Math.min(years, 60)), [initial, monthly, rate, years]);
  const last = points.at(-1)!;

  return (
    <section aria-labelledby="h-compound" className="flex flex-col gap-4">
      <h2 id="h-compound" className="font-display text-2xl font-semibold">
        Tích sản bao nhiêu năm thì được bao nhiêu?
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <NumField label="Vốn ban đầu" value={initial} onChange={setInitial} step={1_000_000} suffix="VND" />
        <NumField label="Góp mỗi tháng" value={monthly} onChange={setMonthly} step={500_000} suffix="VND" />
        <NumField label="Lợi nhuận kỳ vọng" value={rate} onChange={setRate} step={0.5} suffix="%/năm" />
        <NumField label="Số năm" value={years} onChange={setYears} min={1} suffix="năm" />
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted self-center">Lợi nhuận lịch sử:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setRate(Math.round(p.rate * 1000) / 10)}
            className="rounded-full border border-line px-3 py-1 hover:border-muted"
            title={p.since}
          >
            {p.label} {fmtPct(p.rate, 1)}
          </button>
        ))}
      </div>
      <p className="text-lg">
        Sau {years} năm bạn có khoảng <strong className="text-jade">{fmtVnd(last.value)}</strong>, trong đó tiền tự góp là{" "}
        {fmtVnd(last.contributed)} và tiền lãi sinh ra là {fmtVnd(last.value - last.contributed)}.
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="year" stroke="var(--muted)" fontSize={12} tickFormatter={(y: number) => `${y} năm`} minTickGap={30} />
            <YAxis stroke="var(--muted)" fontSize={12} tickFormatter={(v: number) => fmtVndShort(v)} width={56} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}
              labelFormatter={(y) => `Năm thứ ${y}`}
              formatter={(v, name) => [fmtVnd(Number(v)), name]}
            />
            <Area type="monotone" dataKey="value" name="Tổng tài sản" stroke="var(--jade)" fill="var(--jade)" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="contributed" name="Tiền tự góp" stroke="var(--muted)" fill="var(--muted)" fillOpacity={0.1} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted">Chưa tính lạm phát và thuế phí. Lợi nhuận lịch sử không đảm bảo lặp lại.</p>
    </section>
  );
}

function Fire() {
  const [expenses, setExpenses] = useState(15_000_000);
  const [current, setCurrent] = useState(100_000_000);
  const [monthly, setMonthly] = useState(8_000_000);
  const [rate, setRate] = useState(8);
  const [withdraw, setWithdraw] = useState(4);

  const target = (expenses * 12) / (withdraw / 100);
  const r = Math.pow(1 + rate / 100, 1 / 12) - 1;
  let months = 0;
  let value = current;
  while (value < target && months < 12 * 80) {
    value = value * (1 + r) + monthly;
    months++;
  }
  const reachable = value >= target;

  return (
    <section aria-labelledby="h-fire" className="flex flex-col gap-4">
      <h2 id="h-fire" className="font-display text-2xl font-semibold">
        Cần bao nhiêu để tự do tài chính?
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <NumField label="Chi tiêu mỗi tháng" value={expenses} onChange={setExpenses} step={1_000_000} suffix="VND" />
        <NumField label="Tài sản hiện có" value={current} onChange={setCurrent} step={10_000_000} suffix="VND" />
        <NumField label="Tích sản mỗi tháng" value={monthly} onChange={setMonthly} step={500_000} suffix="VND" />
        <NumField label="Lợi nhuận kỳ vọng" value={rate} onChange={setRate} step={0.5} suffix="%/năm" />
        <NumField label="Tỷ lệ rút an toàn" value={withdraw} onChange={setWithdraw} step={0.5} min={1} suffix="%/năm" />
      </div>
      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col sm:flex-row gap-6">
        <div>
          <div className="text-sm text-muted">Số tiền cần có</div>
          <div className="font-display text-3xl font-semibold tabular-nums">{fmtVndShort(target)}</div>
        </div>
        <div>
          <div className="text-sm text-muted">Thời gian ước tính</div>
          <div className="font-display text-3xl font-semibold tabular-nums">
            {reachable ? (months === 0 ? "Đã đạt" : `${fmtNum(Math.floor(months / 12))} năm ${months % 12} tháng`) : "Trên 80 năm"}
          </div>
        </div>
      </div>
      <p className="text-sm text-muted max-w-prose">
        Quy tắc {fmtNum(withdraw, 1)}%: khi tài sản đủ lớn để mỗi năm rút {fmtNum(withdraw, 1)}% mà vẫn trang trải được chi tiêu, bạn có thể
        sống bằng tài sản. Đây là ước tính đơn giản, chưa tính lạm phát làm chi tiêu tăng theo thời gian.
      </p>
    </section>
  );
}

function CustomBacktest({ assets, usdVnd, savingsRate }: { assets: LiteAsset[]; usdVnd: number; savingsRate: number }) {
  const [id, setId] = useState(assets.find((a) => a.id === "e1vfvn30")?.id ?? assets[0]?.id);
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [error, setError] = useState("");
  const asset = assets.find((a) => a.id === id);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/data/assets/${id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Không tải được dữ liệu (${r.status})`);
        return r.json() as Promise<AssetDetail>;
      })
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setError("");
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <section aria-labelledby="h-bt" className="flex flex-col gap-4">
      <h2 id="h-bt" className="font-display text-2xl font-semibold">
        Thử tích sản theo điểm với tài sản khác
      </h2>
      <label className="flex flex-col gap-1 text-sm max-w-xs">
        <span className="text-muted">Tài sản</span>
        <select value={id} onChange={(e) => setId(e.target.value)} className={inputCls}>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.symbol} – {a.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-down text-sm">{error}</p>}
      {detail && asset && detail.id === id ? (
        <BacktestPanel key={id} bars={detail.bars} scores={detail.scoreHistory} currency={asset.currency} usdVnd={usdVnd} defaultCashRate={savingsRate} />
      ) : (
        !error && <div className="h-64 rounded-xl bg-surface border border-line animate-pulse" aria-busy="true" />
      )}
    </section>
  );
}
