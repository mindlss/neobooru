-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "randomKey" DOUBLE PRECISION NOT NULL DEFAULT random();

-- CreateIndex
CREATE INDEX "Media_randomKey_idx" ON "Media"("randomKey");
