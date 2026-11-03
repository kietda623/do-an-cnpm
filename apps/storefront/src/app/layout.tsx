import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "@marketplace/design-tokens/styles.css";
import "@marketplace/ui-web/styles.css";
import "./globals.css";
import { StorefrontShell } from "@marketplace/ui-web";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: { default: "Marketplace", template: "%s | Marketplace" },
  description: "Sàn thương mại nhiều cửa hàng: mua sắm, theo dõi đơn và thanh toán an toàn.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" className={inter.variable}>
      <body>
        <Providers>
          <StorefrontShell>{children}</StorefrontShell>
        </Providers>
      </body>
    </html>
  );
}
