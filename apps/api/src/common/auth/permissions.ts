import { SetMetadata } from "@nestjs/common";
import type { SystemRole } from "./access-context.js";

/** Shared system-role policy so services and guards use one authorization rule. */
export function isAdmin(role: SystemRole | null | undefined): boolean {
  return role === "ADMIN";
}

export type AdminPermission =
  | "accessAdmin"
  | "approveShop"
  | "suspendShop"
  | "manageCategories"
  | "lockUser"
  | "hideProduct"
  | "viewAllOrders"
  | "viewPlatformStats"
  | "viewAudit"
  | "confirmReturn"
  | "recoverLockedSellerOrder"
  | "rejectSellerOrder"
  | "manageShipments"
  | "viewPayments"
  | "collectCod";

export const ADMIN_PERMISSION_METADATA = "marketplace:admin-permission";

export function RequireAdminPermission(permission: AdminPermission) {
  return SetMetadata(ADMIN_PERMISSION_METADATA, permission);
}

const adminPermissionChecks: Record<AdminPermission, (role: SystemRole | null | undefined) => boolean> = {
  accessAdmin: isAdmin,
  approveShop: isAdmin,
  suspendShop: isAdmin,
  manageCategories: isAdmin,
  lockUser: isAdmin,
  hideProduct: isAdmin,
  viewAllOrders: isAdmin,
  viewPlatformStats: isAdmin,
  viewAudit: isAdmin,
  confirmReturn: isAdmin,
  recoverLockedSellerOrder: isAdmin,
  rejectSellerOrder: isAdmin,
  manageShipments: isAdmin,
  viewPayments: isAdmin,
  collectCod: isAdmin,
};

export function hasAdminPermission(
  role: SystemRole | null | undefined,
  permission: AdminPermission = "accessAdmin",
): boolean {
  return adminPermissionChecks[permission](role);
}

export const canAccessAdmin = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "accessAdmin");

export const canApproveShop = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "approveShop");
export const canSuspendShop = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "suspendShop");
export const canManageCategories = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "manageCategories");
export const canLockUser = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "lockUser");
export const canHideProduct = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "hideProduct");
export const canViewAllOrders = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "viewAllOrders");
export const canViewPlatformStats = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "viewPlatformStats");
export const canViewAudit = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "viewAudit");
export const canConfirmReturn = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "confirmReturn");
export const canRecoverLockedSellerOrder = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "recoverLockedSellerOrder");
export const canRejectSellerOrder = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "rejectSellerOrder");
export const canManageShipments = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "manageShipments");
export const canViewPayments = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "viewPayments");
export const canCollectCod = (role: SystemRole | null | undefined) =>
  hasAdminPermission(role, "collectCod");
