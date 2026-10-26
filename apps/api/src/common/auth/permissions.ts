import type { SystemRole } from "./access-context.js";

/** Shared system-role policy so services and guards use one authorization rule. */
export function isAdmin(role: SystemRole | null | undefined): boolean {
  return role === "ADMIN";
}
