# Stackly

Web app miễn phí so sánh **nhiều kiểu đầu tư** trên cùng dữ liệu thị trường, chia theo **kiểu đầu tư** và theo **kênh tài sản**:

| Kiểu | Ý tưởng | Trang |
|---|---|---|
| Tích sản theo điểm | Mua đều mỗi tháng, nhiều hơn khi rẻ (Điểm hấp dẫn 0–100) | `/kieu-dau-tu/tich-san` |
| Theo xu hướng | Nắm giữ khi giá > MA200 và lợi nhuận 12 tháng > 0, còn lại gửi tiết kiệm | `/kieu-dau-tu/xu-huong` |
| Bắt đáy | Gom tiền chờ, giải ngân khi giảm sâu so với lịch sử + RSI quá bán | `/kieu-dau-tu/bat-day` |
| Danh mục cố định | Bốn mùa / 60-40 / Tăng trưởng + tái cân bằng, có công cụ tính mua/bán | `/kieu-dau-tu/co-dinh` |
| Một lần hay chia nhỏ | Khoản tiền lớn: giải ngân ngay hay chia 3–24 tháng | `/kieu-dau-tu/mot-lan` |

Trang `/quy` xếp hạng các quỹ mở Việt Nam theo lợi nhuận 1 tháng → 5 năm (gọi API Fmarket, cache 1 giờ, dự phòng bằng `public/data/funds.json` do pipeline lưu mỗi ngày). JSON có tại `/api/quy?ky=y1&loai=STOCK`. Mỗi quỹ có cảnh báo theo quy tắc (thua VN-Index/tiết kiệm, NAV giảm, sụt sâu từ đỉnh, biến động cao, phí cao, quỹ mới…) dựa trên lịch sử NAV do pipeline lưu ở `public/data/fund-history.json`.

Trang `/muc-tieu` đặt mục tiêu tài sản 12 tháng: tính lợi suất cần có, xác suất đạt, kế hoạch từng tháng, nhập số dư thực tế để theo dõi tiến độ, kèm bảng lợi nhuận từng tháng của các kênh trong năm qua.

Mỗi kiểu có tín hiệu tháng này và backtest (XIRR, mức sụt giảm lớn nhất) so với mua đều. Trang `/kenh/<vn|us|gold|crypto|savings>` cho thấy mọi kiểu nói gì về từng kênh và kiểu nào từng hiệu quả nhất.

- **Tài sản theo dõi:** cổ phiếu và ETF Việt Nam, cổ phiếu và ETF Mỹ, vàng SJC và vàng nhẫn, Bitcoin, Ethereum, tiết kiệm ngân hàng.
- **Khuyến nghị dựa trên quy tắc minh bạch:** P/E VN-Index, độ lệch so với MA200, mức giảm từ đỉnh, RSI tuần, Mayer Multiple (crypto), chênh lệch vàng trong nước so với thế giới, lãi suất thực.
- **Có backtest:** so sánh "mua đều mỗi tháng" với "mua theo điểm" trên dữ liệu lịch sử.
- **Kế hoạch tháng:** quiz khẩu vị rủi ro → tỷ trọng mục tiêu → app tính số tiền nên mua cho từng tài sản.
- **Phân bổ tối ưu (đường biên hiệu quả):** tối ưu Markowitz từ lợi nhuận và tương quan lịch sử (quy ra VND). Mỗi hồ sơ có mức biến động mục tiêu và giới hạn từng kênh; lợi nhuận kỳ vọng được co 50% về giả định dài hạn.
- **Danh mục:** ghi giao dịch, xem lãi/lỗ, XIRR, tỷ trọng so với mục tiêu, xuất/nhập file sao lưu. Dữ liệu lưu trên trình duyệt (localStorage).
- **Đồng bộ nhiều thiết bị bằng mã, không cần tài khoản:** dữ liệu được mã hóa AES-GCM trên trình duyệt rồi lưu vào Neon Postgres. Máy chủ chỉ thấy bản mã hóa và hash của mã.

> Công cụ mang tính giáo dục, không phải lời khuyên đầu tư.

## Chi phí: 0 đồng

