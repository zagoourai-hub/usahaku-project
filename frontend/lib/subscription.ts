import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export type Tier = "FREE" | "PRO";

// Mirrors GET /subscription/me (backend/src/subscription/subscription.module.ts). A null limit = unlimited.
export type SubscriptionSummary = {
  effectiveTier: Tier;
  subscription: { tier: Tier; status: string; expiresAt: string | null } | null;
  limits: {
    recipes: number | null;
    transactionsPerMonth: number | null;
    ocrPerMonth: number | null;
    aiSuggestionsPerMonth: number | null;
    excelExport: boolean;
  };
  usage: { period: string; recipes: number; transactions: number; ocr: number; aiSuggestions: number };
};

export const subscriptionKey = ["subscription", "me"] as const;

export function useSubscription() {
  return useQuery({
    queryKey: subscriptionKey,
    queryFn: () => api<SubscriptionSummary>("/subscription/me"),
  });
}
