const protectedPaths = [
  "/cart",
  "/checkout",
  "/orders",
  "/account",
  "/account/addresses",
  "/reviews",
];

export function safeBuyerReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#")
  )
    return "/";

  const path = value.length > 1 ? value.replace(/\/$/, "") : value;
  if (protectedPaths.includes(path)) return path;
  if (/^\/orders\/[A-Za-z0-9_-]+$/.test(path)) return path;
  if (/^\/reviews\/[A-Za-z0-9_-]+$/.test(path)) return path;
  return "/";
}
