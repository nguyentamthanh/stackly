import type { FundHistory } from "./fund-history";
import { fmtPct } from "./format";
import type { Fund, FundBenchmarks, FundType } from "./funds";

// Cảnh báo quỹ theo quy tắc minh bạch, không dự đoán giá. Ngưỡng khác nhau theo loại quỹ
// vì quỹ trái phiếu được kỳ vọng ổn định hơn nhiều so với quỹ cổ phiếu.

export type AlertLevel = "high" | "medium" | "info";

export interface FundAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
}

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  high: "Nghiêm trọng",
  medium: "Cần lưu ý",
  info: "Thông tin",
};

const LEVEL_ORDER: Record<AlertLevel, number> = { high: 0, medium: 1, info: 2 };

/** Giảm trong 1 tháng đủ để cảnh báo (cảnh báo nghiêm trọng khi gấp đôi) */
const DROP_1M: Record<FundType, number> = { STOCK: 0.06, BALANCED: 0.04, BOND: 0.005 };
/** Giảm trong 3 tháng */
const DROP_3M: Record<FundType, number> = { STOCK: 0.08, BALANCED: 0.05, BOND: 0.01 };
/** Mức giảm từ đỉnh 12 tháng: [lưu ý, nghiêm trọng] */
const DRAWDOWN: Record<FundType, [number, number]> = { STOCK: [0.1, 0.18], BALANCED: [0.07, 0.12], BOND: [0.01, 0.025] };
/** Biến động năm hóa tối đa hợp lý cho loại quỹ */
const VOL_MAX: Record<FundType, number> = { STOCK: 0.22, BALANCED: 0.14, BOND: 0.035 };
const HIGH_FEE = 0.0175;
/** NAV giảm từ mức này trở xuống trong 12 tháng mới là nghiêm trọng (giảm nhẹ hơn chỉ là lưu ý) */
const NEGATIVE_1Y_HIGH = 0.05;
/** Thua mốc từ mức này trở lên ở cả 1 năm và 3 năm mới là nghiêm trọng */
const LAG_HIGH_1Y = 0.1;
const LAG_HIGH_3Y = 0.2;
/** Quỹ giảm sâu hơn thị trường không quá mức này thì coi là giảm theo thị trường */
const MARKET_TRACKING_GAP = 0.03;
const MIN_PEERS = 8;

export interface AlertContext {
  benchmarks: FundBenchmarks;
  /** Mức giảm hiện tại của VN-Index so với đỉnh 12 tháng (số dương, 0.1 = 10%) để phân biệt giảm theo thị trường với giảm riêng của quỹ */
  marketDrawdown?: number;
  /** Toàn bộ danh sách quỹ, dùng để so với cùng loại */
  peers: Fund[];
  history?: FundHistory | null;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (pos - lo);
}

function peerValues(peers: Fund[], type: FundType, pick: (f: Fund) => number | null): number[] {
  return peers
    .filter((f) => f.type === type)
    .flatMap((f) => {
      const v = pick(f);
      return v == null ? [] : [v];
    })
    .sort((a, b) => a - b);
}

