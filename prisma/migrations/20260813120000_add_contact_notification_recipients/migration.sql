-- CreateTable
CREATE TABLE "ContactNotificationRecipient" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactNotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactNotificationRecipient_email_key" ON "ContactNotificationRecipient"("email");

-- CreateIndex
CREATE INDEX "ContactNotificationRecipient_sortOrder_idx" ON "ContactNotificationRecipient"("sortOrder");
