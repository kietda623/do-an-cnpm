import { NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client.js";

/** Recheck current membership on every existing-order operation. */
export async function canFulfillExistingOrder(
  tx: Prisma.TransactionClient,
  userId: string,
  shopId: string,
): Promise<void> {
  const membership = await tx.shopMember.findFirst({
    where: {
      userId,
      shopId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      shop: { status: { in: ["ACTIVE", "SUSPENDED"] } },
    },
    select: { id: true },
  });
  if (!membership) throw new NotFoundException();
}
