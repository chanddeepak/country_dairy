-- Shiprocket checkout is removed, so the id their webhook sent back has
-- nothing left to point at.
--
-- BEFORE APPLYING TO PRODUCTION, confirm the column is empty there:
--
--   SELECT count(*) FROM "Order" WHERE "shiprocketOrderId" IS NOT NULL;
--
-- Dev returns 0 and the integration never ran outside a flag that stayed off,
-- so it should be 0 everywhere — but this drop is not reversible, and a
-- non-zero count means an order whose external reference would be lost.
DROP INDEX IF EXISTS "Order_shiprocketOrderId_key";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "shiprocketOrderId";
