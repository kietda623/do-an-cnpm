import assert from "node:assert/strict";
import { test } from "node:test";
import {
  paymentStatuses,
  sellerOrderStatuses,
  shipmentStatuses,
  shopStatuses,
  statusLabel,
  statusOf,
  userStatuses,
} from "../src/lib/status.ts";

test("seller order, payment and shipment statuses map to Vietnamese labels and tones", () => {
  assert.equal(statusLabel(sellerOrderStatuses, "PENDING"), "Chờ xác nhận");
  assert.equal(statusOf(sellerOrderStatuses, "COMPLETED").tone, "success");
  assert.equal(statusLabel(paymentStatuses, "PARTIALLY_REFUNDED"), "Hoàn tiền một phần");
  assert.equal(statusLabel(shipmentStatuses, "FAILED"), "Giao thất bại");
  assert.equal(statusOf(shipmentStatuses, "IN_TRANSIT").tone, "info");
});

test("shop and user statuses keep their moderation tone", () => {
  assert.equal(statusLabel(shopStatuses, "SUSPENDED"), "Tạm khóa");
  assert.equal(statusOf(shopStatuses, "PENDING").tone, "warning");
  assert.equal(statusLabel(userStatuses, "LOCKED"), "Đã khóa");
  assert.equal(statusOf(userStatuses, "ACTIVE").tone, "success");
});

test("unknown and missing statuses fall back safely", () => {
  assert.deepEqual(statusOf(sellerOrderStatuses, "SOMETHING_NEW"), {
    label: "SOMETHING NEW",
    tone: "neutral",
  });
  assert.deepEqual(statusOf(userStatuses, null), { label: "—", tone: "neutral" });
  assert.equal(statusLabel(userStatuses, undefined), "—");
});
