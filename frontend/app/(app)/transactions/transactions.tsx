"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronDown, Download, FileImage, Loader2, Pencil, Plus, Search, Trash2, Zap } from "lucide-react";
import { api, ApiError, download } from "@/lib/api-client";
import { daysAgo, formatIDR, toISODate } from "@/lib/format";
import { useBusiness } from "@/lib/business";
import { centsToString, toScaled } from "@/lib/hpp";
import { recipesKey, type Recipe } from "@/lib/recipes";
import { timeOf, transactionsKey, useCategories, type Transaction, type TransactionPage, type TxType } from "@/lib/transactions";
import { Field, FormError, SelectField, SubmitButton } from "@/app/_components/fields";
import { Sheet } from "@/app/_components/sheet";
import { EmptyState, ErrorBox, ghostBtn, iconBtn, ListSkeleton, primaryBtn } from "../ui";

const PAGE_SIZE = 20;
const TYPE_TABS: { value: TxType | ""; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "INCOME", label: "Masuk" },
  { value: "EXPENSE", label: "Keluar" },
];

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function Transactions() {
  const today = new Date();
  const todayISO = toISODate(today);
  const yesterdayISO = toISODate(daysAgo(1, today));
  const [type, setType] = useState<TxType | "">("");
  const [from, setFrom] = useState(toISODate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(todayISO);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);
  const categories = useCategories();
  const business = useBusiness();
  const queryClient = useQueryClient();

  const filters = new URLSearchParams({ limit: String(PAGE_SIZE), ...(type && { type }), ...(from && { from }), ...(to && { to }), ...(categoryId && { categoryId }) });
  const list = useInfiniteQuery({
    queryKey: [...transactionsKey, "list", filters.toString()],
    queryFn: ({ pageParam }) => api<TransactionPage>(`/transactions?${filters}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateMoney(queryClient),
    onError: (err) => window.alert(err instanceof ApiError ? err.message : "Gagal menghapus transaksi."),
  });
  const exporter = useMutation({
    mutationFn: () => download(`/reports/export?from=${from}&to=${to}&format=pdf`, `laba-rugi_${from}_${to}.pdf`),
  });

  const loaded = list.data?.pages.flatMap((p) => p.items) ?? [];
  // ponytail: client-side search over loaded pages (API has no text filter yet); add ?q= to GET /transactions when lists get long.
  const needle = search.trim().toLowerCase();
  const items = needle ? loaded.filter((t) => `${t.description ?? ""} ${t.category.name}`.toLowerCase().includes(needle)) : loaded;
  const total = list.data?.pages[0]?.total ?? 0;
  const groups = groupByDate(items);
  const dayTag = (date: string) => (date.startsWith(todayISO) ? "Hari ini" : date.startsWith(yesterdayISO) ? "Kemarin" : null);
  const fieldCls = "h-11 w-full min-w-0 rounded-lg border bg-card px-3 text-sm dark:bg-card-inner";

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs font-bold text-primary">
            Buku Kas {business.data?.branchLabel && <span>· {business.data.branchLabel}</span>}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Transaksi</h1>
          <p className="text-muted-foreground">Riwayat kas masuk dan keluar usahamu</p>
        </div>
        <div className="grid gap-2 sm:flex">
          <button type="button" onClick={() => exporter.mutate()} disabled={exporter.isPending || !from || !to} className={`${ghostBtn} flex-1 bg-muted md:flex-none dark:bg-card-inner`}>
            {exporter.isPending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Download className="size-4" />} Ekspor Rekap
          </button>
          <button type="button" onClick={() => setEditing("new")} className={`${primaryBtn} order-first flex-1 sm:order-none md:flex-none`}>
            <Plus className="size-5" /> Catat Transaksi
          </button>
        </div>
      </header>
      {exporter.isError && <ErrorBox message={exporter.error instanceof ApiError ? exporter.error.message : "Gagal mengekspor rekap."} />}

      <aside className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-bold text-secondary-foreground">
            <Zap className="size-3" /> Baca Struk Otomatis
          </p>
          <p className="mt-2 text-lg font-bold">Punya struk belanja pasar?</p>
          <p className="text-sm text-muted-foreground">Foto bon belanjaan grosir, sistem membaca nominal & update harga bahan tanpa input manual.</p>
        </div>
        <Link href="/receipts/new" className={`${primaryBtn} shrink-0`}>
          <FileImage className="size-5" /> Unggah Foto Struk
        </Link>
      </aside>

      <section aria-label="Filter transaksi" className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-3 shadow-sm lg:grid-cols-[auto_repeat(3,minmax(0,1fr))_minmax(0,1.3fr)] lg:items-center">
        <fieldset className="flex rounded-lg bg-muted p-1 dark:bg-card-inner">
          <legend className="sr-only">Jenis transaksi</legend>
          {TYPE_TABS.map((t) => (
            <label key={t.value} className="flex-1 cursor-pointer rounded-md px-3 py-2 text-center text-sm font-semibold text-muted-foreground has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-ring">
              <input
                type="radio"
                name="type-filter"
                value={t.value}
                checked={type === t.value}
                onChange={() => {
                  setType(t.value);
                  setCategoryId("");
                }}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-2 gap-3 lg:contents">
          <label>
            <span className="sr-only">Dari tanggal</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={fieldCls} />
          </label>
          <label>
            <span className="sr-only">Sampai tanggal</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={fieldCls} />
          </label>
        </div>
        <label>
          <span className="sr-only">Kategori</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldCls}>
            <option value="">Semua Kategori</option>
            {categories.data
              ?.filter((c) => !type || c.type === type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="relative">
          <span className="sr-only">Cari transaksi</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari transaksi…" className={`${fieldCls} pl-9`} />
        </label>
      </section>

      {list.isError ? (
        <ErrorBox onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title={needle ? `Tidak ada transaksi "${search.trim()}"` : "Tidak ada transaksi"}
          desc={needle ? "Coba kata kunci lain." : "Belum ada transaksi di periode dan filter ini."}
          action={
            !needle && (
              <button type="button" onClick={() => setEditing("new")} className={primaryBtn}>
                <Plus className="size-5" /> Catat Transaksi
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {groups.map(({ date, items: dayItems, netCents }) => {
            const tag = dayTag(date);
            return (
              <section key={date} aria-label={longDate(date)}>
                <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/60 px-4 py-3 dark:bg-card-inner">
                  <h2 className="flex flex-wrap items-center gap-2 font-semibold">
                    <CalendarDays aria-hidden className="size-4 text-primary" /> {longDate(date)}
                    <span className="rounded-md bg-card px-2 py-0.5 font-mono text-xs font-normal text-muted-foreground">
                      {tag && `${tag} · `}
                      {dayItems.length} transaksi
                    </span>
                  </h2>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Subtotal bersih: </span>
                    <span className={`tabular font-bold ${netCents < 0n ? "text-expense" : "text-primary"}`}>
                      {netCents < 0n ? "−" : "+"}
                      {formatIDR(centsToString(netCents < 0n ? -netCents : netCents))}
                    </span>
                  </p>
                </header>
                <ul className="divide-y border-b last:border-b-0">
                  {dayItems.map((t) => {
                    const income = t.type === "INCOME";
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-3.5">
                        <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-full ${income ? "bg-primary/10 text-primary dark:bg-primary/15" : "bg-expense-soft text-expense"}`}>
                          {income ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                        </span>
                        {/* Mobile: amount stacks under the text so the description isn't truncated */}
                        <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2">
                              <span className="truncate font-semibold">{t.description || t.category.name}</span>
                              {t.source === "OCR" && <span className="shrink-0 rounded bg-secondary px-1.5 font-mono text-xs font-bold text-secondary-foreground">Struk</span>}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {income ? "Pemasukan" : "Pengeluaran"} • {t.category.name}
                              {t.recipe && ` • ${t.portions}× ${t.recipe.name}`}
                            </p>
                          </div>
                          <p className="hidden shrink-0 text-right font-mono text-xs text-muted-foreground md:block">{timeOf(t.createdAt)} WIB</p>
                          <p className={`tabular shrink-0 text-base font-bold sm:w-36 sm:text-right ${income ? "text-primary" : "text-expense"}`}>
                            {income ? "+" : "−"}
                            {formatIDR(t.amount)}
                          </p>
                        </div>
                        <div className="flex shrink-0">
                          <button type="button" onClick={() => setEditing(t)} aria-label={`Ubah transaksi ${t.description || t.category.name}`} className={iconBtn}>
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            disabled={remove.isPending}
                            onClick={() => window.confirm("Hapus transaksi ini?") && remove.mutate(t.id)}
                            aria-label={`Hapus transaksi ${t.description || t.category.name}`}
                            className={`${iconBtn} hover:text-expense`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {items.length > 0 && (
        <div className="text-center">
          {list.hasNextPage && (
            <button type="button" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage} className={`${ghostBtn} bg-muted px-8 dark:bg-card-inner`}>
              {list.isFetchingNextPage ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <ChevronDown className="size-4" />}
              Muat Lebih Banyak Transaksi
            </button>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Menampilkan {items.length} dari {total} transaksi
          </p>
        </div>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Catat Transaksi" : "Ubah Transaksi"}>
        {editing !== null && <TransactionForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </main>
  );
}

function groupByDate(items: Transaction[]) {
  const groups: { date: string; items: Transaction[]; netCents: bigint }[] = [];
  for (const t of items) {
    let g = groups.at(-1);
    if (!g || g.date !== t.transactionDate) groups.push((g = { date: t.transactionDate, items: [], netCents: 0n }));
    g.items.push(t);
    // Exact cents, not float: this is a money subtotal.
    g.netCents += (t.type === "INCOME" ? 1n : -1n) * toScaled(t.amount, 2);
  }
  return groups;
}

function invalidateMoney(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: transactionsKey });
  queryClient.invalidateQueries({ queryKey: ["summary"] });
  queryClient.invalidateQueries({ queryKey: ["reports"] });
  queryClient.invalidateQueries({ queryKey: [...recipesKey, "sales"] });
}

// Mirrors CreateTransactionDto (backend/src/transaction/transaction.dto.ts).
const schema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().min(1, "Pilih kategori."),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Isi angka, maksimal 2 desimal.")
    .refine((v) => Number(v) >= 0.01, "Nominal harus lebih dari 0."),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pilih tanggal."),
  description: z.string().trim().max(500, "Maksimal 500 karakter."),
  recipeId: z.string(), // "" = not a menu sale
  portions: z.string().trim(),
}).refine((v) => v.type !== "INCOME" || !v.recipeId || (/^\d+$/.test(v.portions) && Number(v.portions) >= 1 && Number(v.portions) <= 100_000), {
  message: "Isi jumlah porsi (1–100.000).",
  path: ["portions"],
});
type Values = z.infer<typeof schema>;

function TransactionForm({ initial, onDone }: { initial: Transaction | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const categories = useCategories();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          type: initial.type,
          categoryId: initial.categoryId,
          amount: String(Number(initial.amount)),
          transactionDate: initial.transactionDate.slice(0, 10),
          description: initial.description ?? "",
          recipeId: initial.recipeId ?? "",
          portions: initial.portions === null ? "" : String(initial.portions),
        }
      : { type: "INCOME", categoryId: "", amount: "", transactionDate: toISODate(new Date()), description: "", recipeId: "", portions: "" },
  });
  const type = useWatch({ control, name: "type" });
  const options = categories.data?.filter((c) => c.type === type) ?? [];
  const recipes = useQuery({ queryKey: [...recipesKey, ""], queryFn: () => api<Recipe[]>("/recipes") });

  const save = useMutation({
    mutationFn: (v: Values) => {
      // `type` is only a UI filter: the server derives it from the category.
      const sale = v.type === "INCOME" && v.recipeId ? { recipeId: v.recipeId, portions: Number(v.portions) } : { recipeId: null, portions: null };
      const body = JSON.stringify({ categoryId: v.categoryId, amount: Number(v.amount), transactionDate: v.transactionDate, description: v.description, ...sale }); // "" clears description on edit
      return initial ? api(`/transactions/${initial.id}`, { method: "PATCH", body }) : api("/transactions", { method: "POST", body });
    },
    onSuccess: () => {
      invalidateMoney(queryClient);
      onDone();
    },
    onError: (err) => setError("root", { message: err instanceof ApiError ? err.message : "Gagal menyimpan transaksi." }),
  });

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
      <fieldset className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1 dark:bg-card-inner">
        <legend className="sr-only">Jenis transaksi</legend>
        {(["INCOME", "EXPENSE"] as const).map((t) => (
          <label
            key={t}
            className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold text-muted-foreground has-focus-visible:outline-2 has-focus-visible:outline-ring ${t === "INCOME" ? "has-checked:bg-income has-checked:text-white dark:has-checked:text-black" : "has-checked:bg-expense has-checked:text-white dark:has-checked:text-black"}`}
          >
            <input type="radio" value={t} className="sr-only" {...register("type", { onChange: () => setValue("categoryId", "") })} />
            {t === "INCOME" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
            {t === "INCOME" ? "Masuk" : "Keluar"}
          </label>
        ))}
      </fieldset>
      <SelectField label="Kategori" error={errors.categoryId?.message} disabled={categories.isPending} {...register("categoryId")}>
        <option value="">{categories.isPending ? "Memuat…" : "Pilih kategori…"}</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nominal" leading="Rp" type="text" inputMode="decimal" placeholder="50000" error={errors.amount?.message} {...register("amount")} />
        <Field label="Tanggal" type="date" error={errors.transactionDate?.message} {...register("transactionDate")} />
      </div>
      {type === "INCOME" && (recipes.data?.length ?? 0) > 0 && (
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <SelectField label="Menu terjual (opsional)" {...register("recipeId")}>
            <option value="">— bukan penjualan menu —</option>
            {recipes.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
          <Field label="Porsi" type="text" inputMode="numeric" placeholder="10" error={errors.portions?.message} {...register("portions")} />
        </div>
      )}
      <Field label="Keterangan (opsional)" placeholder={type === "INCOME" ? "Penjualan shift pagi" : "Belanja susu & gula"} error={errors.description?.message} {...register("description")} />
      <FormError message={errors.root?.message} />
      <SubmitButton pending={save.isPending}>
        {save.isPending && <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />}
        {save.isPending ? "Menyimpan…" : "Simpan Transaksi"}
      </SubmitButton>
    </form>
  );
}
