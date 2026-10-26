import type { AssetClass, Currency, SignalLevel } from "./types";

/** Dữ liệu gọn truyền từ server xuống các trang client (kế hoạch, danh mục, công cụ). */
export interface LiteAsset {
  id: string;
  symbol: string;
  name: string;
  class: AssetClass;
  currency: Currency;
  unit: string;
  score: number;
  label: string;
  level: SignalLevel;
  multiplier: number;
  price: number;
}

/** Giá quy đổi VND của một đơn vị tài sản */
export function priceVnd(a: Pick<LiteAsset, "price" | "currency">, usdVnd: number): number {
  return a.currency === "USD" ? a.price * usdVnd : a.price;
}

/** Diễn giải số tiền thành số lượng xấp xỉ, ví dụ "≈ 145 CCQ", "≈ 0,7 chỉ" */
export function quantityHint(a: LiteAsset, amountVnd: number, usdVnd: number): string {
  if (a.class === "savings" || amountVnd <= 0) return "";
  const q = amountVnd / priceVnd(a, usdVnd);
  const nf = (x: number, d: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: d }).format(x);
  if (a.class === "gold") return `≈ ${nf(q * 10, 2)} chỉ`;
  if (a.class === "crypto") return `≈ ${nf(q, 5)} ${a.symbol}`;
  if (a.class === "us") return `≈ ${nf(q, 3)} cổ phiếu`;
  return `≈ ${nf(Math.floor(q), 0)} ${a.symbol.startsWith("E1") || a.symbol.startsWith("FUE") ? "CCQ" : "cổ phiếu"}`;
}
