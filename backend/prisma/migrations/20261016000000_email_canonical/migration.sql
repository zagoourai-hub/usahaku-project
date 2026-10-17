-- AlterTable: add nullable, backfill, then enforce. Existing rows keep their
-- own email as canonical (aliases registered before this cannot be merged).
ALTER TABLE "User" ADD COLUMN "emailCanonical" TEXT;
UPDATE "User" SET "emailCanonical" = "email";
ALTER TABLE "User" ALTER COLUMN "emailCanonical" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailCanonical_key" ON "User"("emailCanonical");
