"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CircleAlert, Lightbulb, Pencil, Plus, Search, Star, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "@/lib/api-client";
import { daysAgo, formatIDR, formatPct, toISODate } from "@/lib/format";
import { ceilToRupiah, centsToString, toScaled } from "@/lib/hpp";
import { HEALTH_STYLE, marginHealth, marginPct, recipesKey, useRecipeSales, type MarginHealth, type Recipe, type RecipeSales } from "@/lib/recipes";
import { EmptyState, ErrorBox, ListSkeleton, primaryBtn } from "../ui";

type Filter = "all" | MarginHealth;
type Sort = "name" | "sold" | "margin";

const FILTERS: { value: Filter; label: string; dot?: string }[] = [
  { value: "all", label: "Semua" },
  { value: "good", label: "Margin Sehat", dot: "bg-income" },
  { value: "thin", label: "Margin Tipis", dot: "bg-warning" },
  { value: "loss", label: "Rugi", dot: "bg-expense" },
  { value: "none", label: "Belum ada harga", dot: "bg-track" },
];

type Row = { recipe: Recipe; margin: number | null; health: MarginHealth; stats?: RecipeSales };
const SALES_DAYS = 30;

export function Recipes() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name");
  const q = useDeferredValue(search.trim());
  const list = useQuery({
    queryKey: [...recipesKey, q],
    queryFn: () => api<Recipe[]>(`/recipes${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });
  const [salesTo] = useState(() => new Date());
  const stats = useRecipeSales(toISODate(daysAgo(SALES_DAYS - 1, salesTo)), toISODate(salesTo));
  const statsById = new Map(stats.data?.map((s) => [s.recipeId, s]));

  const rows: Row[] = (list.data ?? []).map((recipe) => {
    const margin = marginPct(Number(recipe.currentHpp), recipe.sellingPrice === null ? null : Number(recipe.sellingPrice));
    return { recipe, margin, health: marginHealth(margin, Number(recipe.targetMarginPct)), stats: statsById.get(recipe.id) };
  });
  const count = (f: Filter) => (f === "all" ? rows.length : rows.filter((r) => r.health === f).length);
  const priced = rows.filter((r) => r.margin !== null);
  const avgMargin = priced.length ? Math.round((priced.reduce((s, r) => s + r.margin!, 0) / priced.length) * 10) / 10 : null;
  const needReview = count("thin") + count("loss");
  const topSellerId = [...rows].filter((r) => r.stats?.portionsSold).sort((a, b) => b.stats!.portionsSold - a.stats!.portionsSold)[0]?.recipe.id;

  const visible = rows
    .filter((r) => filter === "all" || r.health === filter)
    .sort((a, b) =>
      sort === "sold" ? (b.stats?.portionsSold ?? 0) - (a.stats?.portionsSold ?? 0) : sort === "margin" ? (a.margin ?? Infinity) - (b.margin ?? Infinity) : a.recipe.name.localeCompare(b.recipe.name, "id"),
    );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-8 md:py-8">
      <header className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="flex items-center gap-1.5 font-mono text-xs font-bold text-muted-foreground">
          <BookOpen className="size-4" /> Daftar Menu
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex flex-wrap items-baseline gap-x-3 text-3xl font-extrabold tracking-tight">
              Resep <span className="text-sm font-normal text-muted-foreground">Kelola resep dan pantau margin tiap menu</span>
            </h1>
            {rows.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg bg-muted px-2.5 py-1.5 dark:bg-card-inner">
                  Total Resep: <b className="font-mono">{rows.length} Menu</b>
                </span>
                {avgMargin !== null && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-primary dark:bg-primary/15">
                    <i className="size-1.5 rounded-full bg-primary" /> Margin rata-rata <b className="font-mono">{formatPct(avgMargin)}</b>
                  </span>
                )}
                {needReview > 0 && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-expense-soft px-2.5 py-1.5 text-expense">
                    <i className="size-1.5 rounded-full bg-expense" /> Perlu evaluasi: <b className="font-mono">{needReview} Menu</b>
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2 lg:w-[28rem]">
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Cari resep"
                placeholder="Cari resep…"
                className="h-11 w-full rounded-lg border bg-muted pl-11 pr-3 text-[15px] focus:border-primary focus:outline-none dark:bg-card-inner"
              />
            </div>
            <Link href="/recipes/new" className={primaryBtn}>
              <Plus className="size-5" /> Tambah
            </Link>
          </div>
        </div>
      </header>

      {rows.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div role="group" aria-label="Filter margin" className="flex flex-wrap gap-2">
            {FILTERS.filter((f) => f.value === "all" || count(f.value) > 0).map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className="flex h-10 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {f.dot && <i aria-hidden className={`size-2 rounded-full ${f.dot}`} />}
                {f.label}
                <span className="font-mono text-xs opacity-80">({count(f.value)})</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Urutan:
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-lg border bg-card px-2 text-sm text-foreground dark:bg-card-inner">
              <option value="name">Nama A–Z</option>
              <option value="sold">Terlaris (volume)</option>
              <option value="margin">Margin terendah</option>
            </select>
          </label>
        </div>
      )}

      {list.isError ? (
        <ErrorBox onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <ListSkeleton rows={3} />
      ) : rows.length === 0 ? (
        q ? (
          <EmptyState title={`Tidak ada resep "${q}"`} desc="Coba kata kunci lain." />
        ) : (
          <EmptyState
            title="Belum ada resep"
            desc="Yuk hitung HPP menu pertamamu. Pastikan bahan bakunya sudah dimasukkan dulu."
            action={
              <Link href="/recipes/new" className={primaryBtn}>
                <Plus className="size-5" /> Buat Resep Pertama
              </Link>
            }
          />
        )
      ) : visible.length === 0 ? (
        <EmptyState title="Tidak ada menu di filter ini" desc="Pilih filter lain." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((row) => (
            <RecipeCard key={row.recipe.id} row={row} isTopSeller={row.recipe.id === topSellerId} />
          ))}
        </ul>
      )}
    </main>
  );
}

function RecipeCard({ row: { recipe: r, margin, health, stats }, isTopSeller }: { row: Row; isTopSeller: boolean }) {
  const style = HEALTH_STYLE[health];
  const target = Number(r.targetMarginPct);
  const critical = health === "loss" || (health === "thin" && margin !== null && margin < target / 2);
  const badge = critical
    ? { text: "Perlu Koreksi Harga", cls: "bg-expense-soft text-expense", Icon: CircleAlert }
    : isTopSeller
      ? { text: "Terlaris #1", cls: "bg-secondary text-secondary-foreground", Icon: Star }
      : health === "thin"
        ? { text: "Margin Tipis", cls: "bg-warning-soft text-warning", Icon: CircleAlert }
        : health === "good" && margin !== null && margin >= target + 10
          ? { text: "Tinggi Margin", cls: "bg-primary/10 text-primary", Icon: null }
          : null;
  const qualifier = margin === null ? "" : health === "loss" ? " (Rugi)" : health === "thin" ? " (Di bawah target)" : margin >= target + 10 ? " (Sangat sehat)" : " (Sehat)";

  return (
    <li className={`relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm ${critical ? "border-l-4 border-l-expense" : ""}`}>
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground dark:bg-card-inner">
            {r.category ?? "Tanpa kategori"}
          </span>
          {badge && (
            <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold ${badge.cls}`}>
              {badge.Icon && <badge.Icon className="size-3.5" />} {badge.text}
            </span>
          )}
        </div>
        <h2 className="mt-3 text-xl font-bold leading-snug">
          <Link href={`/recipes/${r.id}`} className="rounded after:absolute after:inset-0">
            {r.name}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          Porsi: 1 resep = {r.yieldPortions} porsi{!r.isActive && " · Nonaktif"}
        </p>
        <dl className={`mt-4 grid grid-cols-2 divide-x rounded-xl p-3 ${critical ? "bg-expense-soft/60" : "bg-muted dark:bg-card-inner"}`}>
          <div className="pr-3">
            <dt className="font-mono text-xs text-muted-foreground">Modal per porsi (HPP)</dt>
            <dd className={`tabular text-lg font-bold ${critical ? "text-expense" : ""}`}>{formatIDR(r.currentHpp)}</dd>
          </div>
          <div className="pl-3 text-right">
            <dt className="font-mono text-xs text-muted-foreground">Harga Jual</dt>
            <dd className="tabular text-lg font-bold">{r.sellingPrice === null ? "—" : formatIDR(r.sellingPrice)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center justify-between font-mono text-xs">
          <span>Margin Laba</span>
          <span className={`font-bold ${style.text}`}>{margin === null ? style.label : `${formatPct(margin)}${qualifier}`}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-track">
          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.max(0, Math.min(100, margin ?? 0))}%` }} />
        </div>
        {(critical || health === "none") && (
          <p className={`mt-3 flex gap-2 rounded-lg p-3 text-xs ${critical ? "bg-expense-soft text-expense" : "bg-secondary text-secondary-foreground"}`}>
            <Lightbulb className="size-4 shrink-0" />
            <span>
              Rekomendasi harga jual minimal <b className="tabular">{formatIDR(centsToString(ceilToRupiah(toScaled(r.recommendedPrice, 2), 500)))}</b> agar margin ≥ {formatPct(target)}.
            </span>
          </p>
        )}
      </div>
      <div className="flex items-center justify-between border-t bg-muted/40 px-5 py-3 text-sm dark:bg-card-inner/40">
        <span className="flex items-center gap-1.5">
          {stats?.trend === "down" ? <TrendingDown className="size-4 text-expense" /> : stats?.trend === "up" ? <TrendingUp className="size-4 text-income" /> : <ArrowRight className="size-4 text-muted-foreground" />}
          <b className="font-mono">{stats?.portionsSold ?? 0}</b> porsi terjual ({SALES_DAYS} hari)
        </span>
        {/* relative + z-10 keeps this above the card-wide link overlay */}
        <Link href={`/recipes/${r.id}`} aria-label={`Ubah ${r.name}`} className="relative z-10 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <Pencil className="size-4" />
        </Link>
      </div>
    </li>
  );
}
