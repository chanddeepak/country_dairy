-- The idempotency key for Shiprocket's order webhook.
--
-- Their documentation says webhooks may be delivered more than once. Unique,
-- so a replay collides at the database rather than relying on the application
-- checking first and losing a race — two deliveries arriving together would
-- otherwise both find nothing and both create an order.
ALTER TABLE "Order" ADD COLUMN "shiprocketOrderId" TEXT;
CREATE UNIQUE INDEX "Order_shiprocketOrderId_key" ON "Order"("shiprocketOrderId");
