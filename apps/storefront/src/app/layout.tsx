import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { sans, mono, display } from "@marketplace/ui-web/fonts";
import type { ReactNode } from "react";
import "@marketplace/design-tokens/styles.css";
import "@marketplace/ui-web/styles.css";
import "./globals.css";
import { RouteTransition, StorefrontShell } from "@marketplace/ui-web";
import { Providers } from "./providers";

const themeScript = `(function(){var k="marketplace-theme";var m="system";try{var s=localStorage.getItem(k);if(s==="light"||s==="dark"||s==="system")m=s;}catch(e){}var d=m==="dark"||(m==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.themeMode=m;})();`;

export const metadata: Metadata = {
  title: { default: "sopi", template: "%s | sopi" },
  description:
    "Sàn thương mại nhiều cửa hàng: mua sắm, theo dõi đơn và thanh toán an toàn.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1115" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="vi"
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body>
        <RouteTransition />
        <Providers>
          <StorefrontShell>{children}</StorefrontShell>
        </Providers>
      </body>
    </html>
  );
}
