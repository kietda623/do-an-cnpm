import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "@marketplace/design-tokens/styles.css";
import "@marketplace/ui-web/styles.css";
import "./globals.css";
import { RouteTransition } from "@marketplace/ui-web";
import { Providers } from "./providers";
import { AdminShell } from "./admin-shell";

const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

const display = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const themeScript = `(function(){var k="marketplace-theme";var m="system";try{var s=localStorage.getItem(k);if(s==="light"||s==="dark"||s==="system")m=s;}catch(e){}var d=m==="dark"||(m==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.themeMode=m;})();`;

export const metadata: Metadata = {
  title: { default: "Marketplace Admin", template: "%s | Marketplace Admin" },
  description: "Quản trị Marketplace",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1115" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="vi"
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <RouteTransition />
        <Providers>
          <AdminShell>{children}</AdminShell>
        </Providers>
      </body>
    </html>
  );
}
