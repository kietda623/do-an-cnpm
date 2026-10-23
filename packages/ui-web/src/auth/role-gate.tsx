"use client";

import type { ReactNode } from "react";
import { useSession } from "./session-provider";

export function RoleGate({ role, children }: { role: string; children: ReactNode }) {
  const { user } = useSession();
  if (!user?.roles.includes(role))
    return <p role="alert">Bạn không có quyền truy cập trang này.</p>;
  return children;
}
