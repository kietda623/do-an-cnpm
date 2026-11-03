const vietnamClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Saigon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function localTimestamp(date: Date) {
  const parts = Object.fromEntries(
    vietnamClock.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year!.padStart(4, "0")}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function vietnamInput(date: Date) {
  return localTimestamp(date).slice(0, 16);
}

export function vietnamInputToUtc(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target)) return null;
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const observed = Date.parse(`${localTimestamp(new Date(instant))}Z`);
    if (!Number.isFinite(observed)) return null;
    const correction = target - observed;
    if (correction === 0) return new Date(instant).toISOString();
    instant += correction;
  }
  return null;
}

export function lastDaysRange(days: number) {
  const to = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function defaultRangeInputs(days = 30) {
  const range = lastDaysRange(days);
  return { from: vietnamInput(new Date(range.from)), to: vietnamInput(new Date(range.to)) };
}
