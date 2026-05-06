ALTER TABLE "Rating" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Rating_userId_createdAt_idx" ON "Rating"("userId", "createdAt");
