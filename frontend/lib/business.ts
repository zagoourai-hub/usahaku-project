import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export const BUSINESS_TYPES = ["WARUNG", "KEDAI_MINUMAN", "KATERING", "LAINNYA"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

// Mirrors BusinessService select (backend/src/business/business.module.ts).
export type Business = {
  id: string;
  name: string;
  type: BusinessType;
  city: string | null;
  dailyProfitTarget: string | null;
  branchLabel: string | null;
  user: { name: string; email: string; emailVerified: boolean };
};

export const businessKey = ["business", "me"] as const;

export function useBusiness() {
  return useQuery({ queryKey: businessKey, queryFn: () => api<Business>("/business/me") });
}
