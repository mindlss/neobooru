-- CreateEnum
CREATE TYPE "CommentDeletedKind" AS ENUM ('USER', 'MODERATOR');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedKind" "CommentDeletedKind",
ADD COLUMN     "deletedReason" TEXT;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "commentCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Comment_mediaId_idx" ON "Comment"("mediaId");

-- CreateIndex
CREATE INDEX "Comment_mediaId_deletedAt_idx" ON "Comment"("mediaId", "deletedAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "Media_commentCount_idx" ON "Media"("commentCount");
