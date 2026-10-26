import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PriceChart, ScoreChart } from "@/components/AssetCharts";
import { BacktestPanel } from "@/components/BacktestPanel";
import { Change, ScoreBadge, ScoreBar, StaleNote } from "@/components/bits";
import { ASSETS, CLASS_LABELS, getAsset } from "@/lib/assets";
import { averageRate12m, getAssetDetail, getGoldHistory, getSavings, getSignals } from "@/lib/data";
import { fmtDate, fmtNum, fmtPct, fmtPrice, fmtVnd } from "@/lib/format";
import { scoreColor } from "@/lib/ui";

export function generateStaticParams() {
  return ASSETS.map((a) => ({ id: a.id }));
}

export async function generateMetadata({ params }: PageProps<"/tai-san/[id]">): Promise<Metadata> {
  const { id } = await params;
  const asset = getAsset(id);
  return { title: asset ? `${asset.symbol} – ${asset.name}` : "Không tìm thấy" };
}

export default function AssetPage({ params }: PageProps<"/tai-san/[id]">) {
  // Bọc Suspense để chuyển trang giữa các tài sản hiện khung ngay, nội dung theo id điền vào sau
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <AssetContent params={params} />
    </Suspense>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="Đang tải">
      <div className="h-4 w-32 rounded bg-line" />
      <div className="h-10 w-2/3 max-w-md rounded bg-line" />
      <div className="h-4 w-full max-w-prose rounded bg-line" />
      <div className="mt-6 h-48 rounded-xl bg-line/60" />
    </div>
  );
}

