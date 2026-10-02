import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export const PURCHASE_UNITS = ["kg", "liter", "pack", "pcs"] as const;
export const USAGE_UNITS = ["gram", "ml", "pcs"] as const;
export type PurchaseUnit = (typeof PURCHASE_UNITS)[number];
export type UsageUnit = (typeof USAGE_UNITS)[number];

// Mirrors FACTORS in backend/src/ingredient/unit-conversion.ts.
export const ALLOWED_USAGE: Record<PurchaseUnit, UsageUnit[]> = {
  kg: ["gram"],
  liter: ["ml"],
  pcs: ["pcs"],
  pack: ["gram", "ml", "pcs"],
};

export type Ingredient = {
  id: string;
  name: string;
  purchaseUnit: PurchaseUnit;
  purchaseQty: string;
  usageUnit: UsageUnit;
  purchasePrice: string;
  pricePerUsageUnit: string;
  updatedAt: string;
  _count: { recipeItems: number };
  /** Latest first, max 2: the list shows the last price change. */
  priceLogs: { purchasePrice: string; createdAt: string }[];
};

/** % change of the last price update, 1 decimal. null when the price never changed. */
export function lastPriceChangePct(i: Ingredient): number | null {
  const [latest, previous] = i.priceLogs;
  if (!latest || !previous || Number(previous.purchasePrice) === 0) return null;
  return Math.round(((Number(latest.purchasePrice) - Number(previous.purchasePrice)) / Number(previous.purchasePrice)) * 1000) / 10;
}

export const ingredientsKey = ["ingredients"] as const;

export function useIngredients(q = "") {
  return useQuery({
    queryKey: [...ingredientsKey, q],
    queryFn: () => api<Ingredient[]>(`/ingredients${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });
}
