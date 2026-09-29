-- cart.service reads a user's cart with findUnique({ where: { userId } }), which
-- Prisma only generates when the column is unique. The plain index is replaced
-- by the unique one rather than kept alongside it.
DROP INDEX "Cart_userId_idx";
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- VoucherUsage.userId was a bare column, so the redemption report could not
-- reach the buyer. RESTRICT matches the schema's default action for a required
-- relation — a user with redemptions on record cannot be hard-deleted.
ALTER TABLE "VoucherUsage" ADD CONSTRAINT "VoucherUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
