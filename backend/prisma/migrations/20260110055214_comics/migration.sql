/*
  Warnings:

  - A unique constraint covering the columns `[comicId,mediaId]` on the table `ComicPage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdById` to the `Comic` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ComicStatus" AS ENUM ('WIP', 'FINISHED', 'DEAD');

-- AlterTable
ALTER TABLE "Comic" ADD COLUMN     "coverMediaId" TEXT,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "isExplicit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastPageAddedAt" TIMESTAMP(3),
ADD COLUMN     "lastPageMediaId" TEXT,
ADD COLUMN     "randomKey" DOUBLE PRECISION NOT NULL DEFAULT random(),
ADD COLUMN     "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratingSum" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "ComicStatus" NOT NULL DEFAULT 'WIP';

-- AlterTable
ALTER TABLE "ComicPage" ADD COLUMN     "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "isComicPage" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ComicTags" (
    "comicId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComicTags_pkey" PRIMARY KEY ("comicId","tagId")
);

-- CreateIndex
CREATE INDEX "ComicTags_tagId_comicId_idx" ON "ComicTags"("tagId", "comicId");

-- CreateIndex
CREATE INDEX "Comic_createdById_idx" ON "Comic"("createdById");

-- CreateIndex
CREATE INDEX "Comic_randomKey_idx" ON "Comic"("randomKey");

-- CreateIndex
CREATE INDEX "Comic_lastPageAddedAt_idx" ON "Comic"("lastPageAddedAt");

-- CreateIndex
CREATE INDEX "Comic_isExplicit_idx" ON "Comic"("isExplicit");

-- CreateIndex
CREATE INDEX "Comic_ratingAvg_idx" ON "Comic"("ratingAvg");

-- CreateIndex
CREATE INDEX "Comic_ratingCount_idx" ON "Comic"("ratingCount");

-- CreateIndex
CREATE INDEX "ComicPage_mediaId_idx" ON "ComicPage"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ComicPage_comicId_mediaId_key" ON "ComicPage"("comicId", "mediaId");

-- CreateIndex
CREATE INDEX "Media_isComicPage_idx" ON "Media"("isComicPage");

-- AddForeignKey
ALTER TABLE "Comic" ADD CONSTRAINT "Comic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comic" ADD CONSTRAINT "Comic_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comic" ADD CONSTRAINT "Comic_lastPageMediaId_fkey" FOREIGN KEY ("lastPageMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComicTags" ADD CONSTRAINT "ComicTags_comicId_fkey" FOREIGN KEY ("comicId") REFERENCES "Comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComicTags" ADD CONSTRAINT "ComicTags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
