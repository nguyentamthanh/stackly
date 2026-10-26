"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { backtestDca } from "@/lib/backtest";
import { fmtDate, fmtPct, fmtVnd, fmtVndShort } from "@/lib/format";
import type { Bar, Currency } from "@/lib/types";
import { cx } from "@/lib/ui";
import { MoneyInput } from "./MoneyInput";

export function BacktestPanel({
  bars,
  scores,
  currency,
  usdVnd,
  defaultCashRate,
}: {
  bars: Bar[];
  scores: Bar[];
  currency: Currency;
  usdVnd: number;
  defaultCashRate: number;
}) {
  const years = useMemo(() => [...new Set(scores.map((s) => s[0].slice(0, 4)))], [scores]);
  const [startYear, setStartYear] = useState(years[0] ?? "");
  const [monthly, setMonthly] = useState(5_000_000);
  const [cashRate, setCashRate] = useState(Math.round(defaultCashRate * 1000) / 10);

  // Giá USD quy đổi theo tỷ giá hiện tại (chưa tính biến động tỷ giá trong quá khứ)
  const fx = currency === "USD" ? usdVnd : 1;
  const result = useMemo(
    () =>
      backtestDca({
        bars: fx === 1 ? bars : bars.map(([d, p]) => [d, p * fx] as Bar),
        scores,
        monthly,
        cashRate: cashRate / 100,
        start: `${startYear}-01-01`,
      }),
    [bars, scores, monthly, cashRate, startYear, fx],
  );

  if (!scores.length) return <p className="text-muted">Chưa đủ lịch sử để chạy backtest.</p>;

  const diff = result.smart.finalValue - result.plain.finalValue;
  const rows: { label: string; plain: string; smart: string }[] = [
    { label: "Tổng tiền bỏ ra", plain: fmtVnd(result.plain.invested), smart: fmtVnd(result.smart.invested) },
    { label: "Giá trị hiện tại", plain: fmtVnd(result.plain.finalValue), smart: fmtVnd(result.smart.finalValue) },
    { label: "Lợi nhuận", plain: fmtPct(result.plain.totalReturn, 1, true), smart: fmtPct(result.smart.totalReturn, 1, true) },
    { label: "Tiền chờ còn lại (đã tính lãi)", plain: "—", smart: fmtVnd(result.smart.cash) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Tiền tích sản mỗi tháng (VND)</span>
          <MoneyInput
            value={monthly}
            onValueChange={(v) => setMonthly(Math.max(0, Number(v) || 0))}
            className="rounded-lg border border-line bg-paper px-3 py-2 tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Bắt đầu từ năm</span>
          <select value={startYear} onChange={(e) => setStartYear(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2">
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Lãi tiền chờ (%/năm)</span>
          <input
            type="number"
            min={0}
            max={20}
            step={0.1}
            value={cashRate}
            onChange={(e) => setCashRate(Number(e.target.value))}
            className="rounded-lg border border-line bg-paper px-3 py-2 tabular-nums"
          />
        </label>
      </div>

      <p className="text-base">
        Sau {result.months} tháng, tích sản theo điểm{" "}
        <strong className={diff >= 0 ? "text-up" : "text-down"}>
          {diff >= 0 ? "hơn" : "kém"} {fmtVnd(Math.abs(diff))}
        </strong>{" "}
        so với mua đều đặn ({fmtPct(diff / (result.plain.finalValue || 1), 1, true)}).
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-left">
              <th className="font-normal py-1.5"></th>
              <th className="font-normal py-1.5 text-right">Mua đều mỗi tháng</th>
              <th className="font-normal py-1.5 text-right">Mua theo điểm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="py-2 text-muted">{r.label}</td>
                <td className="py-2 text-right tabular-nums">{r.plain}</td>
                <td className={cx("py-2 text-right tabular-nums font-medium")}>{r.smart}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={result.series} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(0, 4)} stroke="var(--muted)" fontSize={12} minTickGap={40} />
            <YAxis tickFormatter={(v: number) => fmtVndShort(v)} stroke="var(--muted)" fontSize={12} width={56} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}
              labelFormatter={(d) => fmtDate(String(d))}
              formatter={(v, name) => [fmtVnd(Number(v)), name]}
            />
            <Line type="monotone" dataKey="invested" name="Tiền bỏ ra" stroke="var(--muted)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="plain" name="Mua đều" stroke="var(--t-neutral)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="smart" name="Mua theo điểm" stroke="var(--jade)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted max-w-prose">
        Mỗi tháng cả hai cách đều nhận cùng số tiền. Cách mua theo điểm nhân số tiền với hệ số tín hiệu (×0,5 đến ×2); phần chưa
        dùng nằm trong quỹ tiền chờ có lãi và chỉ được mua khi quỹ còn tiền. Kết quả quá khứ không đảm bảo cho tương lai
        {currency === "USD" ? "; giá USD quy đổi theo tỷ giá hiện tại" : ""}.
      </p>
    </div>
  );
}
