"use client";

import { useMutation } from "@tanstack/react-query";
import { MailWarning } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useBusiness } from "@/lib/business";

/** Shown while the account's email is unconfirmed: scan struk and AI price tips stay locked. */
export function VerifyEmailBanner() {
  const { data } = useBusiness();
  const resend = useMutation({
    mutationFn: (email: string) => api("/auth/send-verification-email", { method: "POST", body: JSON.stringify({ email }) }),
  });
  if (!data || data.user.emailVerified) return null;

  const error = resend.error instanceof ApiError && resend.error.status === 429 ? "Terlalu sering, tunggu sebentar lalu coba lagi." : resend.isError ? "Gagal mengirim, coba lagi sebentar." : null;
  return (
    <div role="status" className="border-b border-warning/30 bg-warning-soft px-4 py-3 text-sm md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <MailWarning aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
          <span>
            Konfirmasi email <b>{data.user.email}</b> untuk memakai scan struk dan saran harga AI. Cek kotak masuk atau folder spam.
          </span>
        </p>
        <div className="flex items-center gap-3">
          {resend.isSuccess ? (
            <span className="font-semibold text-primary">Email terkirim ulang</span>
          ) : (
            <button type="button" disabled={resend.isPending} onClick={() => resend.mutate(data.user.email)} className="shrink-0 whitespace-nowrap rounded-lg border bg-card px-3 py-2 font-semibold hover:bg-muted disabled:opacity-60">
              {resend.isPending ? "Mengirim…" : "Kirim ulang email"}
            </button>
          )}
          {error && <span className="text-expense">{error}</span>}
        </div>
      </div>
    </div>
  );
}
