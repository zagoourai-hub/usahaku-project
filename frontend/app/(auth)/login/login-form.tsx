"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Field, FormError, PasswordField, SubmitButton } from "@/app/_components/fields";

const schema = z.object({
  email: z.email("Email tidak valid. Pastikan ada '@' dan domain yang benar."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export function LoginForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api("/auth/sign-in/email", { method: "POST", body: JSON.stringify(values) });
      router.replace("/dashboard");
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? "Email atau kata sandi salah."
          : err instanceof ApiError && err.status === 429
            ? "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
            : err instanceof ApiError
            ? err.message
            : "Terjadi kesalahan. Coba lagi sebentar.";
      setError("root", { message });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="nama@usahamu.com"
        error={errors.email?.message}
        trailing={<Mail aria-hidden className="mr-3 size-5 text-muted-foreground" />}
        {...register("email")}
      />
      <PasswordField label="Kata Sandi" autoComplete="current-password" placeholder="Kata sandi kamu" error={errors.password?.message} {...register("password")} />
      <p className="-mt-2 text-right text-sm">
        <Link href="/forgot-password" className="rounded font-semibold text-primary underline-offset-4 hover:underline">
          Lupa kata sandi?
        </Link>
      </p>
      <FormError message={errors.root?.message} />
      <SubmitButton pending={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : null}
        {isSubmitting ? "Memproses…" : "Masuk ke Dashboard"}
        {!isSubmitting && <ArrowRight className="size-5" />}
      </SubmitButton>
    </form>
  );
}
