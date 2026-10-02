"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, Lightbulb, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Tag, Trash2, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { formatIDR, formatPct } from "@/lib/format";
import { calculateHpp, ceilToRupiah, centsToString, lineCost, recommendedPrice } from "@/lib/hpp";
import { useIngredients, type Ingredient } from "@/lib/ingredients";
import { HEALTH_STYLE, marginHealth, marginPct, recipesKey, type Recipe, type RecipeDetail } from "@/lib/recipes";
import { FormError } from "@/app/_components/fields";
import { EmptyState, ErrorBox, ghostBtn, iconBtn, ListSkeleton, primaryBtn } from "../ui";

const money = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Isi angka, maksimal 2 desimal.");
const qty = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Isi angka, maksimal 3 desimal.")
  .refine((v) => Number(v) > 0, "Harus lebih dari 0.");

// Mirrors CreateRecipeDto (backend/src/recipe/recipe.dto.ts).
const schema = z.object({
  name: z.string().trim().min(1, "Nama menu wajib diisi.").max(150),
  category: z.string().trim().max(60, "Kategori maksimal 60 karakter."),
  yieldPortions: z
    .string()
    .trim()
    .regex(/^\d+$/, "Isi bilangan bulat.")
    .refine((v) => Number(v) >= 1 && Number(v) <= 100_000, "Antara 1 dan 100.000 porsi."),
  targetMarginPct: z.string().refine((v) => Number(v) >= 0 && Number(v) < 100, "Margin 0–99%."),
  sellingPrice: z.union([z.literal(""), money]),
  ingredients: z
    .array(z.object({ ingredientId: z.string().min(1, "Pilih bahan."), quantity: qty }))
    .min(1, "Tambah minimal 1 bahan.")
    .refine((items) => new Set(items.map((i) => i.ingredientId)).size === items.length, "Bahan tidak boleh dipilih dua kali."),
  overheads: z.array(z.object({ name: z.string().trim().min(1, "Isi nama biaya.").max(100), costPerPortion: money })),
});
type Values = z.infer<typeof schema>;

const toForm = (r: RecipeDetail): Values => ({
  name: r.name,
  category: r.category ?? "",
  yieldPortions: String(r.yieldPortions),
  targetMarginPct: String(Number(r.targetMarginPct)),
  sellingPrice: r.sellingPrice === null ? "" : String(Number(r.sellingPrice)),
  ingredients: r.ingredients.map((i) => ({ ingredientId: i.ingredientId, quantity: String(Number(i.quantity)) })),
  overheads: r.overheads.map((o) => ({ name: o.name, costPerPortion: String(Number(o.costPerPortion)) })),
});

const EMPTY: Values = { name: "", category: "", yieldPortions: "1", targetMarginPct: "60", sellingPrice: "", ingredients: [{ ingredientId: "", quantity: "" }], overheads: [] };
const PURCHASE_LABEL = { kg: "kg", liter: "liter", pack: "pack", pcs: "pcs" } as const;
const inputCls =
  "h-11 w-full rounded-md border bg-card px-3 text-[15px] shadow-sm focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-expense dark:bg-card-inner";

export function RecipeEditor({ id }: { id?: string }) {
  const ingredients = useIngredients();
  const recipe = useQuery({ queryKey: [...recipesKey, "detail", id], queryFn: () => api<RecipeDetail>(`/recipes/${id}`), enabled: !!id });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <nav aria-label="Breadcrumb" className="font-mono text-xs text-muted-foreground">
        <Link href="/recipes" className="rounded hover:text-foreground">
          ← Resep
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Kalkulator HPP Live</span>
      </nav>
      {ingredients.isError || recipe.isError ? (
        <ErrorBox
          message={recipe.error instanceof ApiError && recipe.error.status === 404 ? "Resep tidak ditemukan." : "Gagal memuat data."}
          onRetry={() => (ingredients.isError ? ingredients.refetch() : recipe.refetch())}
        />
      ) : ingredients.isPending || (id && recipe.isPending) ? (
        <ListSkeleton rows={3} />
      ) : ingredients.data.length === 0 ? (
        <EmptyState
          title="Belum ada bahan baku"
          desc="Resep menghitung HPP dari harga bahan. Tambahkan bahan bakumu dulu, lalu kembali ke sini."
          action={
            <Link href="/ingredients" className={primaryBtn}>
              <Plus className="size-5" /> Tambah Bahan Baku
            </Link>
          }
        />
      ) : (
        <>
          <RecipeForm key={id ?? "new"} id={id} ingredients={ingredients.data} initial={recipe.data ? toForm(recipe.data) : EMPTY} />
          {id && recipe.data && <HppTrend id={id} name={recipe.data.name} />}
        </>
      )}
    </main>
  );
}

