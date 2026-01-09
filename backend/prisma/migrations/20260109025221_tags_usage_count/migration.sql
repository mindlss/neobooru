-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Tag_usageCount_idx" ON "Tag"("usageCount");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");
