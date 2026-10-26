import type { AssetClass, AssetConfig } from "./types";

// Sửa danh sách này để thêm/bớt mã theo dõi. Pipeline dữ liệu (scripts/fetch-data.ts)
// sẽ tự lấy giá cho mọi mã ở đây trong lần chạy kế tiếp.
const vn = (symbol: string, name: string, description: string, opts: Partial<AssetConfig> = {}): AssetConfig => ({
  id: symbol.toLowerCase(),
  name,
  symbol,
  class: "vn",
  currency: "VND",
  unit: "VND",
  description,
  investable: true,
  sources: [
    // dchart trả giá cổ phiếu/CCQ theo nghìn đồng
    { provider: "vndirect", symbol, scale: 1000 },
    { provider: "yahoo", symbol: `${symbol}.VN` },
  ],
  ...opts,
});

const us = (symbol: string, name: string, description: string): AssetConfig => ({
  id: symbol.toLowerCase(),
  name,
  symbol,
  class: "us",
  currency: "USD",
  unit: "USD",
  description,
  investable: true,
  sources: [{ provider: "yahoo", symbol }],
});

export const ASSETS: AssetConfig[] = [
  vn("VNINDEX", "VN-Index", "Chỉ số đại diện toàn thị trường HOSE. Không mua trực tiếp, dùng làm thước đo thị trường.", {
    unit: "điểm",
    investable: false,
    usesMarketPE: true,
    sources: [
      { provider: "vndirect", symbol: "VNINDEX" },
      { provider: "yahoo", symbol: "^VNINDEX.VN" },
    ],
  }),
  vn("VN30", "VN30", "30 cổ phiếu vốn hóa lớn nhất HOSE.", {
    unit: "điểm",
    investable: false,
    usesMarketPE: true,
    sources: [{ provider: "vndirect", symbol: "VN30" }],
  }),
  vn("E1VFVN30", "ETF DCVFMVN30", "Quỹ ETF mô phỏng VN30, thanh khoản cao nhất thị trường. Lựa chọn phổ biến để tích sản.", {
    usesMarketPE: true,
  }),
  vn("FUEVFVND", "ETF DCVFMVN Diamond", "Quỹ ETF các doanh nghiệp kín room ngoại, chất lượng cao.", { usesMarketPE: true }),
  vn("FUESSVFL", "ETF SSIAM VNFIN Lead", "Quỹ ETF nhóm ngân hàng – tài chính dẫn đầu.", { usesMarketPE: true }),
  vn("FPT", "FPT", "Tập đoàn công nghệ hàng đầu Việt Nam."),
  vn("VCB", "Vietcombank", "Ngân hàng TMCP Ngoại thương Việt Nam."),
  vn("HPG", "Hòa Phát", "Tập đoàn thép lớn nhất Việt Nam."),
  vn("MBB", "MB Bank", "Ngân hàng TMCP Quân đội."),
  us("SPY", "S&P 500 ETF", "Quỹ ETF theo dõi 500 công ty lớn nhất nước Mỹ, nền tảng của tích sản toàn cầu."),
  us("QQQ", "Nasdaq-100 ETF", "Quỹ ETF 100 công ty công nghệ phi tài chính lớn nhất Nasdaq."),
  us("VTI", "Total US Market ETF", "Quỹ ETF toàn bộ thị trường chứng khoán Mỹ."),
  us("AAPL", "Apple", "Apple Inc."),
  us("MSFT", "Microsoft", "Microsoft Corporation."),
  us("NVDA", "NVIDIA", "NVIDIA Corporation."),
  {
    id: "vang-sjc",
    name: "Vàng miếng SJC",
    symbol: "SJC",
    class: "gold",
    currency: "VND",
    unit: "VND/lượng",
    description: "Vàng miếng SJC 999.9. Giá trong nước thường cao hơn thế giới, cần chú ý mức chênh lệch.",
    investable: true,
    sources: [],
  },
  {
    id: "vang-nhan",
    name: "Vàng nhẫn 999.9",
    symbol: "NHẪN",
    class: "gold",
    currency: "VND",
    unit: "VND/lượng",
    description: "Vàng nhẫn trơn 999.9, thường chênh lệch so với thế giới thấp hơn vàng miếng.",
    investable: true,
    sources: [],
  },
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    class: "crypto",
    currency: "USD",
    unit: "USD",
    description: "Tài sản số lớn nhất. Biến động rất mạnh, chỉ nên chiếm tỷ trọng nhỏ.",
    investable: true,
    sources: [{ provider: "yahoo", symbol: "BTC-USD" }],
  },
  {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    class: "crypto",
    currency: "USD",
    unit: "USD",
    description: "Nền tảng hợp đồng thông minh lớn nhất. Biến động còn mạnh hơn Bitcoin.",
    investable: true,
    sources: [{ provider: "yahoo", symbol: "ETH-USD" }],
  },
  {
    id: "tiet-kiem",
    name: "Tiết kiệm ngân hàng",
    symbol: "TK",
    class: "savings",
    currency: "VND",
    unit: "%/năm",
    description: "Kênh an toàn, đóng vai trò quỹ dự phòng và nơi giữ tiền chờ cơ hội.",
    investable: true,
    sources: [],
  },
];

export const CLASS_LABELS: Record<AssetClass, string> = {
  vn: "Chứng khoán VN",
  us: "Chứng khoán Mỹ",
  gold: "Vàng",
  crypto: "Crypto",
  savings: "Tiết kiệm",
};

export const CLASS_ORDER: AssetClass[] = ["vn", "us", "gold", "crypto", "savings"];

export const CLASS_DESCRIPTIONS: Record<AssetClass, string> = {
  vn: "Cổ phiếu và quỹ ETF trên sàn HOSE. Tăng trưởng theo kinh tế Việt Nam, biến động mạnh theo dòng tiền nội.",
  us: "Quỹ ETF và cổ phiếu Mỹ, mua qua tài khoản quốc tế. Đa dạng hóa ra ngoài VND, hưởng thêm tỷ giá.",
  gold: "Vàng miếng SJC và vàng nhẫn. Kênh giữ giá khi lạm phát hoặc khủng hoảng, không sinh dòng tiền.",
  crypto: "Bitcoin và Ethereum. Tiềm năng lớn nhưng có thể giảm 70–80%, chỉ nên chiếm phần nhỏ.",
  savings: "Tiền gửi ngân hàng. Quỹ dự phòng và nơi giữ tiền chờ cho mọi kiểu đầu tư khác.",
};

export function getAsset(id: string): AssetConfig | undefined {
  return ASSETS.find((a) => a.id === id);
}
