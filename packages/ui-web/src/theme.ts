export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "marketplace-theme";

const modes: readonly ThemeMode[] = ["light", "dark", "system"];

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (modes as readonly string[]).includes(value);
}

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === "light" || mode === "dark") return mode;
  return systemDark ? "dark" : "light";
}
