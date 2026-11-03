export type Tone = "neutral" | "accent" | "success" | "warning" | "info" | "danger";

export interface StatusMeta {
  label: string;
  tone: Tone;
}

export type StatusMap = Record<string, StatusMeta>;

export const sellerOrderStatuses: StatusMap = {
  PENDING: { label: "Chờ xác nhận", tone: "warning" },
  CONFIRMED: { label: "Đã xác nhận", tone: "info" },
  PACKING: { label: "Đang đóng gói", tone: "info" },
  SHIPPING: { label: "Đang giao", tone: "accent" },
  DELIVERED: { label: "Đã giao", tone: "accent" },
  COMPLETED: { label: "Hoàn tất", tone: "success" },
  CANCELLED: { label: "Đã hủy", tone: "danger" },
};

export const marketplaceOrderStatuses: StatusMap = sellerOrderStatuses;

export const paymentStatuses: StatusMap = {
  UNPAID: { label: "Chưa thanh toán", tone: "warning" },
  PARTIALLY_PAID: { label: "Thanh toán một phần", tone: "info" },
  PAID: { label: "Đã thanh toán", tone: "success" },
  PARTIALLY_REFUNDED: { label: "Hoàn tiền một phần", tone: "info" },
  REFUNDED: { label: "Đã hoàn tiền", tone: "accent" },
};

export const paymentAttemptStatuses: StatusMap = {
  PENDING: { label: "Đang xử lý", tone: "warning" },
  SUCCEEDED: { label: "Thành công", tone: "success" },
  FAILED: { label: "Thất bại", tone: "danger" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
};

export const paymentMethods: StatusMap = {
  COD: { label: "Thanh toán khi nhận hàng", tone: "neutral" },
  MOCK: { label: "Thanh toán mô phỏng", tone: "info" },
};

export const shopStatuses: StatusMap = {
  PENDING: { label: "Chờ duyệt", tone: "warning" },
  ACTIVE: { label: "Đang hoạt động", tone: "success" },
  REJECTED: { label: "Bị từ chối", tone: "danger" },
  SUSPENDED: { label: "Tạm khóa", tone: "danger" },
};

export const userStatuses: StatusMap = {
  ACTIVE: { label: "Đang hoạt động", tone: "success" },
  LOCKED: { label: "Đã khóa", tone: "danger" },
};

export const productStatuses: StatusMap = {
  DRAFT: { label: "Bản nháp", tone: "neutral" },
  ACTIVE: { label: "Đang bán", tone: "success" },
  DISCONTINUED: { label: "Ngừng bán", tone: "neutral" },
  HIDDEN: { label: "Đã ẩn", tone: "warning" },
};

export const shipmentStatuses: StatusMap = {
  WAITING_PICKUP: { label: "Chờ lấy hàng", tone: "warning" },
  PICKED_UP: { label: "Đã lấy hàng", tone: "info" },
  IN_TRANSIT: { label: "Đang vận chuyển", tone: "info" },
  DELIVERED: { label: "Đã giao", tone: "accent" },
  FAILED: { label: "Giao thất bại", tone: "danger" },
};

export const categoryStatuses: StatusMap = {
  VISIBLE: { label: "Đang hiển thị", tone: "success" },
  HIDDEN: { label: "Đang ẩn", tone: "warning" },
};

export const shopMemberRoles: StatusMap = {
  OWNER: { label: "Chủ cửa hàng", tone: "accent" },
  MANAGER: { label: "Quản lý", tone: "info" },
};

export function statusOf(map: StatusMap, value: string | null | undefined): StatusMeta {
  if (!value) return { label: "—", tone: "neutral" };
  return map[value] ?? { label: value.replaceAll("_", " "), tone: "neutral" };
}

export function statusLabel(map: StatusMap, value: string | null | undefined): string {
  return statusOf(map, value).label;
}
