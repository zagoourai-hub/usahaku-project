"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AlertTriangle, CheckCircle2, Circle, Link2, Loader2, Plus, ScanLine, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { formatIDR, toISODate } from "@/lib/format";
import { centsToString, toScaled } from "@/lib/hpp";
import { ingredientsKey, useIngredients, type Ingredient } from "@/lib/ingredients";
import { receiptKey, subscriptionKey, useReceiptScan, type ReceiptScan } from "@/lib/receipts";
import { transactionsKey, useCategories, type Category } from "@/lib/transactions";
import { FormError } from "@/app/_components/fields";
import { ErrorBox, ghostBtn, iconBtn, primaryBtn } from "../../ui";

const money = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Isi angka, maks 2 desimal.");
const schema = z.object({
  merchantName: z.string().trim().max(100),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pilih tanggal."),
  categoryId: z.string(), // "" = auto ("Belanja Bahan"); categories load async
  updatePrices: z.boolean(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Isi nama item.").max(150),
        qty: z
          .string()
          .trim()
          .regex(/^\d+(\.\d{1,3})?$/, "Angka, maks 3 desimal.")
          .refine((v) => Number(v) > 0, "> 0"),
        unit: z.string().trim().min(1, "Isi satuan.").max(20),
        price: money,
        matchedIngredientId: z.string(),
      }),
    )
    .min(1, "Minimal 1 item."),
});
type Values = z.infer<typeof schema>;

/**
 * New purchase price (cents) when the receipt unit equals the ingredient's purchase unit.
 * Mirrors purchasePriceFromReceipt (backend/src/ingredient/unit-conversion.ts), half-up; preview only.
 */
function newPurchasePriceCents(price: string, qty: string, ingredient: Ingredient): bigint {
  const q = toScaled(qty, 3);
  if (q === 0n) return 0n;
  // pack: the price covers 1 pack; kg/liter/pcs: it covers purchaseQty units
  const num = toScaled(price, 2) * (ingredient.purchaseUnit === "pack" ? 1000n : toScaled(ingredient.purchaseQty, 3));
  return (num * 2n + q) / (q * 2n);
}

export function ReceiptReview({ id }: { id: string }) {
  const scan = useReceiptScan(id);

  if (scan.isError) {
    return (
      <Shell>
        <ErrorBox message={scan.error instanceof Error ? scan.error.message : "Gagal memuat struk."} />
        <Link href="/receipts/new" className={`${primaryBtn} mt-4`}>
          <ScanLine className="size-5" /> Scan Ulang
        </Link>
      </Shell>
    );
  }
  if (!scan.data || scan.data.status === "PENDING" || scan.data.status === "PROCESSING") {
    return (
      <Shell>
        <Processing status={scan.data?.status ?? "PENDING"} image={scan.data?.imageUrl} />
      </Shell>
    );
  }
  if (scan.data.status === "FAILED") {
    // The server accepts a manual confirm of a failed scan: the photo is kept, the user types the lines.
    return (
      <Shell>
        <ErrorBox message={`${(scan.data.errorMessage ?? "Struk tidak terbaca").replace(/\.?$/, ".")} Isi item secara manual di bawah, atau scan ulang.`} />
        <ReviewFormLoader scan={scan.data} />
      </Shell>
    );
  }
  if (scan.data.status === "CONFIRMED") {
    return (
      <Shell>
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-12 text-income" />
          <p className="mt-3 text-lg font-bold">Struk ini sudah disimpan sebagai pengeluaran</p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/transactions" className={primaryBtn}>
              Lihat Transaksi
            </Link>
            <Link href="/receipts/new" className={ghostBtn}>
              <ScanLine className="size-4" /> Scan Struk Lain
            </Link>
          </div>
        </div>
      </Shell>
    );
  }
  return (
    <Shell>
      <ReviewFormLoader scan={scan.data} />
    </Shell>
  );
}

