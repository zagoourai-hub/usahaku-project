"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Award,
  ChartColumn,
  Download,
  Loader2,
  Minus,
  Plus,
  ReceiptText,
  ScanLine,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError, download } from "@/lib/api-client";
import { useBusiness, type BusinessType } from "@/lib/business";
import { daysAgo, formatIDR, formatPct, toISODate } from "@/lib/format";
import { HEALTH_STYLE, marginHealth, marginPct, recipesKey, useRecipeSales, type Recipe } from "@/lib/recipes";
import { shortDate, timeOf, transactionsKey, type TransactionPage } from "@/lib/transactions";
import { ErrorBox, ghostBtn, primaryBtn } from "../ui";
import { UsageMeter } from "../usage-meter";

// Mirrors ReportService.summary (Decimal -> string in JSON).
type Granularity = "day" | "week" | "month";
type Point = { period: string; income: string; expense: string; balance: string };
type Summary = { totalIncome: string; totalExpense: string; balance: string; series: Point[] };

const TYPE_LABEL: Record<BusinessType, string> = { WARUNG: "Warung Makan", KEDAI_MINUMAN: "Kedai Minuman", KATERING: "Katering", LAINNYA: "F&B" };
const RANGES = [
  { days: 7, label: "7 Hari", granularity: "day" },
  { days: 30, label: "30 Hari", granularity: "week" },
  { days: 90, label: "90 Hari", granularity: "month" },
] as const;

const summaryUrl = (from: Date, to: Date, granularity: Granularity) =>
  `/reports/summary?from=${toISODate(from)}&to=${toISODate(to)}&granularity=${granularity}`;

function percentChange(now: number, before: number): number | null {
  return before === 0 ? null : Math.round(((now - before) / before) * 100);
}

