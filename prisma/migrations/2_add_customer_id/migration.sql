-- Good Pets - Migration 2: Add unique 4-digit customerId to User
-- Follows PRD Section 10.1 & Task 4 Customer ID requirements

-- AlterTable
ALTER TABLE "User" ADD COLUMN "customerId" VARCHAR(4);

-- CreateIndex
CREATE UNIQUE INDEX "User_customerId_key" ON "User"("customerId");

