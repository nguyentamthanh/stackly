import { priceVnd, type LiteAsset } from "./client-data";

export interface Transaction {
  id: string;
  assetId: string;
  type: "buy" | "sell";
  date: string;
  /** Số lượng; với tiết kiệm là số tiền gửi */
  quantity: number;
  /** Giá mỗi đơn vị theo tiền tệ của tài sản; với tiết kiệm = 1 */
  price: number;
  fee: number;
  /** Lãi suất năm (chỉ dùng cho tiết kiệm) */
  rate?: number;
  note?: string;
}

export interface Holding {
  assetId: string;
  quantity: number;
  /** Tổng giá vốn còn lại (theo tiền tệ của tài sản) */
  cost: number;
  avgCost: number;
  realized: number;
}

/** Giá vốn bình quân gia quyền. Giao dịch được xử lý theo thứ tự ngày. */
export function holdingsFromTransactions(txs: Transaction[]): Map<string, Holding> {
  const map = new Map<string, Holding>();
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    const h = map.get(t.assetId) ?? { assetId: t.assetId, quantity: 0, cost: 0, avgCost: 0, realized: 0 };
    if (t.type === "buy") {
      h.cost += t.quantity * t.price + t.fee;
      h.quantity += t.quantity;
    } else {
      const q = Math.min(t.quantity, h.quantity);
      const avg = h.quantity ? h.cost / h.quantity : 0;
      h.realized += q * (t.price - avg) - t.fee;
      h.cost -= avg * q;
      h.quantity -= q;
    }
    h.avgCost = h.quantity ? h.cost / h.quantity : 0;
    map.set(t.assetId, h);
  }
  return map;
}

/** Giá trị tiền gửi có lãi đơn tính theo ngày. */
export function savingsValue(principal: number, rate: number, start: string, end: string): number {
  const days = Math.max(0, (Date.parse(end) - Date.parse(start)) / 86400000);
  return principal * (1 + (rate * days) / 365);
}

export interface CashFlow {
  date: string;
  /** Âm = tiền bỏ vào, dương = tiền nhận về (hoặc giá trị hiện tại) */
  amount: number;
}

/** Tỷ suất hoàn vốn nội bộ theo năm cho dòng tiền không đều. */
export function xirr(flows: CashFlow[]): number | null {
  if (!flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const t0 = Date.parse(flows[0].date);
  const ts = flows.map((f) => (Date.parse(f.date) - t0) / (365 * 86400000));
  const npv = (r: number) => flows.reduce((a, f, i) => a + f.amount / Math.pow(1 + r, ts[i]), 0);

  // Chia đôi trên khoảng rộng: ổn định hơn Newton với dòng tiền thất thường
  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo);
  if (fLo * npv(hi) > 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export interface ValuedHolding {
  asset: LiteAsset;
  quantity: number;
  /** Giá vốn còn lại quy VND */
  costVnd: number;
  valueVnd: number;
  realizedVnd: number;
}

/** Định giá các khoản đang nắm giữ theo giá hiện tại, quy ra VND. Tiết kiệm tính lãi đơn đến `today`. */
export function valueHoldings(
  txs: Transaction[],
  assets: LiteAsset[],
  usdVnd: number,
  defaultSavingsRate: number,
  today: string,
): ValuedHolding[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const rows: ValuedHolding[] = [];
  for (const h of holdingsFromTransactions(txs).values()) {
    const asset = byId.get(h.assetId);
    if (!asset) continue;
    const fx = asset.currency === "USD" ? usdVnd : 1;
    let valueVnd: number;
    if (asset.class === "savings") {
      valueVnd = txs
        .filter((t) => t.assetId === asset.id)
        .reduce((a, t) => a + (t.type === "buy" ? savingsValue(t.quantity, t.rate ?? defaultSavingsRate, t.date, today) : -t.quantity), 0);
    } else valueVnd = h.quantity * priceVnd(asset, usdVnd);
    if (h.quantity <= 0 && h.realized === 0) continue;
    rows.push({ asset, quantity: h.quantity, costVnd: h.cost * fx, valueVnd: Math.max(0, valueVnd), realizedVnd: h.realized * fx });
  }
  return rows;
}