/** Selects need their options present on first render, or RHF can't preselect the matched ingredient. */
function ReviewFormLoader({ scan }: { scan: ReceiptScan }) {
  const ingredients = useIngredients();
  const categories = useCategories();
  if (ingredients.isError || categories.isError) return <ErrorBox onRetry={() => (ingredients.refetch(), categories.refetch())} />;
  if (!ingredients.data || !categories.data) return <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />;
  return <ReviewForm scan={scan} ingredients={ingredients.data} expenseCategories={categories.data.filter((c) => c.type === "EXPENSE")} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <nav aria-label="Breadcrumb" className="font-mono text-xs text-muted-foreground">
        <Link href="/receipts/new" className="rounded hover:text-foreground">
          ← Scan Struk
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Review Hasil</span>
      </nav>
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
        Review Struk
      </h1>
      {children}
    </main>
  );
}

const STEPS = [
  { key: "upload", label: "Foto diunggah" },
  { key: "read", label: "Membaca struk…" },
  { key: "match", label: "Mencocokkan dengan bahan baku" },
];

function Processing({ status, image }: { status: ReceiptScan["status"]; image?: string }) {
  const active = status === "PENDING" ? 1 : 2;
  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]" aria-busy="true">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- cookie-authenticated API image; the next/image optimizer can't forward the cookie
        <img src={image} alt="Foto struk yang sedang dibaca" className="max-h-80 w-full rounded-2xl border object-contain" />
      ) : (
        <div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      )}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <p role="status" className="text-lg font-bold">
          {status === "PENDING" ? "Menunggu antrean…" : "Membaca struk…"}
        </p>
        <ol className="mt-4 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              {i < active ? <CheckCircle2 className="size-5 text-income" /> : i === active ? <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" /> : <Circle className="size-5 text-muted-foreground" />}
              <span className={i > active ? "text-muted-foreground" : ""}>{s.label}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewForm({ scan, ingredients, expenseCategories }: { scan: ReceiptScan; ingredients: Ingredient[]; expenseCategories: Category[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [zoom, setZoom] = useState(false);

  const defaultCategory = expenseCategories.find((c) => /bahan/i.test(c.name))?.id ?? expenseCategories[0]?.id ?? "";
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      merchantName: scan.merchantName ?? "",
      transactionDate: scan.detectedDate?.slice(0, 10) ?? toISODate(new Date()),
      categoryId: "",
      updatePrices: true,
      items: scan.items.length
        ? scan.items.map((i) => ({ name: i.name, qty: String(Number(i.qty)), unit: i.unit, price: String(Number(i.price)), matchedIngredientId: i.matchedIngredient?.id ?? "" }))
        : [{ name: "", qty: "1", unit: "pcs", price: "", matchedIngredientId: "" }],
    },
  });
  const rows = useFieldArray({ control, name: "items" });

  const save = useMutation({
    // One DB transaction server-side: expense + receipt lines + ingredient prices + HPP recalc.
    mutationFn: (v: Values) => {
      const total = v.items.reduce((s, i) => s + toScaled(i.price, 2), 0n);
      return api(`/receipts/${scan.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          categoryId: v.categoryId || defaultCategory,
          transactionDate: v.transactionDate,
          description: v.merchantName ? `Belanja ${v.merchantName}` : "Belanja (scan struk)",
          amount: Number(centsToString(total)),
          items: v.items.map((i) => ({
            name: i.name,
            qty: Number(i.qty),
            unit: i.unit,
            price: Number(i.price),
            ingredientId: i.matchedIngredientId || null,
            updateIngredientPrice: v.updatePrices && !!i.matchedIngredientId,
          })),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionsKey });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ingredientsKey });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: subscriptionKey });
      queryClient.invalidateQueries({ queryKey: receiptKey(scan.id) });
      router.push("/transactions");
    },
    onError: (err) => setError("root", { message: err instanceof ApiError ? err.message : "Gagal menyimpan." }),
  });

  return (
    <form
      onSubmit={handleSubmit((v) => (v.categoryId || defaultCategory ? save.mutate(v) : setError("categoryId", { message: "Pilih kategori." })))}
      noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <aside className="space-y-3 lg:sticky lg:top-20">
        <button type="button" onClick={() => setZoom((z) => !z)} aria-expanded={zoom} className="block w-full rounded-2xl border bg-card p-2 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- cookie-authenticated API image */}
          <img src={scan.imageUrl} alt="Foto struk" className={`w-full rounded-xl object-contain transition-[max-height] motion-reduce:transition-none ${zoom ? "max-h-[80vh]" : "max-h-72"}`} />
          <span className="mt-2 block text-xs text-muted-foreground">{zoom ? "Ketuk untuk perkecil" : "Ketuk untuk perbesar"}</span>
        </button>
        <dl className="rounded-2xl border bg-card p-4 text-sm shadow-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total terdeteksi</dt>
            <dd className="tabular font-bold">{scan.detectedTotal ? formatIDR(scan.detectedTotal) : "—"}</dd>
          </div>
        </dl>
      </aside>

      <div className="space-y-5">
        <section className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:grid-cols-3">
          <label className="text-sm font-semibold sm:col-span-3">
            Nama toko
            <input className="mt-1 h-11 w-full rounded-md border bg-card px-3 font-normal dark:bg-card-inner" {...register("merchantName")} />
          </label>
          <label className="text-sm font-semibold">
            Tanggal
            <input type="date" className="mt-1 h-11 w-full rounded-md border bg-card px-3 font-normal dark:bg-card-inner" {...register("transactionDate")} />
            {errors.transactionDate && <span className="block text-sm font-normal text-expense">{errors.transactionDate.message}</span>}
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Kategori pengeluaran
            <select className="mt-1 h-11 w-full rounded-md border bg-card px-3 font-normal dark:bg-card-inner" {...register("categoryId")}>
              <option value="">{defaultCategory ? `Otomatis: ${expenseCategories.find((c) => c.id === defaultCategory)?.name}` : "Pilih kategori…"}</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <span className="block text-sm font-normal text-expense">{errors.categoryId.message}</span>}
          </label>
        </section>

        <section aria-labelledby="items-title" className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 p-5">
            <div>
              <h2 id="items-title" className="text-lg font-bold">Item Terbaca</h2>
              <p className="text-sm text-muted-foreground">Periksa nama, jumlah, dan harga. Hubungkan ke bahan baku agar harganya ikut ter-update.</p>
            </div>
            <button type="button" onClick={() => rows.append({ name: "", qty: "1", unit: "pcs", price: "", matchedIngredientId: "" })} className={`${ghostBtn} h-10 shrink-0`}>
              <Plus className="size-4" /> Item
            </button>
          </div>
          <ul className="divide-y border-t">
            {rows.fields.map((field, index) => (
              <ItemRow key={field.id} index={index} control={control} register={register} ingredients={ingredients} errors={errors.items?.[index]} onRemove={() => rows.remove(index)} />
            ))}
          </ul>
          <Totals control={control} detected={scan.detectedTotal} />
        </section>

        <label className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-primary" {...register("updatePrices")} />
          <span>
            <b className="block">Update harga bahan baku</b>
            <span className="text-muted-foreground">Item yang terhubung akan memperbarui harga beli bahan, dan HPP resep yang memakainya dihitung ulang.</span>
          </span>
        </label>

        <FormError message={errors.root?.message ?? errors.items?.root?.message ?? errors.items?.message} />
        <button type="submit" disabled={save.isPending} className={`${primaryBtn} h-12 w-full text-base`}>
          {save.isPending ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : <CheckCircle2 className="size-5" />}
          {save.isPending ? "Menyimpan…" : "Simpan Pengeluaran"}
        </button>
      </div>
    </form>
  );
}

function ItemRow({ index, control, register, ingredients, errors, onRemove }: {
  index: number;
  control: Control<Values>;
  register: ReturnType<typeof useForm<Values>>["register"];
  ingredients: Ingredient[];
  errors?: { name?: { message?: string }; qty?: { message?: string }; unit?: { message?: string }; price?: { message?: string } };
  onRemove: () => void;
}) {
  const row = useWatch({ control, name: `items.${index}` });
  const matched = ingredients.find((i) => i.id === row?.matchedIngredientId);
  const input = "h-10 w-full min-w-0 rounded-md border bg-card px-2.5 text-sm dark:bg-card-inner aria-invalid:border-expense";
  return (
    <li className="space-y-2 px-5 py-4">
      {/* Mobile: name on its own row, qty/unit/price below. sm+: one row. */}
      <div className="grid grid-cols-[4rem_4.5rem_minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_4rem_4.5rem_7.5rem_auto]">
        <label className="col-span-4 sm:col-span-1">
          <span className="sr-only">Nama item {index + 1}</span>
          <input aria-invalid={errors?.name ? true : undefined} className={`${input} font-semibold`} {...register(`items.${index}.name`)} />
        </label>
        <label>
          <span className="sr-only">Jumlah item {index + 1}</span>
          <input inputMode="decimal" aria-invalid={errors?.qty ? true : undefined} className={`${input} tabular text-center`} {...register(`items.${index}.qty`)} />
        </label>
        <label>
          <span className="sr-only">Satuan item {index + 1}</span>
          <input aria-invalid={errors?.unit ? true : undefined} placeholder="kg" className={`${input} text-center`} {...register(`items.${index}.unit`)} />
        </label>
        <label className="relative">
          <span className="sr-only">Harga total item {index + 1}</span>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-mono text-xs text-muted-foreground">Rp</span>
          <input inputMode="decimal" aria-invalid={errors?.price ? true : undefined} className={`${input} tabular pl-8 text-right font-bold`} {...register(`items.${index}.price`)} />
        </label>
        <button type="button" onClick={onRemove} aria-label={`Hapus item ${index + 1}`} className={`${iconBtn} hover:text-expense`}>
          <Trash2 className="size-4" />
        </button>
      </div>
      {(errors?.name || errors?.qty || errors?.unit || errors?.price) && <p className="text-sm text-expense">{errors.name?.message ?? errors.qty?.message ?? errors.unit?.message ?? errors.price?.message}</p>}
      <label className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${matched ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground dark:bg-card-inner"}`}>
          <Link2 className="size-3.5" /> {matched ? `Terhubung: ${matched.name}` : "Tidak terhubung"}
        </span>
        <span className="sr-only">Hubungkan item {index + 1} ke bahan baku</span>
        <select className="h-8 min-w-0 max-w-full rounded-md border bg-card px-2 dark:bg-card-inner" {...register(`items.${index}.matchedIngredientId`)}>
          <option value="">— bukan bahan baku —</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        {matched &&
          (row?.unit?.trim().toLowerCase() === matched.purchaseUnit && /^\d+(\.\d+)?$/.test(row.price) && /^\d+(\.\d+)?$/.test(row.qty) && Number(row.qty) > 0 ? (
            <span className="text-muted-foreground">
              Harga beli baru {formatIDR(centsToString(newPurchasePriceCents(row.price, row.qty, matched)))} (sebelumnya {formatIDR(matched.purchasePrice)})
            </span>
          ) : (
            <span className="text-muted-foreground">Harga beli dikonversi dari satuan struk saat disimpan</span>
          ))}
      </label>
    </li>
  );
}

function Totals({ control, detected }: { control: Control<Values>; detected: string | null }) {
  const items = useWatch({ control, name: "items" }) ?? [];
  const total = items.reduce((s, i) => s + toScaled(i?.price ?? "", 2), 0n);
  const mismatch = detected !== null && total !== toScaled(detected, 2);
  return (
    <div className="flex items-center justify-between gap-3 border-t p-5" aria-live="polite">
      <div>
        <p className="font-bold">Total Pengeluaran</p>
        {mismatch && (
          <p className="flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="size-3.5" /> Beda dengan total terdeteksi ({formatIDR(detected!)}). Cek lagi item-nya.
          </p>
        )}
      </div>
      <p className="tabular text-2xl font-bold text-expense">−{formatIDR(centsToString(total))}</p>
    </div>
  );
}
