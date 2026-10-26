"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/lib/ui";

export interface ClassGroup {
  key: string;
  label: string;
  content: ReactNode;
}

/** Bộ lọc theo kênh tài sản: nội dung từng nhóm được render sẵn phía server, ở đây chỉ ẩn/hiện. */
export function ClassTabs({ groups }: { groups: ClassGroup[] }) {
  const [active, setActive] = useState("all");
  const tabs = [{ key: "all", label: "Tất cả" }, ...groups];
  return (
    <div className="flex flex-col gap-6">
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Lọc theo kênh">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={cx(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap",
              active === t.key ? "border-ink bg-ink text-paper font-semibold" : "border-line text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {groups.map((g) =>
        active === "all" || active === g.key ? (
          <section key={g.key} aria-label={g.label}>
            {active === "all" && <h2 className="font-display text-xl font-semibold mb-3">{g.label}</h2>}
            {g.content}
          </section>
        ) : null,
      )}
    </div>
  );
}