export function Dashboard() {
  const today = new Date();
  const todayISO = toISODate(today);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const range = RANGES.find((r) => r.days === rangeDays)!;

  const business = useBusiness();
  const daily = useQuery({ queryKey: ["summary", "daily", todayISO], queryFn: () => api<Summary>(summaryUrl(daysAgo(1, today), today, "day")) });
  const trend = useQuery({ queryKey: ["summary", "trend", todayISO, rangeDays], queryFn: () => api<Summary>(summaryUrl(daysAgo(rangeDays - 1, today), today, range.granularity)) });
  const recent = useQuery({ queryKey: [...transactionsKey, "recent"], queryFn: () => api<TransactionPage>("/transactions?limit=5") });
  const todayCount = useQuery({
    queryKey: [...transactionsKey, "count", todayISO],
    queryFn: async () => {
      const [inc, exp] = await Promise.all([
        api<TransactionPage>(`/transactions?from=${todayISO}&to=${todayISO}&type=INCOME&limit=1`),
        api<TransactionPage>(`/transactions?from=${todayISO}&to=${todayISO}&type=EXPENSE&limit=1`),
      ]);
      return { income: inc.total, expense: exp.total };
    },
  });
  const summaryPdf = useMutation({
    mutationFn: () => {
      const from = toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
      return download(`/reports/export?from=${from}&to=${todayISO}&format=pdf`, `laba-rugi_${from}_${todayISO}.pdf`);
    },
  });

  const pick = (period: string) => daily.data?.series.find((p) => p.period === period);
  const now = pick(todayISO);
  const prev = pick(toISODate(daysAgo(1, today)));
  const n = (v: string | undefined) => Number(v ?? 0);
  const income = n(now?.income);
  const profit = n(now?.balance);
  const netMargin = income > 0 ? Math.round((profit / income) * 1000) / 10 : null;
  const target = Number(business.data?.dailyProfitTarget ?? 0);
  const targetPct = target > 0 ? Math.max(0, Math.round((profit / target) * 100)) : 0;
  const trendMargin = trend.data && Number(trend.data.totalIncome) > 0 ? Math.round((Number(trend.data.balance) / Number(trend.data.totalIncome)) * 1000) / 10 : null;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-xs">
            {business.data && (
              <span className="rounded-full bg-secondary px-2.5 py-1 font-mono font-semibold text-secondary-foreground">
                {TYPE_LABEL[business.data.type]}
                {business.data.city && ` · ${business.data.city}`}
              </span>
            )}
            {/* Client-only times: the page is prerendered, so "now" at render would be the build time. */}
            {daily.dataUpdatedAt > 0 && <span className="text-muted-foreground">Pembaruan kas {timeOf(new Date(daily.dataUpdatedAt).toISOString())} WIB</span>}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">
            Halo, {business.data?.name ?? "…"}
            <span className="block text-base font-normal text-muted-foreground md:inline md:text-2xl md:font-medium">
              <span className="hidden md:inline"> — </span>
              {daily.dataUpdatedAt > 0 && `${new Date(daily.dataUpdatedAt).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })} · `}
              Ini progres usahamu hari ini
            </span>
          </h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => summaryPdf.mutate()} disabled={summaryPdf.isPending} className={`${ghostBtn} flex-1 lg:flex-none`}>
            {summaryPdf.isPending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Download className="size-4" />}
            <span className="hidden sm:inline">Unduh </span>Ringkasan
          </button>
          <Link href="/transactions" className={`${primaryBtn} flex-1 lg:flex-none`}>
            <Plus className="size-5" /> Catat Kas<span className="hidden sm:inline"> Baru</span>
          </Link>
        </div>
      </header>
      {summaryPdf.isError && <ErrorBox message={summaryPdf.error instanceof ApiError ? summaryPdf.error.message : "Gagal mengunduh ringkasan."} />}

      {/* Today */}
      <section aria-labelledby="today-title">
        <h2 id="today-title" className="sr-only">Ringkasan hari ini</h2>
        {daily.isError ? (
          <ErrorBox onRetry={() => daily.refetch()} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr]">
            <StatTile
              label="Pemasukan Hari Ini"
              Icon={ArrowDown}
              iconClass="bg-muted text-foreground dark:bg-card-inner"
              loading={daily.isPending}
              value={income}
              footer={
                <>
                  <Delta change={percentChange(income, n(prev?.income))} goodWhenUp />
                  <span className="text-xs text-muted-foreground">{todayCount.data ? `${todayCount.data.income} transaksi masuk` : ""}</span>
                </>
              }
            />
            <StatTile
              label="Pengeluaran Hari Ini"
              Icon={ArrowUp}
              iconClass="bg-expense-soft text-expense"
              loading={daily.isPending}
              value={n(now?.expense)}
              footer={
                <>
                  <Delta change={percentChange(n(now?.expense), n(prev?.expense))} goodWhenUp={false} />
                  <span className="text-xs text-muted-foreground">{todayCount.data ? `${todayCount.data.expense} transaksi keluar` : ""}</span>
                </>
              }
            />
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 md:col-span-2 lg:col-span-1 dark:bg-primary/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs font-bold text-primary">Laba Bersih Hari Ini</p>
                {netMargin !== null && (
                  <span className={`rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${HEALTH_STYLE[profit < 0 ? "loss" : netMargin >= 30 ? "good" : "thin"].badge}`}>
                    Margin bersih {formatPct(netMargin)}
                  </span>
                )}
              </div>
              {daily.isPending ? (
                <div className="mt-3 h-10 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              ) : (
                <p className={`tabular mt-2 text-4xl font-bold tracking-tight ${profit < 0 ? "text-expense" : "text-primary"}`}>
                  {profit < 0 && "−"}
                  {formatIDR(profit)}
                </p>
              )}
              <div className="mt-4 border-t border-primary/15 pt-4">
                <div className="flex items-center justify-between gap-2 text-sm">
                  {target > 0 ? (
                    <>
                      <span className="text-muted-foreground">Target harian {formatIDR(target)}</span>
                      <span className="font-mono text-xs font-bold text-primary">{targetPct}% tercapai</span>
                    </>
                  ) : (
                    <Link href="/onboarding" className="rounded font-semibold text-primary hover:underline">
                      Atur target laba harian →
                    </Link>
                  )}
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-track" role="meter" aria-label="Pencapaian target harian" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, targetPct)}>
                  <div className="h-full rounded-full bg-primary transition-all motion-reduce:transition-none" style={{ width: `${Math.min(100, targetPct)}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Quick actions */}
      <nav aria-label="Aksi cepat" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            { href: "/transactions", title: "Catat Transaksi", desc: "Kasir cepat & penjualan", Icon: ReceiptText, tone: "teal" },
            { href: "/receipts/new", title: "Scan Struk", desc: "Foto bon belanja instan", Icon: ScanLine, tone: "amber" },
            { href: "/recipes/new", title: "Tambah Resep", desc: "Hitung margin per porsi", Icon: UtensilsCrossed, tone: "teal" },
            { href: "/reports", title: "Laporan Keuangan", desc: "Arus kas & laba rugi", Icon: ChartColumn, tone: "amber" },
          ] as const
        ).map(({ href, title, desc, Icon, tone }) => (
          <Link key={href} href={href} className="group rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/50">
            <span className="flex items-start justify-between">
              <span className={`flex size-11 items-center justify-center rounded-xl ${tone === "teal" ? "bg-primary/10 text-primary dark:bg-primary/15" : "bg-secondary text-secondary-foreground"}`}>
                <Icon className="size-5" />
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </span>
            <span className="mt-4 block font-bold">{title}</span>
            <span className="block text-xs text-muted-foreground">{desc}</span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <section aria-labelledby="trend-title" className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="trend-title" className="text-lg font-bold">Tren Keuangan {range.label}</h2>
              <p className="text-sm text-muted-foreground">Pemasukan, pengeluaran & pertumbuhan laba bersih</p>
            </div>
            <div className="flex items-center gap-2">
              {trendMargin !== null && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 font-mono text-xs font-semibold text-primary dark:bg-primary/15">
                  <TrendingUp className="size-3.5" /> Margin rata-rata {formatPct(trendMargin)}
                </span>
              )}
              <label className="sr-only" htmlFor="trend-range">Periode grafik</label>
              <select id="trend-range" value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value) as 7 | 30 | 90)} className="h-9 rounded-lg border bg-card px-2 font-mono text-xs dark:bg-card-inner">
                {RANGES.map((r) => (
                  <option key={r.days} value={r.days}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {trend.isError ? (
            <ErrorBox onRetry={() => trend.refetch()} />
          ) : trend.isPending ? (
            <div className="mt-6 h-56 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          ) : (
            <TrendChart series={trend.data.series} granularity={range.granularity} days={range.days} />
          )}
        </section>

        <section aria-labelledby="recent-title" className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="recent-title" className="text-lg font-bold">Transaksi Terakhir</h2>
              <p className="text-sm text-muted-foreground">Aktivitas kas terbaru</p>
            </div>
            {!!recent.data?.total && (
              <Link href="/transactions" className="shrink-0 rounded text-sm font-semibold text-primary hover:underline">
                Lihat Semua ({recent.data.total}) →
              </Link>
            )}
          </div>
          {recent.isError ? (
            <ErrorBox onRetry={() => recent.refetch()} />
          ) : recent.isPending ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
              ))}
            </div>
          ) : recent.data.items.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed p-6 text-center">
              <p className="font-semibold">Belum ada transaksi</p>
              <p className="mt-1 text-sm text-muted-foreground">Yuk catat penjualan atau belanja pertamamu hari ini.</p>
            </div>
          ) : (
            <ul className="mt-4 flex-1 divide-y">
              {recent.data.items.map((t) => {
                const isIncome = t.type === "INCOME";
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-full ${isIncome ? "bg-primary/10 text-primary dark:bg-primary/15" : "bg-expense-soft text-expense"}`}>
                      {isIncome ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{t.description || t.category.name}</span>
                        {t.source === "OCR" && <span className="shrink-0 rounded bg-primary/10 px-1 font-mono text-xs font-bold text-primary">Struk</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {isIncome ? "Pemasukan" : "Pengeluaran"} · {t.category.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`tabular font-bold ${isIncome ? "text-primary" : "text-expense"}`}>
                        <span className="sr-only">{isIncome ? "Pemasukan" : "Pengeluaran"} </span>
                        {isIncome ? "+" : "−"}
                        {formatIDR(t.amount)}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {shortDate(t.transactionDate)} · {timeOf(t.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/transactions" className={`${ghostBtn} mt-4 w-full bg-muted dark:bg-card-inner`}>
            <Plus className="size-4" /> Catat Transaksi Manual
          </Link>
        </section>
      </div>

      <TopMenu />

      <UsageMeter />
    </main>
  );
}

function StatTile({ label, Icon, iconClass, value, footer, loading }: { label: string; Icon: LucideIcon; iconClass: string; value: number; footer: React.ReactNode; loading: boolean }) {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs font-bold">{label}</p>
        <span aria-hidden className={`flex size-8 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="size-4" />
        </span>
      </div>
      {loading ? (
        <div className="mt-3 h-9 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      ) : (
        <p className="tabular mt-3 text-3xl font-bold tracking-tight">{formatIDR(value)}</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">{!loading && footer}</div>
    </div>
  );
}

function Delta({ change, goodWhenUp }: { change: number | null; goodWhenUp: boolean }) {
  if (change === null)
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3.5" /> Belum ada data kemarin
      </p>
    );
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className={`flex items-center gap-1 font-mono text-xs font-semibold ${up === goodWhenUp ? "text-income" : "text-expense"}`}>
      <Icon className="size-4" /> {up ? "+" : ""}
      {change}% vs kemarin
    </p>
  );
}

/** Best-selling menu today, from INCOME entries linked to a menu (manual portions). */
function TopMenu() {
  const todayISO = toISODate(new Date());
  const recipes = useQuery({ queryKey: [...recipesKey, ""], queryFn: () => api<Recipe[]>("/recipes") });
  const sales = useRecipeSales(todayISO, todayISO);
  if (!recipes.data || !sales.data) return null;
  if (recipes.data.length === 0) {
    return (
      <section className="flex flex-col items-start justify-between gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">Belum ada resep. Hitung HPP menu pertamamu untuk melihat menu paling menguntungkan.</p>
        <Link href="/recipes/new" className={primaryBtn}>
          <Plus className="size-4" /> Tambah Resep
        </Link>
      </section>
    );
  }
  const top = sales.data.filter((s) => s.portionsSold > 0).sort((a, b) => b.portionsSold - a.portionsSold)[0];
  const recipe = top && recipes.data.find((r) => r.id === top.recipeId);
  if (!top || !recipe) {
    return (
      <section className="flex flex-col items-start justify-between gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">Belum ada penjualan menu hari ini. Saat mencatat pemasukan, pilih menu & jumlah porsi agar menu terlaris muncul di sini.</p>
        <Link href="/transactions" className={`${ghostBtn} shrink-0`}>
          <Plus className="size-4" /> Catat Penjualan
        </Link>
      </section>
    );
  }
  const price = recipe.sellingPrice === null ? null : Number(recipe.sellingPrice);
  const margin = marginPct(Number(recipe.currentHpp), price);
  const health = HEALTH_STYLE[marginHealth(margin, Number(recipe.targetMarginPct))];

  return (
    <section aria-labelledby="top-menu-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
      <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
        <Award className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="top-menu-title" className="flex flex-wrap items-center gap-2 font-bold">
          Menu Terlaris Hari Ini: {recipe.name}
          {margin !== null && <span className={`rounded-full px-2 py-0.5 font-mono text-xs ${health.badge}`}>Margin {formatPct(margin)}</span>}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
          Terjual <b className="text-foreground">{top.portionsSold} porsi</b> · HPP <b className="tabular text-foreground">{formatIDR(recipe.currentHpp)}</b> · Harga Jual{" "}
          <b className="tabular text-foreground">{price === null ? "—" : formatIDR(price)}</b>
        </p>
      </div>
      <Link href="/recipes" className="shrink-0 rounded text-sm font-semibold text-primary hover:underline">
        Lihat {recipes.data.length > 1 ? `${recipes.data.length - 1} Resep Lainnya` : "Resep"} →
      </Link>
    </section>
  );
}

function periodLabel(period: string, granularity: Granularity) {
  if (granularity === "month") return new Date(period + "-01").toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" });
  return shortDate(period);
}

function TrendChart({ series, granularity, days }: { series: Point[]; granularity: Granularity; days: number }) {
  if (series.length === 0) {
    return <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada transaksi {days} hari terakhir. Grafik muncul setelah kamu mencatat kas.</p>;
  }
  const max = Math.max(...series.flatMap((p) => [Number(p.income), Number(p.expense)]), 1);
  const pct = (v: string) => `${(Number(v) / max) * 100}%`;
  const ticks = [max, max / 2, 0];
  const prefix = granularity === "week" ? "Minggu " : "";

  return (
    <figure className="mt-6">
      <div className="flex gap-3">
        {/* Y axis */}
        <div aria-hidden className="flex h-56 flex-col justify-between pb-6 text-right font-mono text-xs text-muted-foreground">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {new Intl.NumberFormat("id-ID", { notation: "compact" }).format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* Recessive grid */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed" />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-[calc(50%-0.75rem)] border-t border-dashed" />
          <ul className="relative flex h-56 items-end justify-around gap-1">
            {series.map((p) => (
              <li
                key={p.period}
                tabIndex={0}
                aria-label={`${prefix}${periodLabel(p.period, granularity)}: pemasukan ${formatIDR(p.income)}, pengeluaran ${formatIDR(p.expense)}`}
                className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-md outline-offset-4 hover:bg-muted/60"
              >
                <div aria-hidden className="flex h-[calc(100%-1.5rem)] w-full items-end justify-center gap-0.5 border-b">
                  <span className="w-1/3 max-w-7 rounded-t-[4px] bg-chart-income" style={{ height: pct(p.income) }} />
                  <span className="w-1/3 max-w-7 rounded-t-[4px] bg-chart-expense" style={{ height: pct(p.expense) }} />
                </div>
                <span aria-hidden className="mt-1.5 h-4 max-w-full truncate font-mono text-xs text-muted-foreground sm:text-xs">
                  {periodLabel(p.period, granularity)}
                </span>
                {/* Hover/focus tooltip */}
                <span aria-hidden className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max rounded-lg border bg-popover p-2.5 text-xs shadow-md group-hover:block group-focus:block">
                  <span className="block font-semibold">
                    {prefix}
                    {periodLabel(p.period, granularity)}
                  </span>
                  <span className="tabular mt-1 flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-chart-income" /> <b>{formatIDR(p.income)}</b> Pemasukan
                  </span>
                  <span className="tabular flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-chart-expense" /> <b>{formatIDR(p.expense)}</b> Pengeluaran
                  </span>
                  <span className="tabular flex items-center gap-1.5 border-t pt-1">
                    Laba <b>{Number(p.balance) < 0 ? "−" : ""}{formatIDR(p.balance)}</b>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
        <span className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-chart-income" /> Pemasukan
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-chart-expense" /> Pengeluaran
          </span>
        </span>
        <span className="font-mono text-muted-foreground">Diperbarui otomatis</span>
      </figcaption>
      {/* Table view: full data for screen readers (div wrapper — tables ignore sr-only's 1px width) */}
      <div className="sr-only">
        <table>
          <caption>Pemasukan dan pengeluaran, {days} hari terakhir</caption>
          <thead>
            <tr>
              <th scope="col">Periode</th>
              <th scope="col">Pemasukan</th>
              <th scope="col">Pengeluaran</th>
              <th scope="col">Laba</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.period}>
                <th scope="row">
                  {prefix}
                  {periodLabel(p.period, granularity)}
                </th>
                <td>{formatIDR(p.income)}</td>
                <td>{formatIDR(p.expense)}</td>
                <td>
                  {Number(p.balance) < 0 ? "−" : ""}
                  {formatIDR(p.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
