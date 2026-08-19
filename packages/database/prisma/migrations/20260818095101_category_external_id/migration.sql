-- Collections need a numeric id for the same reason products do: Shiprocket
-- keys on it and cannot hold a UUID.
ALTER TABLE "Category" ADD COLUMN "externalId" BIGSERIAL NOT NULL;
CREATE UNIQUE INDEX "Category_externalId_key" ON "Category"("externalId");
