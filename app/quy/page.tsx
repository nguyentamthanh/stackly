import type { Metadata } from "next";
import { FundRanking } from "@/components/FundRanking";
import { getFundAlerts, getFundBenchmarks, getFundHistory, getLatestFunds } from "@/lib/fund-data";
import { countByLevel } from "@/lib/fund-alerts";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Xếp hạng quỹ mở" };

export default async function FundsPage() {
  const data = await getLatestFunds();
  const alerts = getFundAlerts(data.funds);
  const counts = countByLevel(alerts);
  // Quỹ có nhiều cảnh báo nghiêm trọng nhất, hiển thị nổi bật phía trên bảng
  const worst = data.funds
    .map((f) => ({ f, high: (alerts[f.code] ?? []).filter((a) => a.level === "high") }))
    .filter((x) => x.high.length)
    .sort((a, b) => b.high.length - a.high.length || a.f.code.localeCompare(b.f.code))
    .slice(0, 6);
  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Xếp hạng quỹ mở</h1>
        <p className="mt-3 text-muted leading-relaxed">
          Các quỹ mở đang phân phối tại Việt Nam, xếp theo lợi nhuận NAV đã trừ phí quản lý. Quỹ cổ phiếu và cân bằng được so với
          VN-Index, quỹ trái phiếu so với lãi tiết kiệm cùng kỳ. Quỹ mở là cách đơn giản để áp dụng các kiểu đầu tư mà không phải tự chọn
          cổ phiếu.
        </p>
        <p className="mt-3 text-sm text-muted">
          {data.funds.length} quỹ · Nguồn{" "}
          <a href="https://fmarket.vn" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
            Fmarket
          </a>{" "}
          · {data.source === "fmarket" ? "cập nhật" : "bản lưu"} {fmtDateTime(data.updatedAt)}
          {data.source === "fmarket" ? ", tự làm mới mỗi giờ" : " (chưa gọi được Fmarket, đang dùng bản lưu gần nhất)"}
        </p>
      </header>
      {data.funds.length > 0 && (
        <section aria-labelledby="h-alerts" className="rounded-xl border border-line bg-surface p-4 sm:p-5 flex flex-col gap-3">
          <h2 id="h-alerts" className="font-display text-xl font-semibold">
            Cảnh báo quỹ
          </h2>
          <p className="text-sm">
            <strong className="text-down">{counts.high} quỹ</strong> có cảnh báo nghiêm trọng, <strong className="text-t-expensive">{counts.medium} quỹ</strong> cần
            lưu ý, {counts.info} quỹ chỉ có thông tin (quỹ mới, giảm theo thị trường). Mở từng quỹ trong bảng để xem chi tiết, hoặc lọc theo mức cảnh báo.
          </p>
          {worst.length > 0 && (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              {worst.map(({ f, high }) => (
                <li key={f.code} className="rounded-lg bg-paper px-3 py-2">
                  <span className="font-semibold">{f.code}</span> <span className="text-xs text-muted">{f.manager}</span>
                  <span className="block text-xs text-down">{high.length} nghiêm trọng</span>
                  <span className="block text-xs text-muted">{high[0].title}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted max-w-prose">
            Cảnh báo là quy tắc cố định trên dữ liệu quá khứ: so với VN-Index hoặc lãi tiết kiệm, sụt giảm từ đỉnh (phân biệt giảm theo thị trường), biến động, phí và thứ hạng
            trong nhóm cùng loại. Không phải dự báo, và một quỹ có cảnh báo vẫn có thể phục hồi.
          </p>
        </section>
      )}
      {data.funds.length ? (
        <FundRanking funds={data.funds} benchmarks={getFundBenchmarks()} alerts={alerts} history={getFundHistory()} />
      ) : (
        <p className="text-muted">Chưa lấy được danh sách quỹ. Vui lòng thử lại sau.</p>
      )}
      <p className="text-xs text-muted max-w-prose">
        Lợi nhuận quá khứ không bảo đảm tương lai. Thứ hạng ngắn hạn thay đổi liên tục; khi chọn quỹ nên xem lợi nhuận 3–5 năm, mức phí,
        quy mô và đội ngũ quản lý. Dữ liệu cũng có sẵn dạng JSON tại <code className="font-mono">/api/quy?ky=y1&amp;loai=STOCK</code>.
      </p>
    </div>
  );
}
