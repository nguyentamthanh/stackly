import { fmtPct } from "@/lib/format";
import { monthLabel, yearInsights, type MonthlyRow } from "@/lib/monthly";
import { cx } from "@/lib/ui";

/** Màu nền ô theo mức lợi nhuận: càng xa 0 càng đậm (đủ đậm ở ±10%/tháng) */
function heat(ret: number | null): React.CSSProperties | undefined {
  if (ret == null) return undefined;
  const strength = Math.round(Math.min(Math.abs(ret) / 0.1, 1) * 50);
  return { background: `color-mix(in srgb, ${ret >= 0 ? "var(--up)" : "var(--down)"} ${strength}%, transparent)` };
}

/** Bảng 12 tháng gần nhất của từng kênh kèm nhận xét cả năm. Tháng cuối là tháng đang diễn ra. */
export function YearReview({ rows, asOf }: { rows: MonthlyRow[]; asOf: string }) {
  if (!rows.length) return null;
  const months = rows[0].months.map((m) => m.month);
  const insights = yearInsights(rows);
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-xs min-w-[920px]">
          <thead className="text-muted">
            <tr>
              <th className="font-normal text-left px-3 py-2 sticky left-0 bg-surface">Kênh</th>
              {months.map((m, i) => (
                <th key={m} className="font-normal px-1 py-2 text-right whitespace-nowrap">
                  {monthLabel(m)}
                  {i === months.length - 1 && "*"}
                </th>
              ))}
              <th className="font-normal px-2 py-2 text-right whitespace-nowrap">12 tháng</th>
              <th className="font-normal px-2 py-2 text-right whitespace-nowrap">Từ đầu năm</th>
              <th className="font-normal px-2 py-2 text-right whitespace-nowrap">Tháng dương</th>
              <th className="font-normal px-2 py-2 text-right whitespace-nowrap">Sụt tối đa</th>
              <th className="font-normal px-2 py-2 text-right whitespace-nowrap">Biến động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <th className="font-medium text-left px-3 py-2 sticky left-0 bg-surface whitespace-nowrap text-sm">{r.label}</th>
                {r.months.map((m) => (
                  <td key={m.month} className="px-1 py-2 text-right tabular-nums" style={heat(m.ret)}>
                    {m.ret == null ? "—" : fmtPct(m.ret, 1, true)}
                  </td>
                ))}
                <td className={cx("px-2 py-2 text-right tabular-nums font-semibold", (r.total ?? 0) >= 0 ? "text-up" : "text-down")}>{fmtPct(r.total, 1, true)}</td>
                <td className={cx("px-2 py-2 text-right tabular-nums", (r.ytd ?? 0) >= 0 ? "text-up" : "text-down")}>{fmtPct(r.ytd, 1, true)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.counted ? `${r.positive}/${r.counted}` : "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums text-down">{r.maxDrawdown ? fmtPct(r.maxDrawdown, 1) : "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted">{r.vol ? fmtPct(r.vol, 0) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        * Tháng đang diễn ra, tính đến {asOf.split("-").reverse().join("/")}. Giá quy đổi VND theo tỷ giá từng ngày. Sụt tối đa là mức giảm lớn nhất từ đỉnh trong 12 tháng; biến động
        là độ lệch chuẩn lợi nhuận tháng quy theo năm.
      </p>
      {insights.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm list-disc pl-5">
          {insights.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
