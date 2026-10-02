"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet, Loader2, Lock } from "lucide-react";
import { api, ApiError, download } from "@/lib/api-client";
import { daysAgo, formatIDR, toISODate } from "@/lib/format";
import { EmptyState, ErrorBox, ghostBtn, ListSkeleton, PageHeader } from "../ui";

// Mirrors ReportService.profitLoss (backend/src/report/report.service.ts).
type Line = { category: string; amount: string };
type ProfitLoss = { businessName: string; from: string; to: string; income: Line[]; expense: Line[]; totalIncome: string; totalExpense: string; netProfit: string };
type SubscriptionMe = { effectiveTier: "FREE" | "PRO"; limits: { excelExport: boolean } };

function presets(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  return [
    { label: "Bulan ini", from: toISODate(new Date(y, m, 1)), to: toISODate(today) },
    { label: "Bulan lalu", from: toISODate(new Date(y, m - 1, 1)), to: toISODate(new Date(y, m, 0)) },
    { label: "30 hari", from: toISODate(daysAgo(29, today)), to: toISODate(today) },
  ];
}

const rangeLabel = (from: string, to: string) =>
  [from, to].map((d) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })).join(" – ");

export function Reports() {
  const options = presets();
  const [range, setRange] = useState({ from: options[0]!.from, to: options[0]!.to });
  const valid = range.from !== "" && range.to !== "" && range.from <= range.to;
  const qs = `from=${range.from}&to=${range.to}`;

  const report = useQuery({ queryKey: ["reports", "profit-loss", qs], queryFn: () => api<ProfitLoss>(`/reports/profit-loss?${qs}`), enabled: valid });
  const sub = useQuery({ queryKey: ["subscription"], queryFn: () => api<SubscriptionMe>("/subscription/me") });
  const exporter = useMutation({
    mutationFn: (format: "pdf" | "xlsx") => download(`/reports/export?${qs}&format=${format}`, `laba-rugi_${range.from}_${range.to}.${format}`),
  });
  const excelAllowed = sub.data?.limits.excelExport ?? false;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Laporan Laba Rugi"
        desc="Ringkasan pendapatan dan beban per kategori."
        action={
          <div className="flex gap-2">
            <button type="button" onClick={() => exporter.mutate("pdf")} disabled={!valid || exporter.isPending} className={ghostBtn}>
              {exporter.isPending && exporter.variables === "pdf" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <FileDown className="size-4" />}
              PDF
            </button>
            <button
              type="button"
              onClick={() => exporter.mutate("xlsx")}
              disabled={!valid || exporter.isPending || !excelAllowed}
              title={excelAllowed ? undefined : "Export Excel hanya untuk paket PRO"}
              className={ghostBtn}
            >
              {excelAllowed ? <FileSpreadsheet className="size-4" /> : <Lock className="size-4" />}
              Excel
              {!excelAllowed && <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-accent-foreground">PRO</span>}
            </button>
          </div>
        }
      />

      <section aria-label="Periode laporan" className="flex flex-col gap-3 rounded-2xl border bg-card p-3 md:flex-row md:items-end">
        <div className="flex flex-wrap gap-2">
          {options.map((p) => {
            const active = p.from === range.from && p.to === range.to;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() => setRange({ from: p.from, to: p.to })}
                className="h-10 rounded-full border px-4 text-sm font-semibold text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3">
          <label className="text-xs font-semibold">
            Dari
            <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="mt-1 h-10 w-full rounded-md border bg-card px-2 text-sm font-normal dark:bg-card-inner" />
          </label>
          <label className="text-xs font-semibold">
            Sampai
            <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="mt-1 h-10 w-full rounded-md border bg-card px-2 text-sm font-normal dark:bg-card-inner" />
          </label>
        </div>
      </section>

      {exporter.isError && <ErrorBox message={exporter.error instanceof ApiError ? exporter.error.message : "Gagal mengunduh laporan."} />}

      {!valid ? (
        <ErrorBox message="Tanggal awal harus sebelum atau sama dengan tanggal akhir." />
      ) : report.isError ? (
        <ErrorBox message={report.error instanceof ApiError ? report.error.message : "Gagal memuat laporan."} onRetry={() => report.refetch()} />
      ) : report.isPending ? (
        <ListSkeleton rows={3} />
      ) : report.data.income.length === 0 && report.data.expense.length === 0 ? (
        <EmptyState title="Belum ada transaksi di periode ini" desc="Pilih periode lain atau catat transaksi dulu." />
      ) : (
        <article aria-labelledby="pl-title" className="rounded-2xl border bg-card p-5 md:p-8">
          <header className="border-b pb-4">
            <h2 id="pl-title" className="text-lg font-bold">{report.data.businessName}</h2>
            <p className="text-sm text-muted-foreground">Periode {rangeLabel(report.data.from, report.data.to)}</p>
          </header>
          <Section title="Pendapatan" lines={report.data.income} total={report.data.totalIncome} tone="income" />
          <Section title="Beban" lines={report.data.expense} total={report.data.totalExpense} tone="expense" />
          <div className={`mt-6 flex items-center justify-between rounded-xl p-4 ${Number(report.data.netProfit) < 0 ? "bg-expense-soft text-expense" : "bg-income-soft text-income"}`}>
            <span className="font-bold">{Number(report.data.netProfit) < 0 ? "Rugi Bersih" : "Laba Bersih"}</span>
            <span className="tabular text-2xl font-bold">
              {Number(report.data.netProfit) < 0 && "−"}
              {formatIDR(report.data.netProfit)}
            </span>
          </div>
        </article>
      )}
    </main>
  );
}

function Section({ title, lines, total, tone }: { title: string; lines: Line[]; total: string; tone: "income" | "expense" }) {
  const totalN = Number(total);
  return (
    <section className="mt-6">
      <h3 className="font-mono text-xs font-bold text-muted-foreground">{title}</h3>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Tidak ada.</p>
      ) : (
        <table className="mt-2 w-full table-fixed text-sm">
          <caption className="sr-only">{title} per kategori</caption>
          {/* Fixed columns keep the income and expense tables aligned */}
          <colgroup>
            <col />
            <col className="w-1/3" />
            <col className="w-36 sm:w-44" />
          </colgroup>
          <thead className="sr-only">
            <tr>
              <th scope="col">Kategori</th>
              <th scope="col">Porsi</th>
              <th scope="col">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const share = totalN > 0 ? Math.round((Number(l.amount) / totalN) * 100) : 0;
              return (
                <tr key={l.category} className="border-b last:border-0">
                  <th scope="row" className="truncate py-2.5 text-left font-medium">{l.category}</th>
                  <td className="px-3">
                    <div className="flex items-center gap-2">
                      <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                        <div className={`h-full rounded-full ${tone === "income" ? "bg-chart-income" : "bg-chart-expense"}`} style={{ width: `${share}%` }} />
                      </div>
                      <span className="tabular w-9 text-right text-xs text-muted-foreground">{share}%</span>
                    </div>
                  </td>
                  <td className="tabular py-2.5 text-right">{formatIDR(l.amount)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2} className="pt-3 text-left font-bold">Total {title}</th>
              <td className={`tabular pt-3 text-right font-bold ${tone === "income" ? "text-income" : "text-expense"}`}>{formatIDR(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}
