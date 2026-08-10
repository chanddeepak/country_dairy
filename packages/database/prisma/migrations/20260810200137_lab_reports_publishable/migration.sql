-- AlterTable
ALTER TABLE "LabReport" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "labName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "fileUrl" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "LabReport_testDate_idx" ON "LabReport"("testDate");

-- CreateIndex
CREATE UNIQUE INDEX "LabReport_productId_batchNumber_key" ON "LabReport"("productId", "batchNumber");

