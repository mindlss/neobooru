-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratingSum" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Media_ratingAvg_idx" ON "Media"("ratingAvg");

-- CreateIndex
CREATE INDEX "Media_ratingCount_idx" ON "Media"("ratingCount");
