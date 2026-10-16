import { useSyncExternalStore } from "react";

// Tiny external store so any failed request (402 quota) can open the upgrade modal
// from outside React, e.g. the QueryClient error handlers in providers.tsx.
let message: string | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function showUpgrade(text: string) {
  message = text;
  emit();
}

export function hideUpgrade() {
  message = null;
  emit();
}

export function useUpgradeMessage() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => message,
    () => null,
  );
}
