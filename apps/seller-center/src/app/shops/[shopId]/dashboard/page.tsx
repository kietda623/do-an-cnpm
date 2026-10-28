"use client";

import { useParams } from "next/navigation";
import { ShopDashboard } from "@marketplace/ui-web/seller/dashboard/shop-dashboard";

export default function DashboardPage() {
  const { shopId } = useParams<{ shopId: string }>();
  return (
    <ShopDashboard
      shopId={shopId}
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}
    />
  );
}
