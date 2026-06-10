-- CreateEnum
CREATE TYPE "TranslationLocale" AS ENUM ('en', 'es');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" "TranslationLocale" NOT NULL,
    "status" "TranslationStatus" NOT NULL DEFAULT 'pending',
    "content" JSONB,
    "sourceHash" TEXT NOT NULL,
    "model" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "translatedAt" TIMESTAMP(3),

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Translation_status_idx" ON "Translation"("status");

-- CreateIndex
CREATE INDEX "Translation_entityType_entityId_idx" ON "Translation"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_entityType_entityId_locale_key" ON "Translation"("entityType", "entityId", "locale");
