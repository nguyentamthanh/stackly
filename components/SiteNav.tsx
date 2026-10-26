"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/ui";

const LINKS = [
  { href: "/", label: "Tổng quan" },
  { href: "/ke-hoach", label: "Kế hoạch" },
  { href: "/danh-muc", label: "Danh mục" },
  { href: "/cong-cu", label: "Công cụ" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav
      className="no-scrollbar order-last sm:order-none w-full sm:w-auto flex justify-between sm:justify-start gap-0.5 sm:gap-1 overflow-x-auto text-sm -mx-2 sm:-mx-1"
      aria-label="Điều hướng chính"
    >
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" || pathname.startsWith("/tai-san") : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "px-1.5 sm:px-2.5 py-1.5 rounded-md whitespace-nowrap",
              active ? "text-ink font-semibold bg-paper" : "text-muted hover:text-ink",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
