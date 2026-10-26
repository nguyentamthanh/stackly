import type { Metadata } from "next";
import { RebalanceTool } from "@/components/RebalanceTool";
import { StrategyChart } from "@/components/StrategyChart";
import { BacktestNote, PerfCell, StrategyHeader } from "@/components/StrategyBits";
import { CLASS_LABELS, CLASS_ORDER } from "@/lib/assets";
import { fmtPct } from "@/lib/format";
import { FIXED_PRESETS, getStrategy, REBALANCE_LABELS } from "@/lib/strategies";
import { getFixedBacktests } from "@/lib/strategy-data";
import { CLASS_COLOR } from "@/lib/ui";

export const metadata: Metadata = { title: "Danh mục cố định" };

const PRESET_COLOR = ["--jade", "--t-very-cheap", "--t-expensive"];

export default function FixedPage() {
  const info = getStrategy("co-dinh")!;
  const rows = getFixedBacktests();
  const yearly = FIXED_PRESETS.map((p, k) => ({ p, k, r: rows.find((x) => x.presetId === p.id && x.mode === "yearly")?.result }));
  const start = yearly.find((y) => y.r)?.r?.start;

  return (
    <div className="flex flex-col gap-10">
      <StrategyHeader info={info} />

      <section aria-labelledby="h-presets" className="flex flex-col gap-4">
        <h2 id="h-presets" className="font-display text-2xl font-semibold">
          Ba mẫu tỷ trọng
        </h2>
        <ul className="grid md:grid-cols-3 gap-3">
          {FIXED_PRESETS.map((p) => (
            <li key={p.id} className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-3">
              <h3 className="font-display text-lg font-semibold">{p.name}</h3>
              <div className="flex h-3 rounded-full overflow-hidden" aria-hidden>
                {CLASS_ORDER.filter((c) => p.weights[c] > 0).map((c) => (
                  <span key={c} style={{ width: `${p.weights[c] * 100}%`, background: CLASS_COLOR[c] }} />
                ))}
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {CLASS_ORDER.filter((c) => p.weights[c] > 0).map((c) => (
                  <li key={c} className="flex justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <span className="size-2 rounded-sm" style={{ background: CLASS_COLOR[c] }} aria-hidden />
                      {CLASS_LABELS[c]}
                    </span>
                    <span className="tabular-nums font-medium">{fmtPct(p.weights[c], 0)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">{p.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h-fixed-bt" className="flex flex-col gap-4">
        <div>
          <h2 id="h-fixed-bt" className="font-display text-2xl font-semibold">
            Nếu đã làm từ trước
          </h2>
          <p className="text-sm text-muted mt-1 max-w-prose">
            Đại diện từng kênh: ETF E1VFVN30, ETF SPY (quy đổi VND), vàng thế giới quy đổi VND, Bitcoin. Tái cân bằng giúp giới hạn mức sụt
            giảm khi một kênh tăng nóng rồi đảo chiều.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="text-muted text-left">
              <tr>
                <th className="font-normal px-4 py-3">Mẫu</th>
                {(["none", "yearly", "band"] as const).map((m) => (
                  <th key={m} className="font-normal px-4 py-3 text-right">
                    {REBALANCE_LABELS[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {FIXED_PRESETS.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  {(["none", "yearly", "band"] as const).map((m) => (
                    <td key={m} className="px-4 py-3 text-right">
                      <PerfCell stats={rows.find((x) => x.presetId === p.id && x.mode === m)?.result?.stats} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {yearly.some((y) => y.r) && (
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="text-sm text-muted mb-2">Giá trị danh mục khi góp 5 triệu/tháng, tái cân bằng hằng năm</h3>
            <StrategyChart
              lines={yearly.flatMap(({ p, k, r }) => (r ? [{ name: p.name, data: r.series, color: PRESET_COLOR[k] }] : []))}
            />
          </div>
        )}
        <BacktestNote start={start} />
      </section>

      <section aria-labelledby="h-rebalance" className="flex flex-col gap-4">
        <div>
          <h2 id="h-rebalance" className="font-display text-2xl font-semibold">
            Tái cân bằng danh mục của bạn
          </h2>
          <p className="text-sm text-muted mt-1 max-w-prose">Nhập số tiền đang có ở từng kênh, app tính cần mua hoặc bán bao nhiêu.</p>
        </div>
        <RebalanceTool />
      </section>
    </div>
  );
}
