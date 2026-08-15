-- Lets a specific size have its own card on the homepage shelf.
--
-- Defaults to false so nothing on any existing storefront changes: products
-- keep appearing once, at their default size, until someone opts a variant in.
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "showOnHome" BOOLEAN NOT NULL DEFAULT false;
