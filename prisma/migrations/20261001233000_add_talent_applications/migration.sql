-- CreateTable
CREATE TABLE "TalentApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "educationLevel" TEXT NOT NULL,
    "education" TEXT NOT NULL,
    "practiceArea" TEXT NOT NULL,
    "professionalSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TalentApplication_createdAt_idx" ON "TalentApplication"("createdAt");

-- CreateIndex
CREATE INDEX "TalentApplication_practiceArea_idx" ON "TalentApplication"("practiceArea");
