-- CreateEnum
CREATE TYPE "TestimonialSource" AS ENUM ('submitted', 'google');

-- AlterTable
ALTER TABLE "Testimonial" ADD COLUMN     "authorUrl" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "relativeTime" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "source" "TestimonialSource" NOT NULL DEFAULT 'submitted',
ADD COLUMN     "sourceCreatedAt" TIMESTAMP(3),
ADD COLUMN     "sourceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Testimonial_externalId_key" ON "Testimonial"("externalId");

-- CreateIndex
CREATE INDEX "Testimonial_source_hidden_removedAt_idx" ON "Testimonial"("source", "hidden", "removedAt");
