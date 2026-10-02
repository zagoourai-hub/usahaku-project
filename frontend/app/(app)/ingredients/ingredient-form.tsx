"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { ALLOWED_USAGE, ingredientsKey, PURCHASE_UNITS, type Ingredient } from "@/lib/ingredients";
import { Field, FormError, SelectField, SubmitButton } from "@/app/_components/fields";

const money = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Isi angka, maksimal 2 desimal.");
const qty = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Isi angka, maksimal 3 desimal.")
  .refine((v) => Number(v) > 0, "Harus lebih dari 0.");

// Mirrors CreateIngredientDto (backend/src/ingredient/ingredient.module.ts).
const schema = z
  .object({
    name: z.string().trim().min(1, "Nama bahan wajib diisi.").max(150),
    purchaseUnit: z.enum(PURCHASE_UNITS),
    purchaseQty: qty,
    usageUnit: z.enum(["gram", "ml", "pcs"]),
    purchasePrice: money,
  })
  .refine((v) => ALLOWED_USAGE[v.purchaseUnit].includes(v.usageUnit), { path: ["usageUnit"], message: "Satuan pakai tidak cocok dengan satuan beli." });
type Values = z.infer<typeof schema>;

export const unitLabel = { kg: "kg", liter: "liter", pack: "pack", pcs: "pcs" } as const;

/** Price per gram/ml is often fractional (Rp 18,5/gram); keep up to 2 decimals. */
export function formatPerUnit(value: string) {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value))}`;
}

export function IngredientForm({ initial, onDone }: { initial: Ingredient | null; onDone: () => void }) {
  const queryClient = useQueryClient();
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
      ? { name: initial.name, purchaseUnit: initial.purchaseUnit, purchaseQty: String(Number(initial.purchaseQty)), usageUnit: initial.usageUnit, purchasePrice: String(Number(initial.purchasePrice)) }
      : { name: "", purchaseUnit: "kg", purchaseQty: "1", usageUnit: "gram", purchasePrice: "" },
  });

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = JSON.stringify({ ...v, purchaseQty: Number(v.purchaseQty), purchasePrice: Number(v.purchasePrice) });
      return initial ? api(`/ingredients/${initial.id}`, { method: "PATCH", body }) : api("/ingredients", { method: "POST", body });
    },
    onSuccess: () => {
      // Price changes also recalc recipe HPP server-side.
      queryClient.invalidateQueries({ queryKey: ingredientsKey });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      onDone();
    },
    onError: (err) => setError("root", { message: err instanceof ApiError ? err.message : "Gagal menyimpan bahan." }),
  });

  const [purchaseUnit, usageUnit, purchaseQty, purchasePrice] = useWatch({ control, name: ["purchaseUnit", "usageUnit", "purchaseQty", "purchasePrice"] });
  const factor = purchaseUnit === "kg" || purchaseUnit === "liter" ? 1000 : 1;
  const perUnit = Number(purchasePrice) / (Number(purchaseQty) * factor);

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
      <Field label="Nama Bahan" placeholder="Contoh: Susu UHT Full Cream" error={errors.name?.message} {...register("name")} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Satuan Beli"
          error={errors.purchaseUnit?.message}
          {...register("purchaseUnit", {
            onChange: (e: { target: { value: keyof typeof ALLOWED_USAGE } }) => {
              const allowed = ALLOWED_USAGE[e.target.value];
              if (!allowed.includes(usageUnit)) setValue("usageUnit", allowed[0]!);
            },
          })}
        >
          {PURCHASE_UNITS.map((u) => (
            <option key={u} value={u}>
              {unitLabel[u]}
            </option>
          ))}
        </SelectField>
        <Field
          label={purchaseUnit === "pack" ? `Isi per pack (${usageUnit})` : `Jumlah (${unitLabel[purchaseUnit]})`}
          type="text"
          inputMode="decimal"
          error={errors.purchaseQty?.message}
          {...register("purchaseQty")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Harga Beli" leading="Rp" type="text" inputMode="decimal" placeholder="18000" error={errors.purchasePrice?.message} {...register("purchasePrice")} />
        <SelectField label="Satuan Pakai di Resep" error={errors.usageUnit?.message} {...register("usageUnit")}>
          {ALLOWED_USAGE[purchaseUnit].map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </SelectField>
      </div>
      <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground" aria-live="polite">
        {Number.isFinite(perUnit) && perUnit > 0 ? (
          <>
            ≈ <b className="tabular">{formatPerUnit(String(perUnit))}</b> per {usageUnit}. Resep yang pakai bahan ini ikut dihitung ulang saat harga berubah.
          </>
        ) : (
          "Isi jumlah & harga untuk melihat harga per satuan pakai."
        )}
      </p>
      <FormError message={errors.root?.message} />
      <SubmitButton pending={save.isPending}>
        {save.isPending && <Loader2 className="size-5 animate-spin motion-reduce:animate-none" />}
        {save.isPending ? "Menyimpan…" : "Simpan Bahan"}
      </SubmitButton>
    </form>
  );
}
