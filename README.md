# Tích Sản

Web app miễn phí hỗ trợ **tích sản dài hạn** theo thời điểm. Mỗi tài sản được chấm **Điểm hấp dẫn 0–100**, điểm này quyết định tháng này nên mua nhiều hơn, ít hơn hay giữ nguyên số tiền tích sản.

- **Tài sản theo dõi:** cổ phiếu và ETF Việt Nam, cổ phiếu và ETF Mỹ, vàng SJC và vàng nhẫn, Bitcoin, Ethereum, tiết kiệm ngân hàng.
- **Khuyến nghị dựa trên quy tắc minh bạch:** P/E VN-Index, độ lệch so với MA200, mức giảm từ đỉnh, RSI tuần, Mayer Multiple (crypto), chênh lệch vàng trong nước so với thế giới, lãi suất thực.
- **Có backtest:** so sánh "mua đều mỗi tháng" với "mua theo điểm" trên dữ liệu lịch sử.
- **Kế hoạch tháng:** quiz khẩu vị rủi ro → chọn tỷ trọng mục tiêu → app tính số tiền nên mua cho từng tài sản.
- **Danh mục:** ghi giao dịch, xem lãi/lỗ, XIRR, tỷ trọng so với mục tiêu, xuất/nhập file sao lưu. Dữ liệu chỉ lưu trên trình duyệt (localStorage).

> Công cụ mang tính giáo dục, không phải lời khuyên đầu tư.

## Chi phí: 0 đồng

| Thành phần | Dịch vụ miễn phí |
|---|---|
| Hosting | Vercel Hobby (hoặc Cloudflare Pages) |
| Cập nhật dữ liệu hằng ngày | GitHub Actions |
| Dữ liệu giá | VNDirect, Yahoo Finance, PNJ, CoinGecko (API công khai) |
| Lưu dữ liệu người dùng | localStorage trên trình duyệt |

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
4. Vào tab **Actions**, chọn **Cập nhật dữ liệu thị trường → Run workflow** để chạy thử lần đầu.

Từ đó trở đi, mỗi ngày workflow tự lấy giá mới, commit vào `public/data`, và Vercel tự deploy lại.

## Tùy chỉnh

- **Thêm hoặc bớt mã:** sửa `lib/assets.ts`. Mã VN dùng `vn("MÃ", ...)`, mã Mỹ dùng `us("MÃ", ...)`, sau đó chạy `npm run data`.
- **Lãi suất tiết kiệm và lạm phát:** sửa `data/savings-rates.json`. File này cập nhật tay vì không có API miễn phí.
- **Trọng số và ngưỡng chấm điểm:** xem `WEIGHTS` và `LEVELS` trong `lib/signals.ts`.
- **Tỷ trọng theo khẩu vị rủi ro:** xem `PROFILES` trong `lib/plan.ts`.

## Cấu trúc

```
app/                 trang: tổng quan, chi tiết tài sản, kế hoạch, danh mục, công cụ
components/          UI (nhiệt kế, biểu đồ, backtest, kế hoạch, danh mục)
lib/indicators.ts    SMA, RSI, drawdown, percentile, CAGR
lib/signals.ts       chấm điểm 0–100, hệ số DCA, lời giải thích
lib/backtest.ts      DCA đều và DCA theo điểm
lib/plan.ts          hồ sơ rủi ro, quiz, tính tiền tháng này
lib/portfolio.ts     giá vốn, lãi/lỗ, XIRR
scripts/fetch-data.ts  pipeline dữ liệu (nguồn chính → dự phòng → giữ dữ liệu cũ)
public/data/         JSON sinh tự động (được commit)
```

## Lưu ý

- Các API giá là API không chính thức nên có thể thay đổi. Khi một nguồn lỗi, pipeline thử nguồn dự phòng; nếu vẫn lỗi thì giữ dữ liệu cũ và hiện nhãn "Dữ liệu cũ".
- Lịch sử giá vàng trong nước chỉ bắt đầu tích lũy từ ngày đầu tiên chạy pipeline. Biểu đồ vàng dùng giá thế giới quy đổi.
- Vercel Hobby chỉ dành cho mục đích phi thương mại.
