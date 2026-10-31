export const orderDetailQueryKey = (userId: string, orderId: string) =>
  ["order-detail", userId, orderId] as const;

export const paymentHistoryQueryKey = (userId: string, orderId: string) =>
  ["payment-history", userId, orderId] as const;

export const orderListQueryPrefix = (userId: string) =>
  ["orders", userId] as const;
