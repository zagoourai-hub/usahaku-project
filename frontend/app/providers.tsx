"use client";

import type { ReactNode } from "react";
import { environmentManager, MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api-client";
import { showUpgrade } from "@/lib/upgrade";
import { UpgradeModal } from "./_components/upgrade-modal";

// Expired/invalid cookie: clear it server-side first, otherwise proxy.ts would
// bounce /login straight back to /dashboard.
async function onError(error: unknown) {
  // Plan quota reached: offer the upgrade instead of leaving a bare error.
  if (error instanceof ApiError && error.status === 402) showUpgrade(error.message);
  if (!(error instanceof ApiError) || error.status !== 401) return;
  await api("/auth/sign-out", { method: "POST", body: "{}" }).catch(() => undefined);
  window.location.replace("/login");
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
      <UpgradeModal />
    </QueryClientProvider>
  );
}