async function AssetContent({ params }: { params: PageProps<"/tai-san/[id]">["params"] }) {
  const { id } = await params;
  const asset = getAsset(id);
  const { signals, usdVnd } = getSignals();
  const signal = signals.find((s) => s.id === id);
  if (!asset || !signal) notFound();

  const detail = getAssetDetail(id);
  const savings = getSavings();
  const color = scoreColor(signal.score);

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link href={`/#${asset.class}`} className="text-sm text-muted hover:text-ink w-fit">
          ← {CLASS_LABELS[asset.class]}
        </Link>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            {asset.name} <span className="text-muted text-xl sm:text-2xl font-medium">{asset.symbol}</span>
          </h1>
          <StaleNote show={signal.stale} />
        </div>
        <p className="text-muted max-w-prose">{asset.description}</p>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 mt-1">
          <div>
            <dt className="text-xs text-muted">{asset.class === "savings" ? "Lãi suất 12 tháng TB" : `Giá (${asset.unit})`}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{fmtPrice(signal.price, asset.currency, asset.unit)}</dd>
          </div>
          {asset.class !== "savings" && (
            <>
              <div>
                <dt className="text-xs text-muted">1 ngày</dt>
                <dd className="text-lg tabular-nums">
                  <Change value={signal.change1d} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">1 tháng</dt>
                <dd className="text-lg tabular-nums">
                  <Change value={signal.change1m} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">1 năm</dt>
                <dd className="text-lg tabular-nums">
                  <Change value={signal.change1y} />
                </dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-xs text-muted">Ngày dữ liệu</dt>
            <dd className="text-lg tabular-nums">{fmtDate(signal.asOf)}</dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="h-score" className="grid lg:grid-cols-[300px_1fr] gap-6 lg:gap-10">
        <div className="rounded-xl border-l-4 bg-surface p-5 flex flex-col gap-3 self-start" style={{ borderColor: color }}>
          <h2 id="h-score" className="text-sm text-muted">
            Điểm hấp dẫn tích sản
          </h2>
          <ScoreBadge score={signal.score} label={signal.label} size="lg" />
          <ScoreBar score={signal.score} />
          <p className="font-semibold mt-1">{signal.action}</p>
          {!asset.investable && <p className="text-sm text-muted">Đây là chỉ số tham chiếu. Có thể tích sản qua các quỹ ETF mô phỏng chỉ số.</p>}
        </div>
        <div>
          <h3 className="font-display text-xl font-semibold mb-3">Vì sao có điểm này?</h3>
          <ul className="flex flex-col divide-y divide-line">
            {signal.components.map((c) => (
              <li key={c.key} className="py-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                <span className="font-medium">
                  {c.name} <span className="text-muted font-normal tabular-nums">· {c.display}</span>
                </span>
                <span className="text-sm tabular-nums" style={{ color: scoreColor(c.score) }}>
                  {fmtNum(c.score, 0)} điểm <span className="text-muted">× {fmtNum(c.weight, 0)}%</span>
                </span>
                <ScoreBar score={c.score} className="col-span-2" />
                <p className="col-span-2 text-sm text-muted">{c.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {asset.class === "savings" ? (
        <section aria-labelledby="h-rates">
          <h2 id="h-rates" className="font-display text-2xl font-semibold mb-1">
            Lãi suất tiết kiệm online
          </h2>
          <p className="text-sm text-muted mb-4 max-w-prose">
            Cập nhật {fmtDate(savings.updatedAt)}. Lạm phát giả định {fmtPct(savings.inflation)}. {savings.note}
          </p>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="text-muted text-left">
                <tr>
                  <th className="font-normal px-4 py-2">Ngân hàng</th>
                  <th className="font-normal px-4 py-2 text-right">6 tháng</th>
                  <th className="font-normal px-4 py-2 text-right">12 tháng</th>
                  <th className="font-normal px-4 py-2 text-right">24 tháng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...savings.rates]
                  .sort((a, b) => b.m12 - a.m12)
                  .map((r) => (
                    <tr key={r.bank}>
                      <td className="px-4 py-2 font-medium">{r.bank}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtPct(r.m6, 2)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmtPct(r.m12, 2)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.m24 ? fmtPct(r.m24, 2) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        detail && (
          <>
            <section aria-labelledby="h-chart">
              <h2 id="h-chart" className="font-display text-2xl font-semibold mb-1">
                Biểu đồ giá
              </h2>
              {asset.class === "gold" ? (
                <GoldNote id={id} />
              ) : (
                <p className="text-sm text-muted mb-3">Nguồn: {detail.source}. Đường MA200 là xu hướng dài hạn khoảng 10 tháng.</p>
              )}
              <PriceChart
                bars={detail.bars}
                domestic={detail.domestic}
                mainLabel={asset.class === "gold" ? "Thế giới quy đổi (VND/lượng)" : "Giá"}
              />
            </section>

            <section aria-labelledby="h-history">
              <h2 id="h-history" className="font-display text-2xl font-semibold mb-1">
                Lịch sử điểm hấp dẫn
              </h2>
              <p className="text-sm text-muted mb-3 max-w-prose">
                Điểm tính lại cho từng tuần trong quá khứ, chỉ dùng dữ liệu có tại thời điểm đó. Các đường chấm là ngưỡng 20, 40, 60,
                80.
              </p>
              <ScoreChart scores={detail.scoreHistory} />
            </section>

            <section aria-labelledby="h-backtest">
              <h2 id="h-backtest" className="font-display text-2xl font-semibold mb-1">
                Nếu đã tích sản theo điểm từ trước
              </h2>
              <p className="text-sm text-muted mb-4 max-w-prose">So sánh mua đều mỗi tháng với mua nhiều hơn khi rẻ, ít hơn khi đắt.</p>
              <BacktestPanel
                bars={detail.bars}
                scores={detail.scoreHistory}
                currency={asset.currency}
                usdVnd={usdVnd}
                defaultCashRate={averageRate12m(savings)}
              />
            </section>
          </>
        )
      )}
    </article>
  );
}

function GoldNote({ id }: { id: string }) {
  const hist = getGoldHistory();
  const last = hist.at(-1);
  if (!last) return null;
  const sell = id === "vang-sjc" ? last.sjcSell : last.ringSell;
  const buy = id === "vang-sjc" ? last.sjcBuy : last.ringBuy;
  return (
    <p className="text-sm text-muted mb-3 max-w-prose">
      Giá trong nước ({fmtDate(last.date)}, nguồn PNJ): mua vào {fmtVnd(buy)}, bán ra {fmtVnd(sell)}, chênh lệch mua–bán{" "}
      {fmtPct(sell / buy - 1)}. Biểu đồ dùng giá vàng thế giới quy đổi theo tỷ giá USD/VND vì lịch sử giá trong nước chỉ được tích lũy
      từ ngày app bắt đầu chạy.
    </p>
  );
}
