-- Reviews: replace the approval workflow with a recoverable takedown.
--
-- Reviews already published immediately and defaulted to APPROVED, so PENDING
-- and APPROVED were the same thing in practice and only REJECTED did any work.
-- That is a delete, so it is modelled as one.
--
-- Order matters here. The REJECTED rows are carried across to deletedAt BEFORE
-- the column goes, or dropping it would quietly republish every review that had
-- ever been taken down — the worst possible outcome of a tidy-up.

ALTER TABLE "ProductReview" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ProductReview" ADD COLUMN "deletedBy" TEXT;

-- Preserve existing takedowns. moderatedAt is when it happened, where known.
UPDATE "ProductReview"
SET "deletedAt" = COALESCE("moderatedAt", CURRENT_TIMESTAMP),
    "deletedBy" = "moderatedBy"
WHERE "status" = 'REJECTED';

DROP INDEX IF EXISTS "ProductReview_productId_status_idx";
DROP INDEX IF EXISTS "ProductReview_status_createdAt_idx";

ALTER TABLE "ProductReview" DROP COLUMN "status";
ALTER TABLE "ProductReview" DROP COLUMN "moderatedBy";
ALTER TABLE "ProductReview" DROP COLUMN "moderatedAt";

DROP TYPE IF EXISTS "ReviewStatus";

CREATE INDEX "ProductReview_productId_deletedAt_idx" ON "ProductReview"("productId", "deletedAt");
CREATE INDEX "ProductReview_deletedAt_createdAt_idx" ON "ProductReview"("deletedAt", "createdAt");