export function fundAlerts(f: Fund, ctx: AlertContext): FundAlert[] {
  const out: FundAlert[] = [];
  const add = (id: string, level: AlertLevel, title: string, detail: string) => out.push({ id, level, title, detail });
  const { y1, y3, m1, m3 } = f.returns;
  const refName = f.type === "BOND" ? "lãi tiết kiệm" : "VN-Index";
  const ref = (p: "y1" | "y3") => (f.type === "BOND" ? ctx.benchmarks[p].savings : ctx.benchmarks[p].vnindex);
  const ref1 = ref("y1");
  const ref3 = ref("y3");

  // Lợi nhuận so với mốc
  if (y1 != null && y1 < 0) {
    add(
      "negative-1y",
      y1 <= -NEGATIVE_1Y_HIGH ? "high" : "medium",
      "NAV giảm trong 12 tháng",
      `Lợi nhuận 12 tháng ${fmtPct(y1, 1, true)}: người mua cách đây 1 năm đang lỗ.`,
    );
  }
  if (y1 != null && ref1 != null && y1 < ref1) {
    if (y3 != null && ref3 != null && y3 < ref3) {
      add(
        "lagging-persistent",
        ref1 - y1 >= LAG_HIGH_1Y && ref3 - y3 >= LAG_HIGH_3Y ? "high" : "medium",
        `Thua ${refName} cả 1 năm lẫn 3 năm`,
        `1 năm ${fmtPct(y1, 1, true)} so với ${fmtPct(ref1, 1, true)}; 3 năm ${fmtPct(y3, 1, true)} so với ${fmtPct(ref3, 1, true)}. Thua kéo dài, không phải chỉ một năm xấu.`,
      );
    } else {
      add("lagging-1y", "medium", `Thua ${refName} trong 12 tháng`, `${fmtPct(y1, 1, true)} so với ${fmtPct(ref1, 1, true)} của ${refName}.`);
    }
  }

  // Giảm mạnh gần đây
  if (m1 != null && m1 <= -DROP_1M[f.type]) {
    add(
      "drop-1m",
      m1 <= -2 * DROP_1M[f.type] ? "high" : "medium",
      "Giảm mạnh trong 1 tháng",
      `NAV ${fmtPct(m1, 1, true)} trong 1 tháng${f.type === "BOND" ? ", bất thường với một quỹ trái phiếu" : ""}.`,
    );
  } else if (m3 != null && m3 <= -DROP_3M[f.type]) {
    add("drop-3m", m3 <= -2 * DROP_3M[f.type] ? "high" : "medium", "Giảm trong 3 tháng", `NAV ${fmtPct(m3, 1, true)} trong 3 tháng gần nhất.`);
  }

  // Từ lịch sử NAV
  const h = ctx.history;
  if (h) {
    const [med, high] = DRAWDOWN[f.type];
    const dd = -h.drawdown;
    if (dd >= med) {
      // Quỹ cổ phiếu/cân bằng giảm xấp xỉ thị trường chung là rủi ro thị trường, không phải vấn đề riêng của quỹ
      const market = f.type === "BOND" ? null : (ctx.marketDrawdown ?? null);
      const withMarket = market != null && market >= med && dd - market <= MARKET_TRACKING_GAP;
      add(
        withMarket ? "drawdown-market" : "drawdown",
        withMarket ? "info" : dd >= high ? "high" : "medium",
        withMarket ? "Giảm theo thị trường chung" : "Đang giảm sâu so với đỉnh",
        `NAV thấp hơn đỉnh 12 tháng ${fmtPct(dd, 1)} (mức giảm lớn nhất trong năm: ${fmtPct(-h.maxDrawdown, 1)})` +
          (market != null && market >= med ? `; VN-Index cùng kỳ thấp hơn đỉnh ${fmtPct(market, 1)}.` : "."),
      );
    }
    if (h.vol != null && h.vol > VOL_MAX[f.type]) {
      add(
        "volatility",
        "medium",
        "Biến động cao hơn thông thường",
        `Biến động ${fmtPct(h.vol, 1)}/năm, vượt mức ${fmtPct(VOL_MAX[f.type], 0)} thường thấy ở quỹ ${f.type === "BOND" ? "trái phiếu" : f.type === "STOCK" ? "cổ phiếu" : "cân bằng"}.`,
      );
    }
    const last3 = h.months.slice(-3);
    if (last3.length === 3 && last3.every((m) => m.ret != null && m.ret < 0)) {
      add("streak", "medium", "3 tháng liên tiếp giảm", `Lợi nhuận các tháng gần nhất: ${last3.map((m) => fmtPct(m.ret, 1, true)).join(", ")}.`);
    }
  }

  // So với quỹ cùng loại
  const y1Peers = peerValues(ctx.peers, f.type, (x) => x.returns.y1);
  if (y1 != null && y1Peers.length >= MIN_PEERS && y1 <= quantile(y1Peers, 0.25)) {
    add("bottom-quartile", "medium", "Thuộc nhóm yếu nhất cùng loại", `Lợi nhuận 12 tháng nằm trong 25% thấp nhất của ${y1Peers.length} quỹ cùng loại.`);
  }
  const y3Peers = peerValues(ctx.peers, f.type, (x) => x.returns.y3);
  if (f.managementFee != null && f.managementFee >= HIGH_FEE && y3 != null && y3Peers.length >= MIN_PEERS && y3 < quantile(y3Peers, 0.5)) {
    add(
      "high-fee",
      "medium",
      "Phí cao nhưng lợi nhuận dưới trung vị",
      `Phí quản lý ${fmtPct(f.managementFee, 2)}/năm, lợi nhuận 3 năm ${fmtPct(y3, 1, true)} thấp hơn trung vị cùng loại.`,
    );
  }

  // Lịch sử ngắn
  if (f.ageYears != null && f.ageYears < 3) {
    add(
      "short-history",
      "info",
      f.ageYears < 1 ? "Quỹ rất mới (dưới 1 năm)" : "Lịch sử dưới 3 năm",
      "Chưa đủ dữ liệu để đánh giá qua một chu kỳ thị trường. Thứ hạng hiện tại có thể thay đổi nhiều.",
    );
  }

  return out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

export function topLevel(alerts: FundAlert[]): AlertLevel | null {
  return alerts.length ? alerts[0].level : null;
}

export function countByLevel(byFund: Record<string, FundAlert[]>): Record<AlertLevel, number> {
  const out: Record<AlertLevel, number> = { high: 0, medium: 0, info: 0 };
  for (const alerts of Object.values(byFund)) {
    const t = topLevel([...alerts].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]));
    if (t) out[t]++;
  }
  return out;
}
