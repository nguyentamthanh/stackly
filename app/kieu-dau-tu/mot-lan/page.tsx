import type { Metadata } from "next";
import { LumpSumTool } from "@/components/LumpSumTool";
import { StrategyHeader } from "@/components/StrategyBits";
import { getStrategy } from "@/lib/strategies";
import { cashRate, getLumpAssets } from "@/lib/strategy-data";

export const metadata: Metadata = { title: "Một lần hay chia nhỏ" };

export default function LumpPage() {
  const info = getStrategy("mot-lan")!;
  return (
    <div className="flex flex-col gap-10">
      <StrategyHeader info={info} />
      <section aria-labelledby="h-lump" className="flex flex-col gap-4">
        <div>
          <h2 id="h-lump" className="font-display text-2xl font-semibold">
            Thử với khoản tiền của bạn
          </h2>
          <p className="text-sm text-muted mt-1 max-w-prose">
            Giá quy đổi VND, tiền chờ hưởng lãi tiết kiệm hiện tại, chưa tính phí. Một lần thường thắng khi tài sản tăng đều; chia nhỏ
            bảo vệ bạn khỏi trường hợp xấu nhất là mua đúng đỉnh.
          </p>
        </div>
        <LumpSumTool assets={getLumpAssets()} cashRate={cashRate()} />
      </section>
    </div>
  );
}
