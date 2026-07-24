-- Rename the imported resource to match the domain language.
ALTER TABLE "InstagramPost" RENAME TO "InstagramMedia";

ALTER INDEX "InstagramPost_instagramMediaId_key"
  RENAME TO "InstagramMedia_instagramMediaId_key";
ALTER INDEX "InstagramPost_connectionId_publishedAt_idx"
  RENAME TO "InstagramMedia_connectionId_publishedAt_idx";
ALTER INDEX "InstagramPost_isActive_publishedAt_idx"
  RENAME TO "InstagramMedia_isAvailable_publishedAt_idx";

ALTER TABLE "InstagramMedia"
  RENAME CONSTRAINT "InstagramPost_pkey" TO "InstagramMedia_pkey";
ALTER TABLE "InstagramMedia"
  RENAME CONSTRAINT "InstagramPost_connectionId_fkey"
  TO "InstagramMedia_connectionId_fkey";

-- Facebook Login for Business identifies both the Page and linked IG account.
ALTER TABLE "InstagramConnection"
  ADD COLUMN "facebookPageId" TEXT,
  ADD COLUMN "facebookPageName" TEXT;

UPDATE "InstagramConnection"
SET
  "facebookPageId" = 'reconnect-required-' || "id",
  "facebookPageName" = 'Reconexão necessária'
WHERE "facebookPageId" IS NULL;

ALTER TABLE "InstagramConnection"
  ALTER COLUMN "facebookPageId" SET NOT NULL,
  ALTER COLUMN "facebookPageName" SET NOT NULL;

CREATE UNIQUE INDEX "InstagramConnection_facebookPageId_key"
  ON "InstagramConnection"("facebookPageId");

-- CDN URLs are refreshed from Meta; binaries are no longer mirrored.
ALTER TABLE "InstagramMedia"
  DROP COLUMN "imagePathname";

ALTER TABLE "InstagramMedia"
  RENAME COLUMN "isActive" TO "isAvailable";

ALTER TABLE "InstagramMedia"
  ADD COLUMN "isCollaborative" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "unavailableAt" TIMESTAMP(3);

-- Keep existing translations attached while aligning entity terminology.
UPDATE "Translation"
SET "entityType" = 'instagramMedia'
WHERE "entityType" = 'instagramPost';

-- Old mirrored asset metadata is no longer authoritative.
DELETE FROM "Asset"
WHERE "entityType" = 'instagramPost';
