import type { Metadata } from "next";
import { Be_Vietnam_Pro, Fraunces } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SiteNav } from "@/components/SiteNav";
import { SyncAgent } from "@/components/SyncAgent";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSignals } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import "./globals.css";

const body = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["vietnamese", "latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Đầu Tư — nhiều kiểu đầu tư, một nơi so sánh", template: "%s · Đầu Tư" },
  description:
    "Công cụ đầu tư miễn phí: tích sản theo điểm, theo xu hướng, bắt đáy, danh mục cố định và giải ngân khoản tiền lớn cho cổ phiếu VN, cổ phiếu Mỹ, vàng, crypto và tiết kiệm.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { updatedAt } = getSignals();
  return (
    <html lang="vi" suppressHydrationWarning className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <SyncAgent />
          <header className="border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-20">
            <div className="mx-auto max-w-6xl px-4 pt-2 pb-1 sm:py-0 sm:h-14 flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-1">
              <Link href="/" className="font-display text-lg sm:text-xl font-semibold tracking-tight shrink-0">
                Đầu Tư
              </Link>
              <SiteNav />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
          <footer className="border-t border-line text-sm text-muted">
            <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
              <p className="max-w-prose">
                Công cụ tham khảo mang tính giáo dục, không phải lời khuyên đầu tư.{" "}
                <Link href="/mien-tru" className="underline underline-offset-2 hover:text-ink">
                  Đọc miễn trừ trách nhiệm
                </Link>
              </p>
              <p>Dữ liệu cập nhật {fmtDateTime(updatedAt)}</p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
