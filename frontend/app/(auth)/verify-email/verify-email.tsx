"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { businessKey } from "@/lib/business";

const linkClass = "rounded font-semibold text-primary underline-offset-4 hover:underline";

export function VerifyEmail({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const verify = useMutation({
    mutationFn: () => api(`/auth/verify-email?token=${encodeURIComponent(token)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: businessKey }),
  });
  // React strict mode runs effects twice in dev: send the request once.
  const started = useRef(false);
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verify.mutate();
  }, [token, verify]);

  if (!token || verify.isError) {
    return (
      <p role="alert" className="rounded-xl border border-expense/30 bg-expense-soft p-4 text-expense">
        Tautan tidak valid atau sudah kedaluwarsa. Masuk ke akunmu lalu minta email konfirmasi baru dari pemberitahuan di bagian atas halaman.{" "}
        <Link href="/login" className={linkClass}>Masuk</Link>
      </p>
    );
  }
  if (verify.isSuccess) {
    return (
      <div role="status" className="space-y-3 rounded-xl border bg-card p-5">
        <p className="flex items-center gap-2 font-bold text-primary">
          <CheckCircle2 aria-hidden className="size-5" /> Email sudah terkonfirmasi
        </p>
        <p>
          Sekarang scan struk dan saran harga AI bisa dipakai. <Link href="/dashboard" className={linkClass}>Ke Beranda</Link>
        </p>
      </div>
    );
  }
  return (
    <p role="status" className="flex items-center gap-2 text-muted-foreground">
      <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" /> Mengonfirmasi email…
    </p>
  );
}
