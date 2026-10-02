import type { Metadata } from "next";
import { Coffee, TrendingUp } from "lucide-react";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Masuk ke Akunmu"
      switchText="Belum punya akun?"
      switchHref="/register"
      switchLabel="Daftar gratis"
      badge="Solusi Finansial UMKM Kuliner"
      headline="Kelola Untung Rugi Usaha Kulinermu, Lebih Mudah"
      desc="Pantau margin resep harian dan cashflow tanpa ribet akuntansi."
      chip="Rp 485.000 / hari · Margin Sehat 67%"
      quote="Dulu omzet belasan juta tapi uang kas ludes terus. Pakai UsahaKu baru sadar resep kopi susu kita kemurahan."
      preview={
        <div aria-hidden className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold">Laba Bersih Hari Ini</span>
            <span className="flex items-center gap-1 rounded-full bg-[#14532d]/60 px-2.5 py-1 font-mono text-xs text-[#86efac]">
              <TrendingUp className="size-3.5" /> +18,4%
            </span>
          </div>
          <p className="tabular mt-3 text-4xl font-bold">Rp 485.000</p>
          <div className="mt-4 flex justify-between font-mono text-sm">
            <span>Target Rp 600.000</span>
            <span>81%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20">
            <div className="h-full w-[81%] rounded-full bg-[#99f6e4]" />
          </div>
          <div className="mt-5 rounded-xl bg-black/15 p-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="flex items-center gap-2 font-semibold"><Coffee className="size-5" /> Es Kopi Susu Aren</span>
              <span className="rounded-full bg-[#14532d]/60 px-2.5 py-1 font-mono text-xs text-[#86efac]">Margin 67%</span>
            </div>
            <div className="mt-3 flex justify-between font-mono text-sm">
              <span>HPP <span className="tabular block text-base font-bold">Rp 5.950</span></span>
              <span className="text-right">Harga Jual <span className="tabular block text-base font-bold">Rp 18.000</span></span>
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
