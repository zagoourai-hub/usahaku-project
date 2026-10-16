"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { FormError, PasswordField, SubmitButton } from "@/app/_components/fields";

// Same bounds as the backend (emailAndPassword min/maxPasswordLength).
const schema = z
  .object({
    password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128, "Kata sandi maksimal 128 karakter."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Kata sandi tidak sama." });

const linkClass = "rounded font-semibold text-primary underline-offset-4 hover:underline";

export function ResetForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  if (!token) {
    return (
      <p role="alert" className="rounded-xl border border-expense/30 bg-expense-soft p-4 text-expense">
        Tautan tidak lengkap. <Link href="/forgot-password" className={linkClass}>Minta tautan baru</Link>.
      </p>
    );
  }

  if (done) {
    return (
      <div role="status" className="space-y-3 rounded-xl border bg-card p-5">
        <p className="flex items-center gap-2 font-bold text-primary">
          <CheckCircle2 aria-hidden className="size-5" /> Kata sandi sudah diganti
        </p>
        <p>
          Silakan <Link href="/login" className={linkClass}>masuk dengan kata sandi baru</Link>.
        </p>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ newPassword: values.password, token }) });
      setDone(true);
    } catch (err) {
      setError("root", {
        message:
          err instanceof ApiError && err.status === 400
            ? "Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru."
            : err instanceof ApiError && err.status === 429
              ? "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
              : "Terjadi kesalahan. Coba lagi sebentar.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <PasswordField label="Kata Sandi Baru" autoComplete="new-password" hint="Minimal 8 karakter (kombinasi huruf & angka disarankan)" error={errors.password?.message} {...register("password")} />
      <PasswordField label="Ulangi Kata Sandi" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
      <FormError message={errors.root?.message} />
      {errors.root && (
        <p className="text-sm">
          <Link href="/forgot-password" className={linkClass}>Minta tautan baru</Link>
        </p>
      )}
      <SubmitButton pending={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : null}
        {isSubmitting ? "Menyimpan…" : "Simpan Kata Sandi"}
      </SubmitButton>
    </form>
  );
}
