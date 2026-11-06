import type { RailStep } from "../primitives/order-rail";

type TimelineStep = { id: string; label: string; compact: string };

const timeline: TimelineStep[] = [
  { id: "PENDING", label: "Chờ xác nhận", compact: "Chờ" },
  { id: "CONFIRMED", label: "Đã xác nhận", compact: "Xác nhận" },
  { id: "SHIPPING", label: "Đang giao", compact: "Giao" },
  { id: "COMPLETED", label: "Hoàn tất", compact: "Xong" },
];

const rank: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  PACKING: 1,
  SHIPPING: 2,
  DELIVERED: 2,
  COMPLETED: 3,
};

export function orderRailCurrent(status: string | null | undefined): string | undefined {
  if (status === "CANCELLED") return "CANCELLED";
  return timeline[rank[status ?? "PENDING"] ?? 0]?.id;
}

export function orderRailSteps(
  status: string | null | undefined,
  options?: { compact?: boolean },
): RailStep[] {
  if (status === "CANCELLED") {
    return [{ id: "CANCELLED", label: "Đã hủy", tone: "danger" }];
  }
  const current = rank[status ?? "PENDING"] ?? 0;
  return timeline.map((step, index) => ({
    id: step.id,
    label: options?.compact ? step.compact : step.label,
    tone: index < current ? "done" : index === current ? "active" : "neutral",
  }));
}
