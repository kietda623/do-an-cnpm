export function formatVnd(value?: string | null): string {
  if (!value) return "0₫";
  return `${new Intl.NumberFormat("vi-VN").format(BigInt(value))}₫`;
}
