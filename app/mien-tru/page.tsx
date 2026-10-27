import type { Metadata } from "next";

export const metadata: Metadata = { title: "Miễn trừ trách nhiệm và phương pháp" };

export default function DisclaimerPage() {
  return (
    <article className="max-w-prose flex flex-col gap-6 leading-relaxed">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Miễn trừ trách nhiệm và phương pháp</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-semibold">Không phải lời khuyên đầu tư</h2>
        <p>
          Stackly là công cụ tham khảo mang tính giáo dục. Điểm hấp dẫn và số tiền gợi ý được tính tự động bằng quy tắc cố định trên dữ
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
        <h2 className="font-display text-xl font-semibold">Các kiểu đầu tư khác được tính thế nào</h2>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>
            <strong>Theo xu hướng</strong>: giá trên MA200 được 50% tỷ trọng, lợi nhuận 252 phiên gần nhất dương được thêm 50%. Phần còn lại
            gửi tiết kiệm. Xét lại đầu mỗi tháng.
          </li>
          <li>
            <strong>Bắt đáy</strong>: tiền góp mỗi tháng gửi tiết kiệm. Giải ngân hết khi mức giảm từ đỉnh sâu hơn 80% lịch sử 10 năm và RSI
            tuần ≤ 45; giải ngân 1/3 khi sâu hơn 65% lịch sử hoặc RSI tuần ≤ 35; bán 20% khi độ lệch so với MA200 ở top 5% lịch sử và RSI
            tuần ≥ 70.
          </li>
          <li>
            <strong>Danh mục cố định</strong>: kênh VN dùng ETF E1VFVN30, kênh Mỹ dùng ETF SPY, vàng dùng giá thế giới quy đổi, crypto dùng
            Bitcoin; tất cả quy ra VND theo tỷ giá từng ngày.
          </li>
          <li>
            <strong>Một lần hay chia nhỏ</strong>: xét mọi tháng bắt đầu trong lịch sử, so giá trị cuối kỳ của bỏ hết tiền ngay với mua đều
            trong N tháng (tiền chưa mua hưởng lãi tiết kiệm).
          </li>
        </ul>
        <p>
          Mọi kết quả quá khứ dùng lãi suất tiết kiệm hiện tại cho tiền chờ, chưa tính phí giao dịch, thuế và chênh lệch mua–bán. Lợi suất
          năm là XIRR theo dòng tiền; mức sụt giảm tính trên chỉ số tăng trưởng theo thời gian nên không bị tiền góp thêm che lấp.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-semibold">Cảnh báo quỹ mở được tính thế nào</h2>
        <p>Mỗi quỹ được kiểm tra bằng các quy tắc cố định; ngưỡng khác nhau theo loại quỹ vì quỹ trái phiếu được kỳ vọng ổn định hơn quỹ cổ phiếu.</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>
            <strong>Thua mốc</strong>: lợi nhuận 1 năm và 3 năm so với VN-Index (quỹ cổ phiếu, cân bằng) hoặc lãi tiết kiệm (quỹ trái phiếu). Nghiêm trọng khi thua từ 10 điểm % ở 1 năm và 20 điểm % ở 3 năm.
          </li>
          <li>
            <strong>NAV giảm</strong>: lợi nhuận 12 tháng âm (nghiêm trọng từ −5%); giảm mạnh trong 1 hoặc 3 tháng (quỹ trái phiếu chỉ cần giảm 0,5% trong 1 tháng là đáng chú ý).
          </li>
          <li>
            <strong>Giảm sâu so với đỉnh 12 tháng</strong>, tính từ lịch sử NAV. Quỹ giảm xấp xỉ VN-Index (chênh dưới 3 điểm %) chỉ bị ghi là thông tin vì đó là rủi ro thị trường.
          </li>
          <li>
            <strong>Biến động cao</strong> hơn mức thường thấy của loại quỹ, <strong>3 tháng liên tiếp giảm</strong>, <strong>thuộc 25% yếu nhất</strong> cùng loại, <strong>phí từ 1,75%/năm</strong> mà lợi nhuận 3 năm dưới trung vị, và <strong>quỹ mới</strong> (dưới 3 năm, chưa đủ dữ liệu).
          </li>
        </ul>
        <p>Cảnh báo không phải dự báo: quỹ đang có cảnh báo vẫn có thể phục hồi, và quỹ không có cảnh báo vẫn có thể giảm.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-semibold">Mục tiêu 1 năm được tính thế nào</h2>
        <p>
          Lợi suất cần có là lợi suất năm thấp nhất để vốn hiện có cộng tiền góp đầu mỗi tháng đạt mục tiêu sau 12 tháng (lãi kép theo tháng). Lợi suất kỳ vọng và biến động lấy từ danh mục tối ưu theo
          khẩu vị rủi ro. Kịch bản xấu và tốt là kỳ vọng trừ hoặc cộng một độ lệch chuẩn. Xác suất đạt coi lợi suất 1 năm theo phân phối chuẩn nên chỉ là ước lượng thô, bỏ qua việc tiền góp về sau
          tham gia thị trường ngắn hơn. Tiến độ so số dư thực tế bạn nhập với đường kế hoạch cùng tháng: lệch trong ±3% là đúng kế hoạch, chậm 3–10% là chậm, chậm hơn 10% là chậm nhiều.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-semibold">Nguồn dữ liệu</h2>
        <p>
          Giá được lấy tự động mỗi ngày từ các nguồn công khai miễn phí: VNDirect (cổ phiếu, ETF, chỉ số và P/E Việt Nam), Yahoo Finance
          (cổ phiếu Mỹ, vàng thế giới, tỷ giá, crypto), PNJ (giá vàng trong nước), CoinGecko (dự phòng cho crypto), Fmarket (NAV, lợi nhuận và lịch sử NAV quỹ mở; danh sách làm mới mỗi giờ, lịch sử NAV cập nhật mỗi ngày). Lãi suất tiết kiệm được
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
