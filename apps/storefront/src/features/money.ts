import { formatVnd as formatVndAmount } from "@marketplace/ui-web";

export function formatVnd(value?: string | null): string {
  return value ? formatVndAmount(value) : "0₫";
}
