import type { AssetClass, SignalLevel } from "./types";

/** Màu thang nhiệt theo mức tín hiệu (biến CSS định nghĩa trong globals.css) */
export const LEVEL_COLOR: Record<SignalLevel, string> = {
  "very-cheap": "var(--t-very-cheap)",
  cheap: "var(--t-cheap)",
  neutral: "var(--t-neutral)",
  expensive: "var(--t-expensive)",
  "very-expensive": "var(--t-very-expensive)",
};

/** Màu theo nhóm tài sản cho biểu đồ phân bổ (tách biệt với thang nhiệt) */
export const CLASS_COLOR: Record<AssetClass, string> = {
  vn: "#1f8a70",
  us: "#3b6fd8",
  gold: "#c99a1e",
  crypto: "#8a5cd6",
  savings: "#8c96a3",
};

export function scoreColor(score: number): string {
  if (score >= 80) return LEVEL_COLOR["very-cheap"];
  if (score >= 60) return LEVEL_COLOR.cheap;
  if (score >= 40) return LEVEL_COLOR.neutral;
  if (score >= 20) return LEVEL_COLOR.expensive;
  return LEVEL_COLOR["very-expensive"];
}

export function cx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}

export function monthLabel(iso: string): string {
  const d = new Date(iso);
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${vn.getUTCMonth() + 1}/${vn.getUTCFullYear()}`;
}
