-- Receipt photos are purged by the maintenance job; the scan row can outlive its photo.
ALTER TABLE "ReceiptScan" ALTER COLUMN "imageKey" DROP NOT NULL;
