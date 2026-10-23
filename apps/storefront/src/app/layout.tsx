import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@marketplace/design-tokens/styles.css";
import "@marketplace/ui-web/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "Marketplace", template: "%s | Marketplace" },
  description: "Multi-vendor marketplace",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <nav
          aria-label="Điều hướng chính"
          className="sticky top-0 z-40 flex justify-center gap-3 border-b bg-white/95 px-2 py-3 text-xs shadow-sm backdrop-blur sm:gap-5 sm:px-4 sm:text-sm"
        >
          <Link className="font-semibold" href="/">
            Marketplace
          </Link>
          <Link href="/products">Sản phẩm</Link>
          <Link href="/cart">Giỏ hàng</Link>
          <Link href="/orders">Đơn hàng</Link>
          <Link href="/account">Tài khoản</Link>
        </nav>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
