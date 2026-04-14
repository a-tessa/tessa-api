CREATE TYPE "NpsResponseStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "NpsResponse" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT,
    "companyName" TEXT,
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "question" TEXT,
    "status" "NpsResponseStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "NpsResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NpsResponse_status_createdAt_idx" ON "NpsResponse"("status", "createdAt");
CREATE INDEX "NpsResponse_createdAt_idx" ON "NpsResponse"("createdAt");

ALTER TABLE "NpsResponse" ADD CONSTRAINT "NpsResponse_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
