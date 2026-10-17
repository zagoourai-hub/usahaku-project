"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { hideUpgrade, useUpgradeMessage } from "@/lib/upgrade";
import { Sheet } from "./sheet";

/** Opens on any 402 (plan limit reached), see providers.tsx. */
export function UpgradeModal() {
  const message = useUpgradeMessage();
  return (
    <Sheet open={message !== null} onClose={hideUpgrade} title="Batas paket tercapai">
      <div className="space-y-4">
        <p className="flex items-start gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span className="pt-1.5">{message}</span>
        </p>
        <p className="text-sm text-muted-foreground">Paket Pro membuka resep dan catatan kas tanpa batas, 300 scan struk per bulan, dan export Excel.</p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Link
            href="/pricing"
            onClick={hideUpgrade}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          >
            Lihat paket Pro
          </Link>
          <button type="button" onClick={hideUpgrade} className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border bg-card px-5 text-sm font-semibold transition-colors hover:bg-muted">
            Nanti saja
          </button>
        </div>
      </div>
    </Sheet>
  );
}
