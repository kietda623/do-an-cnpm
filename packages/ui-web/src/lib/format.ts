const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const integerFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VIETNAM_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VIETNAM_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatVnd(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${integerFormatter.format(amount)}₫`;
}

export function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return integerFormatter.format(amount);
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return compactFormatter.format(value);
}

export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "—";
}

export function formatTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : "—";
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? `${dateFormatter.format(date)} · ${timeFormatter.format(date)}` : "—";
}

/** yyyy-mm-dd for `<input type="date">`, expressed in Asia/Ho_Chi_Minh. */
export function toDateInputValue(value: Date = new Date()): string {
  return isoDateFormatter.format(value);
}

export function startOfVietnamDay(value: Date = new Date()): string {
  return `${toDateInputValue(value)}T00:00:00+07:00`;
}

export function endOfVietnamDay(value: Date = new Date()): string {
  return `${toDateInputValue(value)}T23:59:59.999+07:00`;
}
