"use client";

import { useDeferredValue, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Lightbulb, Package, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { formatIDR, formatPct } from "@/lib/format";
import { ingredientsKey, lastPriceChangePct, useIngredients, type Ingredient } from "@/lib/ingredients";
import { Sheet } from "@/app/_components/sheet";
import { EmptyState, ErrorBox, iconBtn, ListSkeleton, primaryBtn } from "../ui";
import { formatPerUnit, IngredientForm, unitLabel } from "./ingredient-form";

type Filter = "all" | "up" | "recent";
type Sort = "name" | "price" | "updated";
const TONES = ["bg-secondary text-secondary-foreground", "bg-primary/10 text-primary dark:bg-primary/15", "bg-muted text-muted-foreground dark:bg-card-inner"];
const WEEK_MS = 7 * 86_400_000;

export function Ingredients() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null);
  // Captured once per mount; "recently updated" doesn't need to tick live.
  const [now] = useState(() => Date.now());
  const q = useDeferredValue(search.trim());
  const list = useIngredients(q);
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: string) => api(`/ingredients/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ingredientsKey }),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Gagal menghapus bahan."),
  });

  const items = list.data ?? [];
  const isUp = (i: Ingredient) => (lastPriceChangePct(i) ?? 0) > 0;
  const isRecent = (i: Ingredient) => now - new Date(i.updatedAt).getTime() < WEEK_MS;
  const upCount = items.filter(isUp).length;
  const changes = items.map(lastPriceChangePct).filter((c) => c !== null);
  const avgChange = changes.length ? Math.round((changes.reduce((s, c) => s + c, 0) / changes.length) * 10) / 10 : null;
  const visible = items
    .filter((i) => filter === "all" || (filter === "up" ? isUp(i) : isRecent(i)))
    .sort((a, b) => (sort === "price" ? Number(b.purchasePrice) - Number(a.purchasePrice) : sort === "updated" ? b.updatedAt.localeCompare(a.updatedAt) : a.name.localeCompare(b.name, "id")));
  const chips: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Semua", count: items.length },
    { value: "up", label: "Harga Naik", count: upCount },
    { value: "recent", label: "Baru Diupdate", count: items.filter(isRecent).length },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Bahan Baku</h1>
          <p className="text-muted-foreground">Kelola daftar bahan baku dan harga terbaru</p>
        </div>
        <div className="flex gap-2 lg:w-[34rem]">
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari bahan baku"
              placeholder="Cari bahan baku…"
              className="h-12 w-full rounded-xl border bg-card pl-12 pr-4 text-[15px] shadow-sm focus:border-primary focus:outline-none dark:bg-card-inner"
            />
          </div>
          <button type="button" onClick={() => setEditing("new")} className={`${primaryBtn} h-12`}>
            <Plus className="size-5" /> Tambah<span className="hidden sm:inline"> Bahan</span>
          </button>
        </div>
      </header>

      {items.length > 0 && (
        <section aria-label="Ringkasan bahan baku" className="grid gap-3 md:grid-cols-3">
          <SummaryTile label="Total Terdaftar" value={String(items.length)} unit="Bahan Baku" Icon={ClipboardCheck} iconCls="bg-muted dark:bg-card-inner" />
          <SummaryTile label="Harga Naik" value={String(upCount)} unit="Bahan, perubahan terakhir" Icon={TrendingUp} iconCls="bg-expense-soft text-expense" tone="text-expense" />
          <SummaryTile
            label="Rata-rata Perubahan Harga"
            value={avgChange === null ? "—" : `${avgChange > 0 ? "+" : ""}${formatPct(avgChange)}`}
            unit={avgChange === null ? "Belum ada perubahan" : `dari ${changes.length} bahan`}
            Icon={avgChange !== null && avgChange < 0 ? TrendingDown : TrendingUp}
            iconCls="bg-accent/20 text-warning"
            tone="text-secondary-foreground dark:text-warning"
          />
        </section>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div role="group" aria-label="Filter bahan" className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={filter === c.value}
                onClick={() => setFilter(c.value)}
                className="flex h-10 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:text-primary"
              >
                {c.value === "up" && <TrendingUp aria-hidden className="size-4 text-expense" />}
                {c.label}
                <span className="rounded-full bg-muted px-1.5 font-mono text-xs dark:bg-card-inner">{c.count}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Urutkan:
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-lg border bg-card px-2 text-sm text-foreground dark:bg-card-inner">
              <option value="name">Nama A–Z</option>
              <option value="price">Harga tertinggi</option>
              <option value="updated">Terakhir diupdate</option>
            </select>
          </label>
        </div>
      )}

      {list.isError ? (
        <ErrorBox onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        q ? (
          <EmptyState title={`Tidak ada bahan "${q}"`} desc="Coba kata kunci lain atau tambah bahan baru." />
        ) : (
          <EmptyState
            title="Belum ada bahan baku"
            desc="Masukkan bahan yang kamu beli (kopi, susu, gula, cup…) beserta harganya. Setelah itu kamu bisa bikin resep."
            action={
              <button type="button" onClick={() => setEditing("new")} className={primaryBtn}>
                <Plus className="size-5" /> Tambah Bahan Pertama
              </button>
            }
          />
        )
      ) : visible.length === 0 ? (
        <EmptyState title="Tidak ada bahan di filter ini" desc="Pilih filter lain." />
      ) : (
        <ul className="space-y-3">
          {visible.map((item, index) => {
            const change = lastPriceChangePct(item);
            const purchase = item.purchaseUnit === "pack" ? `pack (isi ${Number(item.purchaseQty)} ${item.usageUnit})` : `${Number(item.purchaseQty) === 1 ? "" : `${Number(item.purchaseQty)} `}${unitLabel[item.purchaseUnit]}`;
            const stable = change !== null && Math.abs(change) <= 0.5;
            return (
              <li key={item.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:gap-4">
                <span aria-hidden className={`hidden size-12 shrink-0 items-center justify-center rounded-full sm:flex ${TONES[index % TONES.length]}`}>
                  <Package className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2">
                    <span className="truncate text-lg font-semibold">{item.name}</span>
                    {item._count.recipeItems > 0 && <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground dark:bg-card-inner">{item._count.recipeItems} resep</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Satuan: per {purchase}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p>
                    <span className="tabular text-lg font-bold">{formatIDR(item.purchasePrice)}</span>
                    <span className="font-mono text-xs text-muted-foreground">/{unitLabel[item.purchaseUnit]}</span>
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatPerUnit(item.pricePerUsageUnit)}/{item.usageUnit}
                  </p>
                  {change !== null && (
                    <span
                      className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${
                        stable ? "bg-muted text-muted-foreground dark:bg-card-inner" : change > 0 ? "bg-expense-soft text-expense" : "bg-primary/10 text-primary"
                      }`}
                    >
                      {stable ? (
                        "Stabil"
                      ) : (
                        <>
                          {change > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          {change > 0 ? "+" : ""}
                          {formatPct(change)} vs harga sebelumnya
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col sm:flex-row">
                  <button type="button" onClick={() => setEditing(item)} aria-label={`Ubah ${item.name}`} className={iconBtn}>
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => window.confirm(`Hapus bahan "${item.name}"?`) && remove.mutate(item.id)}
                    aria-label={`Hapus ${item.name}`}
                    className={`${iconBtn} hover:text-expense`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <aside className="flex gap-3 rounded-2xl bg-muted p-4 text-sm dark:bg-card-inner">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lightbulb className="size-5" />
          </span>
          <p>
            <b className="block">Tips Pengadaan F&amp;B</b>
            <span className="text-muted-foreground">Perubahan harga di atas otomatis menghitung ulang HPP tiap porsi resep di menu kamu.</span>
          </p>
        </aside>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Tambah Bahan" : "Ubah Bahan"}>
        {editing !== null && <IngredientForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </main>
  );
}

function SummaryTile({ label, value, unit, Icon, iconCls, tone = "" }: { label: string; value: string; unit: string; Icon: LucideIcon; iconCls: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="min-w-0">
        <p className={`font-mono text-xs font-bold ${tone}`}>{label}</p>
        <p className="mt-2 flex items-baseline gap-2">
          <span className={`tabular text-4xl font-bold ${tone}`}>{value}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </p>
      </div>
      <span aria-hidden className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${iconCls}`}>
        <Icon className="size-6" />
      </span>
    </div>
  );
}