function RecipeForm({ id, ingredients, initial }: { id?: string; ingredients: Ingredient[]; initial: Values }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const ingredientRows = useFieldArray({ control, name: "ingredients" });
  const overheadRows = useFieldArray({ control, name: "overheads" });
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const live = useLive(control, byId);
  const all = useQuery({ queryKey: [...recipesKey, ""], queryFn: () => api<Recipe[]>("/recipes") });
  const categories = [...new Set(all.data?.flatMap((r) => (r.category ? [r.category] : [])))].sort((a, b) => a.localeCompare(b, "id"));

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = JSON.stringify({
        name: v.name,
        category: v.category, // "" clears it
        yieldPortions: Number(v.yieldPortions),
        targetMarginPct: Number(v.targetMarginPct),
        sellingPrice: v.sellingPrice === "" ? null : Number(v.sellingPrice),
        ingredients: v.ingredients.map((i) => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity) })),
        overheads: v.overheads.map((o) => ({ name: o.name, costPerPortion: Number(o.costPerPortion) })),
      });
      return id ? api<RecipeDetail>(`/recipes/${id}`, { method: "PATCH", body }) : api<RecipeDetail>("/recipes", { method: "POST", body });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: recipesKey });
      if (id) reset(toForm(saved));
      else router.replace(`/recipes/${saved.id}`);
    },
    onError: (err) => setError("root", { message: err instanceof ApiError ? err.message : "Gagal menyimpan resep." }),
  });

  const remove = useMutation({
    mutationFn: () => api(`/recipes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipesKey });
      router.replace("/recipes");
    },
    onError: (err) => setError("root", { message: err instanceof ApiError ? err.message : "Gagal menghapus resep." }),
  });

  const ingredientsError = errors.ingredients?.root?.message ?? errors.ingredients?.message;
  const health = HEALTH_STYLE[live.health];

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
      {/* Title bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <label htmlFor="recipe-name" className="sr-only">
            Nama menu
          </label>
          <div className="flex items-center gap-2 border-b-2 border-dashed pb-1 focus-within:border-primary md:max-w-xl">
            <input
              id="recipe-name"
              placeholder="Nama menu, mis. Es Kopi Susu Aren"
              aria-invalid={errors.name ? true : undefined}
              className="min-w-0 flex-1 bg-transparent text-3xl font-extrabold tracking-tight placeholder:text-muted-foreground/60 focus:outline-none"
              {...register("name")}
            />
            <Pencil aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          </div>
          {errors.name && <p className="mt-1 text-sm text-expense">{errors.name.message}</p>}
          <h1 className="sr-only">{id ? "Ubah resep" : "Resep baru"}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
              Hasil
              <input type="text" inputMode="numeric" aria-invalid={errors.yieldPortions ? true : undefined} className="w-12 rounded border bg-card px-1.5 text-center font-mono text-sm text-foreground aria-invalid:border-expense" {...register("yieldPortions")} />
              porsi / resep
            </label>
            <label className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 dark:bg-card-inner">
              Kategori
              <input list="recipe-categories" placeholder="Minuman" aria-invalid={errors.category ? true : undefined} className="w-32 rounded border bg-card px-1.5 text-sm aria-invalid:border-expense" {...register("category")} />
              <datalist id="recipe-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${health.badge}`}>
              <i aria-hidden className={`size-2 rounded-full ${health.bar}`} />
              {health.label}
              {live.margin !== null && ` (${formatPct(live.margin)})`}
            </span>
            {errors.yieldPortions && <span className="text-sm text-expense">{errors.yieldPortions.message}</span>}
            {errors.category && <span className="text-sm text-expense">{errors.category.message}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => reset()} disabled={!isDirty} className={`${ghostBtn} bg-muted dark:bg-card-inner`}>
            <RotateCcw className="size-4" /> Batal / Reset
          </button>
          <button type="submit" disabled={save.isPending} className={primaryBtn}>
            {save.isPending ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : <CheckCircle2 className="size-5" />}
            {save.isPending ? "Menyimpan…" : "Simpan Resep"}
          </button>
        </div>
      </div>
      <FormError message={errors.root?.message} />
      {id && !isDirty && save.isSuccess && (
        <p role="status" className="text-sm text-income">
          Tersimpan. HPP dihitung ulang di server.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          <section aria-labelledby="bahan-title" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-start justify-between gap-3 p-5">
              <div>
                <h2 id="bahan-title" className="text-lg font-bold">Daftar Bahan Baku</h2>
                <p className="text-sm text-muted-foreground">Takaran untuk 1 resep. Harga ikut master bahan baku.</p>
              </div>
              <button type="button" onClick={() => ingredientRows.append({ ingredientId: "", quantity: "" })} className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border-2 border-dashed border-primary/60 px-3 text-sm font-semibold text-primary hover:bg-primary/5">
                <Plus className="size-4" /> Tambah Bahan
              </button>
            </div>
            <ul className="divide-y border-t px-5">
              {ingredientRows.fields.map((field, index) => (
                <IngredientRow key={field.id} index={index} control={control} register={register} ingredients={ingredients} byId={byId} errors={errors.ingredients?.[index]} onRemove={() => ingredientRows.remove(index)} />
              ))}
            </ul>
            {ingredientsError && <p className="px-5 pb-3 text-sm text-expense">{ingredientsError}</p>}

            <div className="border-t bg-muted/60 p-5 dark:bg-card-inner/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-1.5 font-bold">
                    <Zap className="size-4 text-warning" /> Biaya Overhead &amp; Operasional Porsi
                  </h3>
                  <p className="text-sm text-muted-foreground">Per porsi: listrik, gas, kemasan, tissue.</p>
                </div>
                <button type="button" onClick={() => overheadRows.append({ name: "", costPerPortion: "" })} className={`${ghostBtn} h-10 shrink-0`}>
                  <Plus className="size-4" /> Biaya
                </button>
              </div>
              {overheadRows.fields.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {overheadRows.fields.map((field, index) => (
                    <li key={field.id} className="grid grid-cols-[1fr_9rem_auto] items-start gap-2">
                      <div>
                        <label htmlFor={`oh-name-${index}`} className="sr-only">Nama biaya {index + 1}</label>
                        <input id={`oh-name-${index}`} placeholder="Mis. Gas & listrik" aria-invalid={errors.overheads?.[index]?.name ? true : undefined} className={inputCls} {...register(`overheads.${index}.name`)} />
                        {errors.overheads?.[index]?.name && <p className="mt-1 text-sm text-expense">{errors.overheads[index]?.name?.message}</p>}
                      </div>
                      <div>
                        <label htmlFor={`oh-cost-${index}`} className="sr-only">Biaya per porsi {index + 1}</label>
                        <div className="relative">
                          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted-foreground">Rp</span>
                          <input id={`oh-cost-${index}`} inputMode="decimal" aria-invalid={errors.overheads?.[index]?.costPerPortion ? true : undefined} className={`${inputCls} tabular pl-9 text-right font-semibold`} {...register(`overheads.${index}.costPerPortion`)} />
                        </div>
                        {errors.overheads?.[index]?.costPerPortion && <p className="mt-1 text-sm text-expense">{errors.overheads[index]?.costPerPortion?.message}</p>}
                      </div>
                      <button type="button" onClick={() => overheadRows.remove(index)} aria-label={`Hapus biaya ${index + 1}`} className={`${iconBtn} hover:text-expense`}>
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-end justify-between gap-4 border-t p-5" aria-live="polite">
              <div>
                <p className="text-lg font-bold">Total HPP per Porsi</p>
                <p className="text-sm text-muted-foreground">
                  Dihitung otomatis dari <b className="text-foreground">{live.lineCount}</b> bahan baku + overhead.
                </p>
              </div>
              <div className="text-right">
                <p className="tabular text-3xl font-bold text-primary md:text-4xl">{formatIDR(centsToString(live.hpp.hppPerPortion))}</p>
                {live.cogs !== null && <p className="font-mono text-xs text-muted-foreground">Modal = {formatPct(live.cogs)} dari harga jual</p>}
              </div>
            </div>
          </section>

          <aside className="flex gap-3 rounded-2xl border border-accent/40 bg-secondary p-4 text-sm text-secondary-foreground">
            <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0" />
            <p>
              <b>Aturan praktis F&amp;B:</b> jaga HPP di kisaran <b>30%–40%</b> dari harga jual menu dine-in, dan maksimal <b>45%</b> jika ada potongan komisi aplikasi online.
            </p>
          </aside>
        </div>

        <PricingPanel register={register} live={live} aiRecipeId={id} dirty={isDirty} onUsePrice={(price) => setValue("sellingPrice", price, { shouldDirty: true, shouldValidate: true })} sellingPriceError={errors.sellingPrice?.message} />
      </div>

      {id && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => window.confirm("Hapus resep ini? Riwayat HPP-nya ikut terhapus.") && remove.mutate()}
            className={`${ghostBtn} text-expense hover:bg-expense-soft`}
          >
            <Trash2 className="size-4" /> Hapus Resep
          </button>
        </div>
      )}
    </form>
  );
}

/** Live HPP from the current (unsaved) form values. Exact math: lib/hpp.ts mirrors the backend. */
function useLive(control: Control<Values>, byId: Map<string, Ingredient>) {
  const v = useWatch({ control });
  const lines = (v.ingredients ?? []).flatMap((i) => {
    const ing = byId.get(i?.ingredientId ?? "");
    return ing && i?.quantity ? [{ quantity: i.quantity, pricePerUsageUnit: ing.pricePerUsageUnit }] : [];
  });
  const hpp = calculateHpp({
    yieldPortions: Number(v.yieldPortions) || 1,
    ingredients: lines,
    overheads: (v.overheads ?? []).map((o) => ({ costPerPortion: o?.costPerPortion ?? "0" })),
  });
  const target = Number(v.targetMarginPct ?? 0);
  const recommended = recommendedPrice(hpp.hppPerPortion, v.targetMarginPct ?? "0");
  const hppNumber = Number(centsToString(hpp.hppPerPortion));
  const price = v.sellingPrice ? Number(v.sellingPrice) : null;
  const margin = marginPct(hppNumber, price);
  return {
    hpp,
    hppNumber,
    target,
    recommended,
    rounded: ceilToRupiah(recommended, 500),
    price,
    margin,
    health: marginHealth(margin, target),
    cogs: price ? Math.round((hppNumber / price) * 1000) / 10 : null,
    lineCount: lines.length,
  };
}

function IngredientRow({ index, control, register, ingredients, byId, errors, onRemove }: {
  index: number;
  control: Control<Values>;
  register: UseFormRegister<Values>;
  ingredients: Ingredient[];
  byId: Map<string, Ingredient>;
  errors?: { ingredientId?: { message?: string }; quantity?: { message?: string } };
  onRemove: () => void;
}) {
  const row = useWatch({ control, name: `ingredients.${index}` });
  const ingredient = byId.get(row?.ingredientId ?? "");
  const cost = ingredient && /^\d+(\.\d+)?$/.test(row?.quantity ?? "") ? lineCost(row.quantity, ingredient.pricePerUsageUnit) : null;
  const reference = ingredient
    ? ingredient.purchaseUnit === "pack"
      ? `${formatIDR(ingredient.purchasePrice)} / pack (${Number(ingredient.purchaseQty)} ${ingredient.usageUnit})`
      : `${formatIDR(ingredient.purchasePrice)} / ${Number(ingredient.purchaseQty) === 1 ? "" : `${Number(ingredient.purchaseQty)} `}${PURCHASE_LABEL[ingredient.purchaseUnit]}`
    : null;

  return (
    <li className="grid grid-cols-[1fr_auto_auto] items-start gap-x-3 gap-y-2 py-4 sm:grid-cols-[1fr_8rem_6.5rem_auto]">
      <div className="col-span-3 sm:col-span-1">
        <label htmlFor={`ing-${index}`} className="sr-only">
          Bahan {index + 1}
        </label>
        <select id={`ing-${index}`} aria-invalid={errors?.ingredientId ? true : undefined} className={`${inputCls} font-semibold`} {...register(`ingredients.${index}.ingredientId`)}>
          <option value="">Pilih bahan…</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        {reference && <p className="mt-1 font-mono text-xs text-muted-foreground">Acuan: {reference}</p>}
        {errors?.ingredientId && <p className="mt-1 text-sm text-expense">{errors.ingredientId.message}</p>}
      </div>
      <div>
        <label htmlFor={`qty-${index}`} className="sr-only">
          Takaran bahan {index + 1}
        </label>
        <div className="relative">
          <input id={`qty-${index}`} inputMode="decimal" placeholder="0" aria-invalid={errors?.quantity ? true : undefined} className={`${inputCls} tabular pr-12 text-right text-lg font-bold`} {...register(`ingredients.${index}.quantity`)} />
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs text-muted-foreground">
            {ingredient?.usageUnit ?? ""}
          </span>
        </div>
        {errors?.quantity && <p className="mt-1 text-sm text-expense">{errors.quantity.message}</p>}
      </div>
      <p className="self-center text-right" aria-live="polite">
        <span className="sr-only">Biaya: </span>
        <span className="tabular block font-bold">{cost === null ? "—" : formatIDR(centsToString(cost))}</span>
        {cost !== null && (
          <span className="flex items-center justify-end gap-1 font-mono text-xs text-primary">
            <RefreshCw aria-hidden className="size-3" /> otomatis
          </span>
        )}
      </p>
      <button type="button" onClick={onRemove} aria-label={`Hapus bahan ${index + 1}`} className={`${iconBtn} self-center hover:text-expense`}>
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

const MARGIN_TICKS = [
  { v: 10, label: "10%" },
  { v: 30, label: "30% (Kritis)", tone: "text-expense" },
  { v: 50, label: "50% (Ideal)", tone: "text-primary" },
  { v: 70, label: "70%" },
];

function PricingPanel({ register, live, aiRecipeId, dirty, onUsePrice, sellingPriceError }: {
  register: UseFormRegister<Values>;
  live: ReturnType<typeof useLive>;
  aiRecipeId?: string;
  dirty: boolean;
  onUsePrice: (price: string) => void;
  sellingPriceError?: string;
}) {
  const grossPerPortion = Number(centsToString(live.recommended)) - live.hppNumber;
  // Health meter: 0% | 30% | 50% | 100% segments, marker at current margin.
  const marker = Math.max(0, Math.min(100, live.margin ?? 0));

  return (
    <section aria-labelledby="pricing-title" className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-20">
      <h2 id="pricing-title" className="border-b pb-3 text-lg font-bold">
        Harga Jual &amp; Simulasi Margin
      </h2>

      <div className="flex items-center justify-between rounded-xl bg-muted p-4 dark:bg-card-inner" aria-live="polite">
        <div>
          <p className="font-mono text-xs font-bold">Modal Dasar HPP</p>
          <p className="text-xs text-muted-foreground">
            Bahan {formatIDR(centsToString(live.hpp.ingredientsPerPortion))} + overhead {formatIDR(centsToString(live.hpp.overheadPerPortion))}
          </p>
        </div>
        <p className="tabular text-xl font-bold">{formatIDR(centsToString(live.hpp.hppPerPortion))}</p>
      </div>

      <div>
        <label htmlFor="target-margin" className="flex items-baseline justify-between font-semibold">
          Target Margin Keuntungan
          <span className="tabular text-3xl font-bold text-primary">{live.target}%</span>
        </label>
        <input id="target-margin" type="range" min={0} max={80} step={1} className="mt-3 w-full accent-primary" {...register("targetMarginPct")} />
        <div aria-hidden className="relative mt-1 h-4 font-mono text-xs text-muted-foreground">
          {MARGIN_TICKS.map((t) => (
            <span key={t.v} className={`absolute -translate-x-1/2 whitespace-nowrap ${t.tone ?? ""}`} style={{ left: `${(t.v / 80) * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3 font-mono text-sm text-primary dark:bg-primary/15">
        <span>Laba kotor per porsi:</span>
        <b className="tabular text-base">{formatIDR(Math.max(0, grossPerPortion))}</b>
      </div>

      <AiSuggestion recipeId={aiRecipeId} dirty={dirty} onUsePrice={onUsePrice} />

      <div className="border-t pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs font-bold text-muted-foreground">Rekomendasi Pembulatan</p>
            <p className="tabular text-3xl font-bold">{formatIDR(centsToString(live.rounded))}</p>
            <p className="text-xs text-muted-foreground">Tepatnya {formatIDR(centsToString(live.recommended))} · margin dari harga jual, bukan markup</p>
          </div>
          <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-xs dark:bg-card-inner">Kelipatan Rp 500</span>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="selling-price" className="font-semibold">
            Harga Jual Aktual
          </label>
          <button type="button" onClick={() => onUsePrice(centsToString(live.rounded).replace(/\.00$/, ""))} disabled={live.hpp.hppPerPortion === 0n} className="rounded text-sm font-semibold text-primary hover:underline disabled:opacity-50">
            Pakai rekomendasi
          </button>
        </div>
        <div className="relative mt-1.5">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-mono text-sm text-muted-foreground">Rp</span>
          <input
            id="selling-price"
            inputMode="decimal"
            placeholder="Kosongkan jika belum ada"
            aria-invalid={sellingPriceError ? true : undefined}
            aria-describedby="selling-price-hint"
            className={`${inputCls} tabular h-12 pl-11 text-lg font-bold`}
            {...register("sellingPrice")}
          />
        </div>
        <p id="selling-price-hint" className={`mt-1.5 text-xs ${sellingPriceError ? "text-expense" : "text-muted-foreground"}`}>
          {sellingPriceError ?? "Harga yang tertulis di menu / kasir."}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Indikator Kesehatan Margin</span>
          <span className={`font-mono text-xs font-bold ${HEALTH_STYLE[live.health].text}`}>{live.margin === null ? "—" : `${formatPct(live.margin)} (${HEALTH_STYLE[live.health].label})`}</span>
        </div>
        <div className="relative mt-2" role="meter" aria-label="Margin harga jual" aria-valuemin={0} aria-valuemax={100} aria-valuenow={marker}>
          <div className="flex h-2.5 overflow-hidden rounded-full">
            <span className="w-[30%] bg-expense" />
            <span className="w-[20%] bg-accent" />
            <span className="flex-1 bg-income" />
          </div>
          {live.margin !== null && <span aria-hidden className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow" style={{ left: `${marker}%` }} />}
        </div>
        <div aria-hidden className="mt-1.5 flex justify-between font-mono text-xs text-muted-foreground">
          <span>Rugi / kritis</span>
          <span>Standar</span>
          <span>Sehat &amp; aman</span>
        </div>
      </div>
    </section>
  );
}

// Mirrors the PriceSuggestion row (backend/src/pricing/pricing.module.ts).
type PriceSuggestion = { minPrice: string; maxPrice: string; recommendedPrice: string; reasoning: string; model: string };

/** Splits the model's reasoning into bullet points: by line, else by sentence (older saved replies are one paragraph). */
const reasonPoints = (text: string) =>
  text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((p) => p.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

/** AI price suggestion (POST /recipes/:id/price-suggestion). The server uses the saved HPP, so unsaved edits block it. */
function AiSuggestion({ recipeId, dirty, onUsePrice }: { recipeId?: string; dirty: boolean; onUsePrice: (price: string) => void }) {
  const ask = useMutation({
    mutationFn: () => api<PriceSuggestion>(`/recipes/${recipeId}/price-suggestion`, { method: "POST" }),
  });
  const s = ask.data;
  const blocked = !recipeId ? "Simpan resep dulu untuk minta saran harga AI." : dirty ? "Simpan perubahan dulu: saran AI memakai HPP yang tersimpan." : null;
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => ask.mutate()}
        disabled={ask.isPending || !!blocked}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-bold text-accent-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {ask.isPending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Tag className="size-4" />}
        {ask.isPending ? "Menganalisis harga pasar…" : s ? "Minta Saran Ulang" : "Minta Saran Harga AI"}
      </button>
      {blocked && <p className="text-sm text-muted-foreground">{blocked}</p>}
      {ask.isError && <p className="text-sm text-expense">{ask.error instanceof ApiError ? ask.error.message : "Saran belum bisa dibuat. Coba lagi."}</p>}
      {s && (
        <div role="status" className="space-y-3 rounded-xl border border-accent/50 bg-secondary p-4 text-sm text-secondary-foreground">
          <p className="flex items-center gap-2 font-bold">
            <Tag className="size-4" /> Saran UsahaKu
          </p>
          <div className="rounded-lg bg-card p-3">
            <p className="text-xs text-muted-foreground">Harga jual yang disarankan</p>
            <p className="tabular text-2xl font-bold">{formatIDR(s.recommendedPrice)}</p>
            <p className="tabular text-xs text-muted-foreground">
              Kisaran wajar {formatIDR(s.minPrice)} – {formatIDR(s.maxPrice)}
            </p>
          </div>
          <div>
            <p className="font-bold">Alasannya</p>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 marker:text-accent">
              {reasonPoints(s.reasoning).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => onUsePrice(String(Number(s.recommendedPrice)))}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <CheckCircle2 className="size-4" /> Terapkan {formatIDR(s.recommendedPrice)}
          </button>
        </div>
      )}
    </div>
  );
}

type Snapshot = { hppPerPortion: string; trigger: "RECIPE_EDIT" | "PRICE_CHANGE"; createdAt: string };

/** HPP history line chart (GET /recipes/:id/hpp-history). Single series -> brand teal. */
function HppTrend({ id, name }: { id: string; name: string }) {
  const history = useQuery({ queryKey: [...recipesKey, "history", id], queryFn: () => api<Snapshot[]>(`/recipes/${id}/hpp-history`) });
  if (history.isPending) return <div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />;
  if (history.isError) return <ErrorBox onRetry={() => history.refetch()} />;

  const points = history.data.map((s) => ({ ...s, value: Number(s.hppPerPortion) }));
  const first = points[0]?.value ?? 0;
  const last = points.at(-1)?.value ?? 0;
  const change = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0;
  const avg = points.length ? points.reduce((s, p) => s + p.value, 0) / points.length : 0;
  const date = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

  // SVG geometry (viewBox units); y padded 15% so the line never touches the edges.
  const W = 600;
  const H = 160;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const pad = (max - min || max || 1) * 0.15;
  const x = (i: number) => (points.length === 1 ? W / 2 : 16 + (i * (W - 32)) / (points.length - 1));
  const y = (v: number) => H - 12 - ((v - (min - pad)) / (max + pad - (min - pad))) * (H - 24);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");

  return (
    <section aria-labelledby="hpp-trend-title" className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span aria-hidden className="flex size-10 items-center justify-center rounded-lg bg-muted dark:bg-card-inner">
            <TrendingUp className="size-5" />
          </span>
          <div>
            <h2 id="hpp-trend-title" className="text-lg font-bold">Tren Fluktuasi HPP</h2>
            <p className="text-sm text-muted-foreground">Riwayat biaya per porsi {name} setiap resep diubah atau harga bahan berubah</p>
          </div>
        </div>
        {points.length > 1 && (
          <p className="flex items-center gap-3 text-sm">
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs font-bold ${change > 0 ? "bg-expense-soft text-expense" : change < 0 ? "bg-income-soft text-income" : "bg-muted"}`}>
              {change > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {change > 0 ? "Naik" : change < 0 ? "Turun" : "Stabil"} {change > 0 ? "+" : ""}
              {formatPct(change)}
            </span>
            <span className="font-mono text-xs">Rata-rata: {formatIDR(Math.round(avg))}</span>
          </p>
        )}
      </div>
      {points.length < 2 ? (
        <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Baru ada 1 catatan HPP. Grafik muncul setelah resep diubah atau harga bahan berubah.</p>
      ) : (
        <figure className="mt-4 rounded-xl bg-muted/50 p-4 dark:bg-card-inner/50">
          {/* Line stretches to the card (non-scaling stroke); markers are HTML so they stay round and focusable. */}
          <div className="relative h-44">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" role="img" aria-label={`HPP dari ${formatIDR(first)} menjadi ${formatIDR(last)}`}>
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} className="stroke-border" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              ))}
              <path d={`${path} L${x(points.length - 1)},${H} L${x(0)},${H} Z`} className="fill-primary/10" />
              <path d={path} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            {points.map((p, i) => {
              const latest = i === points.length - 1;
              return (
                <span
                  key={p.createdAt + i}
                  tabIndex={0}
                  aria-label={`${date(p.createdAt)}: ${formatIDR(p.value)}, ${p.trigger === "PRICE_CHANGE" ? "harga bahan berubah" : "resep diubah"}`}
                  className="group absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-primary outline-offset-2 data-[latest=true]:bg-primary"
                  data-latest={latest}
                  style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%`, background: latest ? undefined : "var(--card)" }}
                >
                  <span aria-hidden className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-max -translate-x-1/2 rounded-lg border bg-popover px-2 py-1 text-xs shadow-md group-hover:block group-focus:block">
                    <b className="tabular">{formatIDR(p.value)}</b> · {date(p.createdAt)}
                    <span className="block text-muted-foreground">{p.trigger === "PRICE_CHANGE" ? "Harga bahan berubah" : "Resep diubah"}</span>
                  </span>
                  {latest && <span aria-hidden className="absolute bottom-full right-0 mb-1 whitespace-nowrap font-mono text-xs font-bold text-primary group-hover:hidden group-focus:hidden">Terbaru: {formatIDR(p.value)}</span>}
                </span>
              );
            })}
          </div>
          <figcaption className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
            <span>{date(points[0]!.createdAt)} ({formatIDR(first)})</span>
            <span>{date(points.at(-1)!.createdAt)}</span>
          </figcaption>
          <div className="sr-only">
            <table>
              <caption>Riwayat HPP per porsi</caption>
              <thead>
                <tr>
                  <th scope="col">Tanggal</th>
                  <th scope="col">HPP</th>
                  <th scope="col">Pemicu</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={i}>
                    <td>{date(p.createdAt)}</td>
                    <td>{formatIDR(p.value)}</td>
                    <td>{p.trigger === "PRICE_CHANGE" ? "Harga bahan berubah" : "Resep diubah"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      )}
    </section>
  );
}
