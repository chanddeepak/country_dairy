-- The shop delivers across India; the local van round is the exception. The
-- desk moves an order to LOCAL when the address turns out to be inside the
-- van's area, which nothing at checkout can know.
--
-- Only the default changes. Existing orders keep whatever the desk gave them.
ALTER TABLE "Order" ALTER COLUMN "deliveryType" SET DEFAULT 'COURIER';
