import Link from "next/link";
import type { AssetConfig, Signal } from "@/lib/types";
import { cx, scoreColor } from "@/lib/ui";
import { fmtNum } from "@/lib/format";

interface Item {
  asset: AssetConfig;
  signal: Signal;
}

/** Xếp nhãn vào các hàng sao cho hai nhãn cùng hàng cách nhau ít nhất minGap (% chiều ngang). */
function layout(items: Item[], minGap: number) {
  const sorted = [...items].sort((a, b) => b.signal.score - a.signal.score);
  const laneEnds: number[] = [];
  return sorted.map((it) => {
    const x = 100 - it.signal.score;
    let lane = laneEnds.findIndex((end) => x - end >= minGap);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(x);
    } else laneEnds[lane] = x;
    return { ...it, x, lane };
  });
}

const LANE_H = 28;

function Markers({ items, minGap, className }: { items: Item[]; minGap: number; className: string }) {
  const placed = layout(items, minGap);
  const lanes = Math.max(1, ...placed.map((p) => p.lane + 1));
  return (
    <div className={cx("relative", className)} style={{ height: lanes * LANE_H + 14 }}>
      {placed.map((p, i) => (
        <Link
          key={p.asset.id}
          href={`/tai-san/${p.asset.id}`}
          className="absolute -translate-x-1/2 flex flex-col items-center group"
          style={{
            left: `clamp(36px, ${p.x}%, calc(100% - 36px))`,
            bottom: 0,
            animation: `marker-in 500ms ${i * 35}ms both ease-out`,
          }}
          title={`${p.asset.name}: ${fmtNum(p.signal.score, 0)} điểm, ${p.signal.label}`}
        >
          <span
            className="px-1.5 py-0.5 rounded text-[11px] sm:text-xs font-semibold text-white whitespace-nowrap shadow-sm group-hover:scale-110 transition-transform"
            style={{ background: scoreColor(p.signal.score) }}
          >
            {p.asset.symbol}
          </span>
          <span className="w-px bg-ink/30" style={{ height: p.lane * LANE_H + 8 }} aria-hidden />
        </Link>
      ))}
    </div>
  );
}

function MobileExtremes({ items }: { items: Item[] }) {
  const sorted = [...items].sort((a, b) => b.signal.score - a.signal.score);
  const groups = [
    { title: "Đang rẻ nhất", list: sorted.slice(0, 5) },
    { title: "Đang đắt nhất", list: sorted.slice(-3).reverse() },
  ];
  return (
    <div className="sm:hidden mt-4 flex flex-col gap-3">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="text-xs text-muted mb-1.5">{g.title}</div>
          <div className="flex flex-wrap gap-1.5">
            {g.list.map((it) => (
              <Link
                key={it.asset.id}
                href={`/tai-san/${it.asset.id}`}
                className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                style={{ background: scoreColor(it.signal.score) }}
              >
                {it.asset.symbol} {fmtNum(it.signal.score, 0)}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Thermometer({ items }: { items: Item[] }) {
  return (
    <figure className="select-none">
      <Markers items={items} minGap={9} className="hidden sm:block" />
      {/* Màn hẹp: chỉ chấm vị trí trên dải, tên tài sản liệt kê bên dưới */}
      <div className="relative mt-4 sm:mt-0">
        <div className="thermo-strip h-3 rounded-full" aria-hidden />
        <div className="sm:hidden absolute inset-0" aria-hidden>
          {items.map((it) => (
            <span
              key={it.asset.id}
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
              style={{ left: `${100 - it.signal.score}%`, background: scoreColor(it.signal.score) }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-xs sm:text-sm text-muted">
        <span>
          <strong className="text-t-very-cheap font-semibold">100 · Rất rẻ</strong>
          <span className="hidden sm:inline">: tăng tiền tích sản</span>
        </span>
        <span className="hidden sm:inline">50 · Trung tính</span>
        <span className="text-right">
          <span className="hidden sm:inline">giảm tiền tích sản: </span>
          <strong className="text-t-very-expensive font-semibold">Rất đắt · 0</strong>
        </span>
      </div>
      <MobileExtremes items={items} />
      <figcaption className="sr-only">Vị trí điểm hấp dẫn của từng tài sản trên thang 0 (đắt) đến 100 (rẻ).</figcaption>
    </figure>
  );
}
