import React from "react";
import { useLocalSearchParams } from "expo-router";
import { OrderDetailScreen } from "../../../features/commerce/order-detail-screen";

export default function OrderDetailRoute() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  return <OrderDetailScreen orderId={orderId} />;
}
