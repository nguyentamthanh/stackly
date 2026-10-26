import Link from "next/link";
import { CLASS_DESCRIPTIONS, CLASS_LABELS, CLASS_ORDER } from "@/lib/assets";
import { getBoard } from "@/lib/strategy-data";
import { CLASS_COLOR } from "@/lib/ui";

export function ChannelCards() {
  const board = getBoard();
  return (
    <ul className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {CLASS_ORDER.map((cls) => {
        const rows = board.filter((r) => r.asset.class === cls && r.asset.investable);
        const cheap = rows.filter((r) => r.signal.score >= 60).length;
        const up = rows.filter((r) => r.trend?.exposure === 1).length;
        return (
          <li key={cls}>
            <Link
              href={`/kenh/${cls}`}
              className="h-full flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 hover:border-jade transition-colors border-t-4"
              style={{ borderTopColor: CLASS_COLOR[cls] }}
            >
              <span className="font-display text-lg font-semibold">{CLASS_LABELS[cls]}</span>
              <span className="text-sm text-muted">{CLASS_DESCRIPTIONS[cls]}</span>
              {cls !== "savings" && (
                <span className="mt-auto pt-2 text-xs text-muted">
                  {rows.length} tài sản · {cheap} đang rẻ · {up} đang tăng
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
