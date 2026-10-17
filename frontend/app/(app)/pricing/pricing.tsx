"use client";

import { Check } from "lucide-react";
import { limitRows, plans, UPGRADE_MAILTO } from "@/lib/plans";
import { useSubscription } from "@/lib/subscription";
import { PageHeader, primaryBtn } from "../ui";
import { UsageMeter } from "../usage-meter";

export function Pricing() {
  const { data } = useSubscription();
  const current = data?.effectiveTier;
  const expires = data?.subscription?.expiresAt;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Paket & Harga" desc="Mulai gratis, upgrade kalau usaha kamu sudah butuh lebih." />

      <UsageMeter planLink={false} />

      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {plans.map((p) => {
          const isCurrent = current === p.tier;
          return (
            <li key={p.tier} className={`relative flex flex-col justify-between rounded-2xl bg-card p-6 md:p-8 ${p.featured ? "border-2 border-primary shadow-md" : "border shadow-sm"}`}>
              {isCurrent && <span className="absolute -top-3.5 right-6 rounded-full border border-accent/30 bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">Paket kamu sekarang</span>}
              <div>
                <h2 className={`text-xl font-bold ${p.featured ? "text-primary" : ""}`}>{p.name}</h2>
                <p className="mb-2 mt-4">
                  <span className={`tabular text-3xl font-bold tracking-tight md:text-4xl ${p.featured ? "text-primary" : ""}`}>{p.price}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{p.period}</span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                <hr className="my-6" />
                <ul className="space-y-3.5">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <Check aria-hidden className="size-5 shrink-0 text-primary" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              {p.tier === "PRO" && !isCurrent && (
                <div className="mt-8">
                  <a href={UPGRADE_MAILTO} className={`${primaryBtn} w-full`}>
                    Hubungi kami untuk upgrade
                  </a>
                  <p className="mt-2 text-center text-xs text-muted-foreground">Pembayaran online belum tersedia. Upgrade diproses lewat email.</p>
                </div>
              )}
              {p.tier === "PRO" && isCurrent && expires && <p className="mt-8 text-center text-sm text-muted-foreground">Aktif sampai {new Date(expires).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</p>}
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="compare-title" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <h2 id="compare-title" className="border-b p-5 text-lg font-bold md:px-6">
          Perbandingan paket
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-5 py-3 font-semibold md:px-6">Fitur</th>
              <th scope="col" className="px-3 py-3 font-semibold">Gratis</th>
              <th scope="col" className="px-3 py-3 pr-5 font-semibold text-primary md:pr-6">Pro</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {limitRows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="px-5 py-3 font-normal md:px-6">{r.label}</th>
                <td className="tabular px-3 py-3">{r.free}</td>
                <td className="tabular px-3 py-3 pr-5 font-semibold md:pr-6">{r.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
