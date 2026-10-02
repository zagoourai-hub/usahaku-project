-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'CONFIRMED');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "receiptScanId" UUID;

-- CreateTable
CREATE TABLE "PriceSuggestion" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "hppAtRequest" DECIMAL(14,2) NOT NULL,
    "minPrice" DECIMAL(14,2) NOT NULL,
    "maxPrice" DECIMAL(14,2) NOT NULL,
    "recommendedPrice" DECIMAL(14,2) NOT NULL,
    "reasoning" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptScan" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "imageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "rawResult" JSONB,
    "detectedTotal" DECIMAL(14,2),
    "detectedDate" DATE,
    "merchantName" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptItem" (
    "id" UUID NOT NULL,
    "receiptScanId" UUID NOT NULL,
    "matchedIngredientId" UUID,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceSuggestion_recipeId_createdAt_idx" ON "PriceSuggestion"("recipeId", "createdAt");

-- CreateIndex
CREATE INDEX "ReceiptScan_businessId_createdAt_idx" ON "ReceiptScan"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "ReceiptScan_status_idx" ON "ReceiptScan"("status");

-- CreateIndex
CREATE INDEX "ReceiptItem_receiptScanId_idx" ON "ReceiptItem"("receiptScanId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_receiptScanId_key" ON "Transaction"("receiptScanId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_receiptScanId_fkey" FOREIGN KEY ("receiptScanId") REFERENCES "ReceiptScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSuggestion" ADD CONSTRAINT "PriceSuggestion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptScan" ADD CONSTRAINT "ReceiptScan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_receiptScanId_fkey" FOREIGN KEY ("receiptScanId") REFERENCES "ReceiptScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_matchedIngredientId_fkey" FOREIGN KEY ("matchedIngredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

