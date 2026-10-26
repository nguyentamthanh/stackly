const nf = (min: number, max: number) =>
  new Intl.NumberFormat("vi-VN", { minimumFractionDigits: min, maximumFractionDigits: max });

const nf0 = nf(0, 0);
const nf1 = nf(1, 1);
const nf2 = nf(0, 2);

export function fmtNum(x: number, digits = 0): string {
  if (digits === 0) return nf0.format(x);
  if (digits === 1) return nf1.format(x);
  return nf(0, digits).format(x);
}

/** 0.0823 → "8,2%" ; signed=true thêm dấu + */
export function fmtPct(x: number | null | undefined, digits = 1, signed = false): string {
  if (x == null || !Number.isFinite(x)) return "—";
  // Tránh hiển thị "-0,0%" khi số âm rất nhỏ bị làm tròn về 0
  if (Math.abs(x * 100) < 0.5 * 10 ** -digits) x = 0;
  const s = nf(digits, digits).format(x * 100) + "%";
  return signed && x > 0 ? "+" + s : s;
}

export function fmtVnd(x: number): string {
  return nf0.format(Math.round(x)) + " ₫";
}

/** Số tiền rút gọn: 1.250.000 → "1,25 tr", 2.500.000.000 → "2,5 tỷ" */
export function fmtVndShort(x: number): string {
  const abs = Math.abs(x);
  if (abs >= 1e9) return nf2.format(x / 1e9) + " tỷ";
  if (abs >= 1e6) return nf2.format(x / 1e6) + " tr";
  if (abs >= 1e3) return nf0.format(x / 1e3) + "k";
  return nf0.format(x);
}

export function fmtPrice(x: number, currency: "VND" | "USD", unit?: string): string {
  if (unit === "điểm") return fmtNum(x, 2);
  if (unit === "%/năm") return fmtPct(x, 2);
  if (currency === "USD") return "$" + nf(2, 2).format(x);
  return fmtVnd(x);
}

export function fmtDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}
