import type { ReactNode } from "react";
import { AuthShell } from "./auth-shell";

/** Shell for the account-recovery pages (forgot/reset password, verify email). */
export function RecoveryShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AuthShell
      title={title}
      switchText="Ingat kata sandinya?"
      switchHref="/login"
      switchLabel="Masuk di sini"
      badge="Solusi Finansial UMKM Kuliner"
      headline="Kelola Untung Rugi Usaha Kulinermu, Lebih Mudah"
      desc="Pantau margin resep harian dan cashflow tanpa ribet akuntansi."
      chip="Akunmu aman bersama UsahaKu"
      quote="Dulu omzet belasan juta tapi uang kas ludes terus. Pakai UsahaKu baru sadar resep kopi susu kita kemurahan."
      preview={null}
    >
      {children}
    </AuthShell>
  );
}
