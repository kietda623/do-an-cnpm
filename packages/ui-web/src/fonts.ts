import localFont from "next/font/local";

// Shared, licensed font files keep development and CI independent of Google CSS.
export const sans = localFont({
  src: [
    {
      path: "../../design-tokens/fonts/BeVietnamPro-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../design-tokens/fonts/BeVietnamPro-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../design-tokens/fonts/BeVietnamPro-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../design-tokens/fonts/BeVietnamPro-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

export const mono = localFont({
  src: [
    {
      path: "../../design-tokens/fonts/IBMPlexMono-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../design-tokens/fonts/IBMPlexMono-Medium.ttf",
      weight: "500",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

export const display = localFont({
  src: "../../design-tokens/fonts/SpaceGrotesk-Variable.ttf",
  weight: "300 700",
  display: "swap",
  variable: "--font-space-grotesk",
});
