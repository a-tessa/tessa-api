-- CreateEnum
CREATE TYPE "GalleryMediaKind" AS ENUM ('photo', 'video');

-- CreateTable
CREATE TABLE "GalleryMediaItem" (
    "id" TEXT NOT NULL,
    "kind" "GalleryMediaKind" NOT NULL,
    "alt" TEXT NOT NULL,
    "caption" TEXT,
    "categorySlug" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "imagePathname" TEXT,
    "imageMimeType" TEXT,
    "imageSizeBytes" INTEGER,
    "imageOriginalFilename" TEXT,
    "youtubeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "GalleryMediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryMediaItem_kind_order_idx" ON "GalleryMediaItem"("kind", "order");

-- CreateIndex
CREATE INDEX "GalleryMediaItem_categorySlug_idx" ON "GalleryMediaItem"("categorySlug");

-- CreateIndex
CREATE INDEX "GalleryMediaItem_imageUrl_idx" ON "GalleryMediaItem"("imageUrl");

-- AddForeignKey
ALTER TABLE "GalleryMediaItem" ADD CONSTRAINT "GalleryMediaItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
