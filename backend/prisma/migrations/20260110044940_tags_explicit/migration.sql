-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "isExplicit" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Tag_isExplicit_idx" ON "Tag"("isExplicit");
