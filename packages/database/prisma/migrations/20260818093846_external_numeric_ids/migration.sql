-- A stable numeric id on products and variants.
--
-- Shiprocket Checkout cannot hold a UUID: "products[].id and
-- products[].variants[].id must be unique. Both ids should be of long
-- data-type." It stores the number and sends it back on every order, so it
-- must be stable for the life of the row — a recycled value would point their
-- existing orders at a different product.
--
-- BIGSERIAL rather than a computed value for exactly that reason: the sequence
-- never goes backwards, and a deleted product's number is never handed to
-- another one.
--
-- The UUID stays the primary key. Nothing internal reads this column; it
-- exists solely so an outside system has something it can store.

ALTER TABLE "Product" ADD COLUMN "externalId" BIGSERIAL NOT NULL;
ALTER TABLE "ProductVariant" ADD COLUMN "externalId" BIGSERIAL NOT NULL;

-- Unique, because it is an identifier a third party will key on. Without this
-- a bug that duplicated the value would surface as their orders silently
-- attaching to the wrong jar.
CREATE UNIQUE INDEX "Product_externalId_key" ON "Product"("externalId");
CREATE UNIQUE INDEX "ProductVariant_externalId_key" ON "ProductVariant"("externalId");
