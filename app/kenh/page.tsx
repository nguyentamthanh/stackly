import type { Metadata } from "next";
import { ChannelCards } from "@/components/ChannelCards";

export const metadata: Metadata = { title: "Kênh đầu tư" };

export default function ChannelsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Kênh đầu tư</h1>
        <p className="mt-3 text-muted leading-relaxed">
          Xem từng kênh tài sản dưới góc nhìn của mọi kiểu đầu tư: đang rẻ hay đắt, còn trong xu hướng tăng không, có ở vùng bắt đáy
          không, và kiểu nào từng hiệu quả nhất với kênh đó.
        </p>
      </header>
      <ChannelCards />
    </div>
  );
}
