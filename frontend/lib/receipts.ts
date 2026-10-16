import { useQuery } from "@tanstack/react-query";
import { api, API_URL } from "./api-client";
import type { PurchaseUnit, UsageUnit } from "./ingredients";
import { subscriptionKey, type SubscriptionSummary } from "./subscription";

// Mirrors OcrService.get (backend/src/ocr/ocr.service.ts). Decimals arrive as strings.
export type ReceiptStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED" | "CONFIRMED";
export type ReceiptItem = {
  id: string;
  name: string;
  qty: string;
  unit: string;
  price: string; // line total
  matchedIngredient: { id: string; name: string; purchaseUnit: PurchaseUnit; usageUnit: UsageUnit } | null;
};
export type ReceiptScan = {
  id: string;
  status: ReceiptStatus;
  merchantName: string | null;
  detectedTotal: string | null;
  detectedDate: string | null; // DATE column -> "YYYY-MM-DDT00:00:00.000Z"
  errorMessage: string | null;
  createdAt: string;
  items: ReceiptItem[];
  imageUrl: string; // API-relative, cookie-authenticated
};

export const receiptKey = (id: string) => ["receipts", id] as const;

/** Polls GET /receipts/:id until the worker is done. */
export function useReceiptScan(id: string) {
  return useQuery({
    queryKey: receiptKey(id),
    queryFn: async () => {
      const scan = await api<ReceiptScan>(`/receipts/${id}`);
      return { ...scan, imageUrl: `${API_URL}${scan.imageUrl}` };
    },
    refetchInterval: (q) => (q.state.data?.status === "PENDING" || q.state.data?.status === "PROCESSING" ? 1500 : false),
    retry: false,
  });
}

export type OcrQuota = { used: number; limit: number | null; tier: "FREE" | "PRO" };

/** OCR usage this month from GET /subscription/me. limit null = unlimited. */
export function useOcrQuota() {
  return useQuery({
    queryKey: subscriptionKey,
    queryFn: () => api<SubscriptionSummary>("/subscription/me"),
    select: (s): OcrQuota => ({ used: s.usage.ocr, limit: s.limits.ocrPerMonth, tier: s.effectiveTier }),
  });
}
