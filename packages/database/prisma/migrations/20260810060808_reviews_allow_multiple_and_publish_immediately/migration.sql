-- DropIndex
DROP INDEX "ProductReview_userId_productId_key";

-- AlterTable
ALTER TABLE "ProductReview" ADD COLUMN     "editedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'APPROVED';

-- CreateIndex
CREATE INDEX "ProductReview_userId_productId_idx" ON "ProductReview"("userId", "productId");
