"use client";
import { useParams } from "next/navigation";
import { SellerOrderList } from "@marketplace/ui-web/seller/orders/order-list";
export default function SellerOrdersPage() {
  const { shopId } = useParams<{ shopId: string }>();
  return (
    <SellerOrderList
      shopId={shopId}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}
    />
  );
}
