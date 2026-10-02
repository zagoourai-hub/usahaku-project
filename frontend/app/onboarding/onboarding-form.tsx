"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowRight, ChefHat, Coffee, Loader2, Store, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { BUSINESS_TYPES, businessKey, useBusiness, type Business, type BusinessType } from "@/lib/business";
import { Field, FormError, SubmitButton } from "@/app/_components/fields";

// Mirrors UpdateBusinessDto (backend/src/business/business.module.ts).
const schema = z.object({
  name: z.string().trim().min(1, "Nama usaha wajib diisi.").max(100, "Nama usaha maksimal 100 karakter."),
  type: z.enum(BUSINESS_TYPES, "Pilih jenis usaha kamu."),
  city: z.string().trim().max(100, "Nama kota maksimal 100 karakter."),
  branchLabel: z.string().trim().max(60, "Label cabang maksimal 60 karakter."),
  dailyProfitTarget: z.union([z.literal(""), z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Isi angka, maksimal 2 desimal.")]),
});
type Values = z.infer<typeof schema>;

const TYPE_OPTIONS: Record<BusinessType, { label: string; desc: string; Icon: LucideIcon }> = {
  WARUNG: { label: "Warung Makan", desc: "Nasi, lauk, gorengan", Icon: UtensilsCrossed },
  KEDAI_MINUMAN: { label: "Kedai Minuman", desc: "Kopi, teh, jus", Icon: Coffee },
  KATERING: { label: "Katering", desc: "Pesanan & paket acara", Icon: ChefHat },
  LAINNYA: { label: "Lainnya", desc: "Kue, frozen food, dll", Icon: Store },
};

export function OnboardingForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const business = useBusiness();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // `values` refills the form once /business/me arrives.
    values: business.data && {
      name: business.data.name,
      type: business.data.type,
      city: business.data.city ?? "",
      branchLabel: business.data.branchLabel ?? "",
      dailyProfitTarget: business.data.dailyProfitTarget === null ? "" : String(Number(business.data.dailyProfitTarget)),
    },
  });

  const save = useMutation({
    mutationFn: ({ dailyProfitTarget, ...values }: Values) =>
      api<Business>("/business/me", {
        method: "PATCH",
        body: JSON.stringify({ ...values, dailyProfitTarget: dailyProfitTarget === "" ? null : Number(dailyProfitTarget) }), // "" clears branchLabel
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(businessKey, data);
      router.replace("/dashboard");
    },
    onError: (err) => setError("root", { message: err instanceof ApiError ? err.message : "Gagal menyimpan. Coba lagi." }),
  });

  if (business.isPending) {
    return <div aria-busy="true" aria-label="Memuat profil usaha" className="h-96 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />;
  }
  if (business.isError) {
    return <FormError message="Gagal memuat profil usaha. Muat ulang halaman ini." />;
  }

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
      <Field label="Nama Usaha" autoComplete="organization" error={errors.name?.message} {...register("name")} />

      <fieldset aria-describedby={errors.type ? "type-error" : undefined}>
        <legend className="mb-2 text-sm font-semibold">Jenis Usaha</legend>
        <div className="grid grid-cols-2 gap-3">
          {BUSINESS_TYPES.map((value) => {
            const { label, desc, Icon } = TYPE_OPTIONS[value];
            return (
              <label
                key={value}
                className="flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/60 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring dark:bg-card-inner"
              >
                <input type="radio" value={value} className="sr-only" {...register("type")} />
                <Icon className="size-6 text-primary" />
                <span className="font-semibold">{label}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </label>
            );
          })}
        </div>
        {errors.type && (
          <p id="type-error" className="mt-1.5 text-sm text-expense">
            {errors.type.message}
          </p>
        )}
      </fieldset>

      <Field label="Kota (opsional)" autoComplete="address-level2" placeholder="Contoh: Surabaya" error={errors.city?.message} {...register("city")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Label cabang (opsional)" placeholder="Contoh: Cabang Utama" error={errors.branchLabel?.message} {...register("branchLabel")} />
        <Field
          label="Target laba harian (opsional)"
          leading="Rp"
          inputMode="decimal"
          placeholder="500000"
          hint="Ditampilkan sebagai progres di Beranda."
          error={errors.dailyProfitTarget?.message}
          {...register("dailyProfitTarget")}
        />
      </div>

      <FormError message={errors.root?.message} />
      <SubmitButton pending={save.isPending}>
        {save.isPending ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : null}
        {save.isPending ? "Menyimpan…" : "Simpan & Mulai"}
        {!save.isPending && <ArrowRight className="size-5" />}
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/dashboard" className="rounded text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Lewati dulu, isi nanti
        </Link>
      </p>
    </form>
  );
}
