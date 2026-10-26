import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@marketplace/design-tokens/styles.css";
import "@marketplace/ui-web/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import { AdminNavigation } from "./admin-navigation";

export const metadata: Metadata = {
  title: { default: "Marketplace Admin", template: "%s | Marketplace Admin" },
  description: "Quản trị Marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <Providers>
          <AdminNavigation />
          {children}
        </Providers>
      </body>
    </html>
  );
}
