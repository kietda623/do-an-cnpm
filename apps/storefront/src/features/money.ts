export function formatVnd(value: string): string {
  return `${new Intl.NumberFormat("vi-VN").format(BigInt(value))}₫`;
}
