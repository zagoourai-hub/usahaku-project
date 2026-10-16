import type { Tier } from "./subscription";

// Mirrors TIER_LIMITS in backend/src/subscription/subscription.module.ts; change both together.
export const plans = [
  {
    tier: "FREE" as Tier,
    name: "Gratis",
    price: "Rp 0",
    period: "/selamanya",
    desc: "Buat kamu yang baru mulai rapiin catatan usaha",
    items: ["Sampai 10 resep", "Sampai 200 bahan baku", "100 catatan kas/bulan", "10x Scan Struk/bulan", "5x Saran harga dari AI/bulan", "Laporan Laba Rugi (PDF)"],
    cta: "Mulai Gratis",
    featured: false,
  },
  {
    tier: "PRO" as Tier,
    name: "Pro",
    price: "Rp 49.000",
    period: "/bulan",
    desc: "Buat usaha yang mau auto-pilot soal keuangan",
    items: ["Semua fitur Gratis", "Resep dan catatan kas tanpa batas", "Sampai 1.000 bahan baku", "300x Scan Struk/bulan", "100x Saran harga dari AI/bulan", "Export laporan ke Excel"],
    cta: "Daftar lalu upgrade ke Pro",
    featured: true,
  },
];

export const limitRows: { label: string; free: string; pro: string }[] = [
  { label: "Jumlah resep", free: "10", pro: "Tanpa batas" },
  { label: "Jumlah bahan baku", free: "200", pro: "1.000" },
  { label: "Jumlah kategori kas", free: "30", pro: "100" },
  { label: "Catatan kas per bulan", free: "100", pro: "Tanpa batas" },
  { label: "Scan struk per bulan", free: "10", pro: "300" },
  { label: "Saran harga AI per bulan", free: "5", pro: "100" },
  { label: "Export laporan PDF", free: "Ya", pro: "Ya" },
  { label: "Export laporan Excel", free: "Tidak", pro: "Ya" },
];

export const UPGRADE_MAILTO = "mailto:halo@usahaku.id?subject=Upgrade%20ke%20UsahaKu%20Pro";
