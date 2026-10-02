import type { Metadata } from "next";
import { TrendingUp, UtensilsCrossed } from "lucide-react";
import { AuthShell } from "../auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Daftar Gratis" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Buat Akun Gratis"
      switchText="Sudah punya akun?"
      switchHref="/login"
      switchLabel="Masuk di sini"
      badge="Kalkulator HPP Kuliner & F&B"
      headline="Bangun Kebiasaan Sehat Keuangan Usahamu"
      desc="Mulai dari resep pertama. Tahu persis modal satu porsi, margin aman, dan uang kas harian tidak tekor."
      chip="Gratis selamanya untuk fitur dasar"
      quote="Cukup 5 menit input resep, langsung kelihatan harga jual yang masuk akal dan untung nyata."
      preview={
        <div aria-hidden className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <span className="flex items-center gap-2 font-semibold"><UtensilsCrossed className="size-5" /> Kalkulator HPP Otomatis</span>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-mono text-xs">● Live</span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-lg font-semibold">Es Kopi Susu Aren (14oz)</span>
            <span className="font-mono text-sm text-[#99f6e4]">Porsi 1 cup</span>
          </div>
          <p className="tabular mt-1 text-sm text-[#ccfbf1]/70">Espresso Rp 3.200 · Susu Rp 1.800 · Gula Aren Rp 950 · Cup Rp 500</p>
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-black/15 p-4">
            <div>
              <span className="text-xs text-[#ccfbf1]/80">Total HPP/Porsi</span>
              <span className="tabular block text-2xl font-bold">Rp 6.450</span>
            </div>
            <div>
              <span className="text-xs text-[#ccfbf1]/80">Harga Jual</span>
              <span className="tabular block text-2xl font-bold text-[#99f6e4]">Rp 18.000</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between font-mono text-sm">
            <span>Margin Kotor</span>
            <span className="flex items-center gap-1 rounded-full bg-[#14532d]/60 px-2.5 py-1 text-xs text-[#86efac]"><TrendingUp className="size-3.5" /> Margin Sehat 64%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20">
            <div className="h-full w-[64%] rounded-full bg-[#99f6e4]" />
          </div>
        </div>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
