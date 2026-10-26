import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as permissions from "./permissions.js";

const permissionNames = [
  "canApproveShop",
  "canSuspendShop",
  "canManageCategories",
  "canLockUser",
  "canHideProduct",
  "canViewAllOrders",
  "canViewPlatformStats",
  "canViewAudit",
  "canConfirmReturn",
  "canRecoverLockedSellerOrder",
  "canRejectSellerOrder",
  "canManageShipments",
  "canViewPayments",
  "canCollectCod",
] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".spec.ts")
      ? [path]
      : [];
  });
}

describe("central Admin permission policy", () => {
  it.each(permissionNames)(
    "defines %s for the current system roles",
    (name) => {
      const permission = (permissions as unknown as Record<string, unknown>)[
        name
      ];
      expect(typeof permission).toBe("function");
      if (typeof permission !== "function") return;
      expect(permission("ADMIN")).toBe(true);
      expect(permission("BUYER")).toBe(false);
      expect(permission(null)).toBe(false);
    },
  );

  it("keeps direct ADMIN role comparisons inside the shared permission module", () => {
    const root = resolve(process.cwd(), "src");
    const violations = sourceFiles(root)
      .filter(
        (file) => !file.endsWith(join("common", "auth", "permissions.ts")),
      )
      .filter((file) =>
        /\b(?:role|systemRole)\s*!?==\s*["']ADMIN["']/.test(
          readFileSync(file, "utf8"),
        ),
      );
    expect(violations).toEqual([]);
  });
});
