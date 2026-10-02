import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";
import type { UsageUnit } from "./ingredients";

// Mirrors RecipeService.list / get (backend/src/recipe/recipe.service.ts). Decimals arrive as strings.
export type Recipe = {
  id: string;
  name: string;
  category: string | null;
  yieldPortions: number;
  targetMarginPct: string;
  currentHpp: string;
  sellingPrice: string | null;
  isActive: boolean;
  recommendedPrice: string;
  updatedAt: string;
};

export type RecipeDetail = Recipe & {
  ingredients: {
    id: string;
    ingredientId: string;
    quantity: string;
    ingredient: { id: string; name: string; usageUnit: UsageUnit; pricePerUsageUnit: string };
  }[];
  overheads: { id: string; name: string; costPerPortion: string }[];
  breakdown: { ingredientsPerPortion: string; overheadPerPortion: string; hppPerPortion: string };
};

export const recipesKey = ["recipes"] as const;

// Mirrors ReportService.recipeSales: portions from INCOME entries linked to a menu.
export type RecipeSales = { recipeId: string; portionsSold: number; previousPortionsSold: number; trend: "up" | "down" | "flat" };

/** Portions sold per menu in [from, to] (YYYY-MM-DD), trend vs the previous period of equal length. */
export function useRecipeSales(from: string, to: string) {
  return useQuery({
    queryKey: [...recipesKey, "sales", from, to],
    queryFn: () => api<RecipeSales[]>(`/reports/recipe-sales?from=${from}&to=${to}`),
  });
}

/** Margin on selling price, display only. null when no price set. */
export function marginPct(hpp: number, price: number | null): number | null {
  if (!price || price <= 0) return null;
  return Math.round(((price - hpp) / price) * 1000) / 10;
}

export type MarginHealth = "good" | "thin" | "loss" | "none";

export function marginHealth(margin: number | null, target: number): MarginHealth {
  if (margin === null) return "none";
  if (margin < 0) return "loss";
  return margin >= target ? "good" : "thin";
}

export const HEALTH_STYLE: Record<MarginHealth, { label: string; text: string; bar: string; badge: string }> = {
  good: { label: "Margin sehat", text: "text-primary", bar: "bg-primary", badge: "bg-primary/10 text-primary" },
  thin: { label: "Di bawah target", text: "text-warning", bar: "bg-warning", badge: "bg-warning-soft text-warning" },
  loss: { label: "Rugi", text: "text-expense", bar: "bg-expense", badge: "bg-expense-soft text-expense" },
  none: { label: "Harga jual belum diisi", text: "text-muted-foreground", bar: "bg-track", badge: "bg-muted text-muted-foreground" },
};
