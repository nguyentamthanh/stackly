import { ASSETS } from "./assets";
import type { LiteAsset } from "./client-data";
import type { SignalsFile } from "./types";

/** Ghép cấu hình tài sản với tín hiệu mới nhất (chỉ tài sản có thể mua). Dùng phía server. */
export function liteAssets({ signals }: SignalsFile): LiteAsset[] {
  return ASSETS.flatMap((a) => {
    const s = signals.find((x) => x.id === a.id);
    if (!s || !a.investable) return [];
    return [
      {
        id: a.id,
        symbol: a.symbol,
        name: a.name,
        class: a.class,
        currency: a.currency,
        unit: a.unit,
        score: s.score,
        label: s.label,
        level: s.level,
        multiplier: s.multiplier,
        price: s.price,
      },
    ];
  });
}
