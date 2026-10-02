import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export type TxType = "INCOME" | "EXPENSE";

// Mirrors TransactionService / CategoryService (Decimal -> string in JSON).
export type Transaction = {
  id: string;
  type: TxType;
  amount: string;
  description: string | null;
  transactionDate: string; // DATE column -> "YYYY-MM-DDT00:00:00.000Z"
  source: "MANUAL" | "OCR";
  categoryId: string;
  category: { id: string; name: string };
  recipeId: string | null;
  recipe: { id: string; name: string } | null;
  portions: number | null;
  createdAt: string;
};
export type TransactionPage = { items: Transaction[]; total: number; page: number; limit: number };
export type Category = { id: string; name: string; type: TxType; isDefault: boolean };

export const transactionsKey = ["transactions"] as const;

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories"), staleTime: 5 * 60_000 });
}

/** "2026-09-26T00:00:00.000Z" -> "26 Sep" (DATE columns are UTC midnight). */
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });

/** WIB wall-clock time, e.g. "14.20". Defaults to now. */
export const timeOf = (iso: string = new Date().toISOString()) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }); // labelled "WIB" in the UI