| Thành phần | Dịch vụ miễn phí |
|---|---|
| Hosting | Vercel Hobby (hoặc Cloudflare Pages) |
| Cập nhật dữ liệu hằng ngày | GitHub Actions |
| Dữ liệu giá | VNDirect, Yahoo Finance, PNJ, CoinGecko (API công khai) |
| Dữ liệu quỹ mở | Fmarket (API công khai) |
| Lưu dữ liệu người dùng | localStorage + Neon Postgres (gói Free, cho đồng bộ) |

## Chạy trên máy

```bash
npm install
npm run data   # lấy dữ liệu mới nhất vào public/data
npm run dev    # http://localhost:3000
npm test       # unit test bộ máy chấm điểm, backtest, kế hoạch, danh mục
```

## Đưa lên mạng (miễn phí)

1. Tạo một repo trên GitHub và push code lên.
2. Vào [vercel.com/new](https://vercel.com/new), import repo đó. Vercel tự nhận ra Next.js nên không cần cấu hình thêm.
3. Trong repo GitHub, vào **Settings → Actions → General → Workflow permissions**, chọn **Read and write permissions** để workflow được commit dữ liệu.
4. Kết nối Neon: trong project Vercel → **Storage** → **Neon** (Free), hoặc chạy `vercel integration add neon`. Sau đó chạy `vercel env pull .env.local` và `npm run db:setup` để tạo bảng.
5. Vào tab **Actions**, chọn **Cập nhật dữ liệu thị trường → Run workflow** để chạy thử lần đầu.

Từ đó trở đi, mỗi ngày workflow tự lấy giá mới, commit vào `public/data`, và Vercel tự deploy lại.

## Tùy chỉnh

- **Thêm hoặc bớt mã:** sửa `lib/assets.ts`. Mã VN dùng `vn("MÃ", ...)`, mã Mỹ dùng `us("MÃ", ...)`, sau đó chạy `npm run data`.
- **Lãi suất tiết kiệm và lạm phát:** sửa `data/savings-rates.json`. File này cập nhật tay vì không có API miễn phí.
- **Trọng số và ngưỡng chấm điểm:** xem `WEIGHTS` và `LEVELS` trong `lib/signals.ts`.
- **Tỷ trọng theo khẩu vị rủi ro:** xem `PROFILES` trong `lib/plan.ts`.

## Cấu trúc

```
app/                 trang: tổng quan, kiểu đầu tư, kênh, chi tiết tài sản, kế hoạch, danh mục, công cụ
components/          UI (nhiệt kế, biểu đồ, backtest, kế hoạch, danh mục)
lib/indicators.ts    SMA, RSI, drawdown, percentile, CAGR
lib/signals.ts       chấm điểm 0–100, hệ số DCA, lời giải thích
lib/backtest.ts      DCA đều và DCA theo điểm
lib/strategies.ts    các kiểu đầu tư: tín hiệu, backtest theo tháng, tái cân bằng, một lần vs chia nhỏ
lib/strategy-data.ts chạy các kiểu trên dữ liệu thật lúc build (server)
lib/funds.ts         chuẩn hóa và xếp hạng quỹ mở từ API Fmarket
lib/fund-data.ts     gọi Fmarket có cache 1 giờ, dự phòng bản lưu (server)
lib/fund-history.ts  tóm tắt lịch sử NAV: lợi nhuận tháng, sụt giảm, biến động
lib/fund-alerts.ts   quy tắc cảnh báo quỹ
lib/goal.ts          mục tiêu 12 tháng: lợi suất cần có, xác suất, kế hoạch và tiến độ
lib/monthly.ts       phân tích theo tháng cho các kênh và nhận xét cả năm
lib/plan.ts          hồ sơ rủi ro, quiz, tính tiền tháng này
lib/portfolio.ts     giá vốn, lãi/lỗ, XIRR
scripts/fetch-data.ts  pipeline dữ liệu (nguồn chính → dự phòng → giữ dữ liệu cũ)
public/data/         JSON sinh tự động (được commit)
```

## Lưu ý

- Các API giá là API không chính thức nên có thể thay đổi. Khi một nguồn lỗi, pipeline thử nguồn dự phòng; nếu vẫn lỗi thì giữ dữ liệu cũ và hiện nhãn "Dữ liệu cũ".
- Lịch sử giá vàng trong nước chỉ bắt đầu tích lũy từ ngày đầu tiên chạy pipeline. Biểu đồ vàng dùng giá thế giới quy đổi.
- Vercel Hobby chỉ dành cho mục đích phi thương mại.
