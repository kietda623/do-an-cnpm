export const colors = {
  accent: "#2563eb",
  accentForeground: "#ffffff",
  accentStrong: "#1d4ed8",
  accentSoft: "#eff5ff",
  background: "#ffffff",
  border: "#d7dde5",
  canvas: "#f6f8fb",
  danger: "#b42318",
  dangerSoft: "#fef3f2",
  foreground: "#17212f",
  info: "#175cd3",
  infoSoft: "#eff8ff",
  line: "#e4e9f0",
  muted: "#f3f5f8",
  mutedForeground: "#5c6675",
  ring: "#2563eb",
  success: "#067647",
  successSoft: "#ecfdf3",
  surface: "#ffffff",
  warning: "#b54708",
  warningSoft: "#fffaeb",
} as const;

export const radii = {
  control: "0.5rem",
  panel: "0.75rem",
  pill: "999px",
} as const;

export const spacing = {
  controlGap: "0.5rem",
  pageGutter: "clamp(1rem, 4vw, 2rem)",
} as const;

export const typography = {
  display: { size: "2.375rem", lineHeight: "2.75rem", weight: 700 },
  h1: { size: "1.875rem", lineHeight: "2.25rem", weight: 700 },
  h2: { size: "1.5rem", lineHeight: "1.875rem", weight: 600 },
  h3: { size: "1.25rem", lineHeight: "1.75rem", weight: 600 },
  body: { size: "1rem", lineHeight: "1.5rem", weight: 400 },
  small: { size: "0.875rem", lineHeight: "1.25rem", weight: 400 },
  caption: { size: "0.75rem", lineHeight: "1rem", weight: 500 },
  metric: { size: "1.75rem", lineHeight: "2.25rem", weight: 700 },
} as const;

export const shadows = {
  card: "0 1px 2px rgb(23 33 47 / 6%), 0 8px 24px rgb(23 33 47 / 5%)",
  popover: "0 12px 32px rgb(23 33 47 / 14%)",
} as const;
