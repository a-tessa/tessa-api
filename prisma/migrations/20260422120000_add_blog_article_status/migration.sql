-- CreateEnum
CREATE TYPE "BlogArticleStatus" AS ENUM ('draft', 'published');

-- AlterTable: add status column with default draft
ALTER TABLE "BlogArticle" ADD COLUMN "status" "BlogArticleStatus" NOT NULL DEFAULT 'draft';

-- Backfill: mark all existing articles as published (preserve current behavior)
UPDATE "BlogArticle" SET "status" = 'published';

-- AlterTable: make publishedAt nullable (drop default, allow null)
ALTER TABLE "BlogArticle" ALTER COLUMN "publishedAt" DROP NOT NULL;
ALTER TABLE "BlogArticle" ALTER COLUMN "publishedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "BlogArticle_status_idx" ON "BlogArticle"("status");
