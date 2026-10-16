"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Field, FormError, PasswordField, SubmitButton } from "@/app/_components/fields";
import { Turnstile, TURNSTILE_SITE_KEY } from "@/app/_components/turnstile";

// Mirrors backend RegisterDto (backend/src/auth/auth.dto.ts).
const schema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(100, "Nama maksimal 100 karakter."),
  businessName: z.string().trim().min(2, "Nama usaha minimal 2 karakter.").max(100, "Nama usaha maksimal 100 karakter."),
  email: z.email("Email tidak valid. Pastikan ada '@' dan domain yang benar."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128, "Kata sandi maksimal 128 karakter."),
});

export function RegisterForm() {
  const router = useRouter();
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    if (TURNSTILE_SITE_KEY && !captcha) {
      setError("root", { message: "Selesaikan verifikasi keamanan di atas dulu." });
      return;
    }
    try {
      await api("/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify(values),
        headers: captcha ? { "x-captcha-response": captcha } : {},
      });
      router.replace("/onboarding");
    } catch (err) {
      // Turnstile tokens are single-use: ask for a fresh one before retrying.
      setCaptcha(null);
      setCaptchaReset((n) => n + 1);
      if (err instanceof ApiError && err.status === 422) {
        setError("email", { message: "Email ini sudah terdaftar. Silakan masuk." });
        return;
      }
      const message =
        err instanceof ApiError && err.status === 403
          ? "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi."
          : err instanceof ApiError && err.status === 429
            ? "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti."
            : err instanceof ApiError
              ? err.message
              : "Terjadi kesalahan. Coba lagi sebentar.";
      setError("root", { message });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label="Nama Kamu" autoComplete="name" placeholder="Contoh: Budi Santoso" error={errors.name?.message} {...register("name")} />
      <Field label="Nama Usaha" autoComplete="organization" placeholder="Contoh: Kopi Ruang Tenang, Warung Sedap" error={errors.businessName?.message} {...register("businessName")} />
      <Field label="Email" type="email" autoComplete="email" inputMode="email" placeholder="nama@usahamu.com" error={errors.email?.message} {...register("email")} />
      <PasswordField
        label="Kata Sandi"
        autoComplete="new-password"
        placeholder="Buat kata sandi aman"
        hint="Minimal 8 karakter (kombinasi huruf & angka disarankan)"
        error={errors.password?.message}
        {...register("password")}
      />
      <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
      <FormError message={errors.root?.message} />
      <SubmitButton pending={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : null}
        {isSubmitting ? "Mendaftarkan…" : "Daftar Gratis"}
        {!isSubmitting && <ArrowRight className="size-5" />}
      </SubmitButton>
    </form>
  );
}
