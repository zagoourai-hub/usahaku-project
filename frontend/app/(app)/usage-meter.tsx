"use client";

import Link from "next/link";
import { useSubscription, type SubscriptionSummary } from "@/lib/subscription";

type Row = { key: string; label: string; used: number; limit: number | null };

function rows(s: SubscriptionSummary): Row[] {
  return [
    { key: "recipes", label: "Resep", used: s.usage.recipes, limit: s.limits.recipes },
    { key: "tx", label: "Catatan kas bulan ini", used: s.usage.transactions, limit: s.limits.transactionsPerMonth },
    { key: "ocr", label: "Scan struk bulan ini", used: s.usage.ocr, limit: s.limits.ocrPerMonth },
    { key: "ai", label: "Saran harga AI bulan ini", used: s.usage.aiSuggestions, limit: s.limits.aiSuggestionsPerMonth },
  ];
}

function Meter({ label, used, limit }: Omit<Row, "key">) {
  if (limit === null) {
    return (
      <li className="flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        <b className="text-primary">{used} · Tanpa batas</b>
      </li>
    );
  }
  const ratio = limit === 0 ? 1 : used / limit;
  const tone = ratio >= 1 ? "bg-expense" : ratio >= 0.8 ? "bg-warning" : "bg-primary";
  return (
    <li>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        <b className={ratio >= 1 ? "text-expense" : undefined}>
          {used} / {limit}
        </b>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-track" role="meter" aria-label={`${label} terpakai`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </li>
  );
}

/** Plan usage for the current month (and recipe count), from GET /subscription/me. */
export function UsageMeter({ planLink = true }: { planLink?: boolean }) {
  const { data, isPending, isError } = useSubscription();
  return (
    <section aria-labelledby="usage-title" className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <h2 id="usage-title" className="text-lg font-bold">
        Pemakaian paket {data ? (data.effectiveTier === "PRO" ? "Pro" : "Gratis") : ""}
      </h2>
      {isPending ? (
        <div aria-busy="true" aria-label="Memuat" className="mt-4 h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      ) : isError ? (
        <p className="mt-3 text-sm text-muted-foreground">Pemakaian belum bisa dimuat.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {rows(data).map(({ key, ...row }) => (
            <Meter key={key} {...row} />
          ))}
        </ul>
      )}
      {planLink && (
        <Link href="/pricing" className="mt-4 inline-block rounded text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Lihat paket dan harga →
        </Link>
      )}
    </section>
  );
}
