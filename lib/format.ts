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

/** Chuỗi số chuẩn ("1234567.5", dấu chấm thập phân) → dạng hiển thị Việt Nam ("1.234.567,5") */
export function groupMoney(canonical: string): string {
  if (!canonical) return "";
  const [int, frac] = canonical.split(".");
  const grouped = int.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac === undefined ? grouped : `${grouped},${frac}`;
}

/**
 * Văn bản người dùng gõ hoặc dán → chuỗi số chuẩn ("1234567.5").
 * Số nguyên (decimals = false): bỏ mọi ký tự không phải chữ số, nên "5.000.000" và "5,000,000" đều ra 5000000.
 * Có số lẻ: dấu phẩy là dấu thập phân (như hiển thị); dấu chấm gõ ở cuối coi là thập phân (bàn phím Mỹ);
 * khi dán, một dấu chấm duy nhất theo sau bởi số chữ số khác 3 (hoặc sau số 0) cũng là thập phân, ví dụ "759.97".
 */
export function parseMoney(text: string, decimals = false, pasted = false): string {
  const stripZeros = (s: string) => s.replace(/^0+(?=\d)/, "");
  if (!decimals) return stripZeros(text.replace(/\D/g, ""));
  let t = text.replace(/\s/g, "");
  if (!t.includes(",")) {
    const dots = t.split(".");
    const endsWithDot = /\d\.$/.test(t);
    const pastedDecimal = pasted && dots.length === 2 && /^\d+$/.test(dots[0]) && /^\d+$/.test(dots[1]) && (dots[1].length !== 3 || /^0+$/.test(dots[0]));
    if (endsWithDot || pastedDecimal) t = t.replace(/\.(?=[^.]*$)/, ",");
  }
  if ((t.match(/,/g) ?? []).length > 1) t = t.replace(/,/g, "");
  const [intPart, frac] = t.split(",");
  const int = stripZeros(intPart.replace(/\D/g, ""));
  return frac === undefined ? int : `${int || "0"}.${frac.replace(/\D/g, "")}`;
}
