import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "@marketplace/design-tokens/styles.css";
import "@marketplace/ui-web/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import { SellerShell } from "./seller-shell";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: { default: "Seller Center", template: "%s | Seller Center" },
  description: "Quản lý cửa hàng Marketplace",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" className={inter.variable}>
      <body>
        <Providers>
          <SellerShell>{children}</SellerShell>
        </Providers>
      </body>
    </html>
  );
}
