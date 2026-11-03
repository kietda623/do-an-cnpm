import assert from "node:assert/strict";
import { test } from "node:test";
import {
  endOfVietnamDay,
  formatDate,
  formatDateTime,
  formatNumber,
  formatVnd,
  startOfVietnamDay,
  toDateInputValue,
} from "../src/lib/format.ts";

test("formatVnd renders Vietnamese dong without a stray space", () => {
  assert.equal(formatVnd(1_500_000), "1.500.000₫");
  assert.equal(formatVnd("303"), "303₫");
  assert.equal(formatVnd(0), "0₫");
});

test("formatVnd and formatNumber reject empty or invalid input", () => {
  assert.equal(formatVnd(""), "—");
  assert.equal(formatVnd(null), "—");
  assert.equal(formatVnd(Number.NaN), "—");
  assert.equal(formatNumber(1_234_567), "1.234.567");
  assert.equal(formatNumber(undefined), "—");
});

test("dates and times render in Asia/Ho_Chi_Minh", () => {
  const instant = "2026-10-27T17:30:00.000Z";
  assert.equal(formatDate(instant), "28/10/2026");
  assert.equal(formatDateTime(instant), "28/10/2026 · 00:30");
  assert.equal(formatDate("not-a-date"), "—");
});

test("day boundaries for date inputs follow the Vietnam timezone", () => {
  const instant = new Date("2026-10-27T17:30:00Z");
  assert.equal(toDateInputValue(instant), "2026-10-28");
  assert.equal(startOfVietnamDay(instant), "2026-10-28T00:00:00+07:00");
  assert.equal(endOfVietnamDay(instant), "2026-10-28T23:59:59.999+07:00");
});
