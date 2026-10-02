-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "branchLabel" TEXT,
ADD COLUMN     "dailyProfitTarget" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "portions" INTEGER,
ADD COLUMN     "recipeId" UUID;

-- CreateIndex
CREATE INDEX "Transaction_recipeId_transactionDate_idx" ON "Transaction"("recipeId", "transactionDate");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
