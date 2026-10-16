"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Field, FormError, SubmitButton } from "@/app/_components/fields";
import { Turnstile, TURNSTILE_SITE_KEY } from "@/app/_components/turnstile";

const schema = z.object({ email: z.email("Email tidak valid. Pastikan ada '@' dan domain yang benar.") });

export function ForgotForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
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
      await api("/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify(values),
        headers: captcha ? { "x-captcha-response": captcha } : {},
      });
      setSentTo(values.email);
    } catch (err) {
      // Turnstile tokens are single-use: ask for a fresh one before retrying.
      setCaptcha(null);
      setCaptchaReset((n) => n + 1);
      const message =
        err instanceof ApiError && err.status === 403
          ? "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi."
          : err instanceof ApiError && err.status === 429
            ? "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi."
            : err instanceof ApiError
              ? err.message
              : "Terjadi kesalahan. Coba lagi sebentar.";
      setError("root", { message });
    }
  });

  if (sentTo) {
    return (
      <div role="status" className="space-y-3 rounded-xl border bg-card p-5">
        <p className="flex items-center gap-2 font-bold text-primary">
          <CheckCircle2 aria-hidden className="size-5" /> Cek email kamu
        </p>
        <p>
          Kalau <b>{sentTo}</b> terdaftar, kami sudah mengirim tautan untuk mengatur ulang kata sandi. Tautan berlaku 1 jam.
        </p>
        <p className="text-sm text-muted-foreground">Belum masuk? Cek folder spam, atau coba lagi beberapa menit lagi.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <p className="text-muted-foreground">Masukkan email akunmu. Kami kirim tautan untuk membuat kata sandi baru.</p>
      <Field label="Email" type="email" autoComplete="email" inputMode="email" placeholder="nama@usahamu.com" error={errors.email?.message} {...register("email")} />
      <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
      <FormError message={errors.root?.message} />
      <SubmitButton pending={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : null}
        {isSubmitting ? "Mengirim…" : "Kirim Tautan"}
      </SubmitButton>
    </form>
  );
}
