import type { Metadata } from "next";

export const metadata: Metadata = { title: "Miễn trừ trách nhiệm và phương pháp" };

export default function DisclaimerPage() {
  return (
    <article className="max-w-prose flex flex-col gap-6 leading-relaxed">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Miễn trừ trách nhiệm và phương pháp</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-semibold">Không phải lời khuyên đầu tư</h2>
        <p>
          Tích Sản là công cụ tham khảo mang tính giáo dục. Điểm hấp dẫn và số tiền gợi ý được tính tự động bằng quy tắc cố định trên dữ
          liệu quá khứ, không xét đến hoàn cảnh tài chính, mục tiêu hay khả năng chịu rủi ro riêng của bạn. Đây không phải dịch vụ tư vấn
          đầu tư chứng khoán được cấp phép. Mọi quyết định và rủi ro thuộc về bạn.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-semibold">Điểm hấp dẫn được tính thế nào</h2>
        <p>Mỗi tài sản nhận điểm 0–100 là trung bình có trọng số của các chỉ số sau. Điểm càng cao, giá càng rẻ so với chính lịch sử của nó.</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>
            <strong>Định giá P/E VN-Index</strong> (35%, cổ phiếu và ETF Việt Nam): P/E hiện tại so với toàn bộ lịch sử từ 2017.
          </li>
          <li>
            <strong>So với MA200</strong>: giá cao hay thấp hơn trung bình 200 phiên, so với các mức lệch trong 10 năm.
          </li>
          <li>
            <strong>Giảm từ đỉnh</strong>: giá đang thấp hơn đỉnh cao nhất bao nhiêu, so với lịch sử.
          </li>
          <li>
            <strong>RSI tuần</strong>: RSI 30 trở xuống được 100 điểm, 75 trở lên được 0 điểm.
          </li>
          <li>
            <strong>Mayer Multiple</strong> (crypto): giá chia MA200; 0,8 được 100 điểm, 2,2 được 0 điểm.
          </li>
          <li>
            <strong>Chênh lệch vàng trong nước</strong> (vàng): chênh 2% được 100 điểm, 20% được 0 điểm.
          </li>
          <li>
            <strong>Lãi suất thực</strong> (tiết kiệm): lãi suất 12 tháng trung bình trừ lạm phát.
          </li>
        </ul>
        <p>Điểm quy đổi thành hệ số tiền tích sản: dưới 20 là ×0,5; 20–40 là ×0,75; 40–60 là ×1; 60–80 là ×1,5; từ 80 là ×2.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-semibold">Nguồn dữ liệu</h2>
        <p>
          Giá được lấy tự động mỗi ngày từ các nguồn công khai miễn phí: VNDirect (cổ phiếu, ETF, chỉ số và P/E Việt Nam), Yahoo Finance
          (cổ phiếu Mỹ, vàng thế giới, tỷ giá, crypto), PNJ (giá vàng trong nước), CoinGecko (dự phòng cho crypto). Lãi suất tiết kiệm được
          cập nhật thủ công. Các nguồn này không chính thức và có thể chậm, thiếu hoặc sai; khi một nguồn lỗi, app giữ dữ liệu cũ và hiện
          nhãn “Dữ liệu cũ”.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-semibold">Dữ liệu cá nhân</h2>
        <p>
          Kế hoạch và giao dịch của bạn được lưu trong trình duyệt (localStorage) trên thiết bị này. Xóa dữ liệu trình duyệt sẽ xóa
          chúng, vì vậy hãy dùng nút “Tải file sao lưu” hoặc bật đồng bộ trong trang Danh mục.
        </p>
        <p>
          Khi bật đồng bộ, dữ liệu được mã hóa AES-GCM ngay trên trình duyệt bằng khóa suy ra từ mã đồng bộ của bạn, rồi mới gửi lên
          máy chủ (cơ sở dữ liệu Neon). Máy chủ chỉ lưu bản mã hóa và một giá trị băm của mã, nên không đọc được nội dung và không khôi
          phục được nếu bạn mất mã.
        </p>
      </section>
    </article>
  );
}
