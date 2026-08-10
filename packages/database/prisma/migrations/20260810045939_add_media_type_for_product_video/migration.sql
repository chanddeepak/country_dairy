-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
ADD COLUMN     "thumbnailUrl" TEXT;

-- AlterTable
ALTER TABLE "ProductReview" ADD COLUMN     "mediaTypes" "MediaType"[];

-- CreateIndex
CREATE INDEX "ProductImage_productId_mediaType_idx" ON "ProductImage"("productId", "mediaType");
