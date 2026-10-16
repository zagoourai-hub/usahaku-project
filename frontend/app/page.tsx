import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Camera,
  Check,
  ChartColumn,
  Coffee,
  ReceiptText,
  User,
  Wallet,
} from "lucide-react";
import { plans } from "@/lib/plans";
import { Logo } from "./_components/logo";
import { HppSimulator } from "./_components/hpp-simulator";
import { ThemeToggle } from "./_components/theme-toggle";

const btnPrimary = `inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover active:translate-y-px`;

const navLinks = [
  { href: "#fitur", label: "Fitur" },
  { href: "#simulasi", label: "Simulasi HPP" },
  { href: "#harga", label: "Harga" },
  { href: "#testimoni", label: "Testimoni" },
];

const features = [
  { Icon: ReceiptText, tone: "teal", title: "Kalkulator HPP Otomatis", text: "Hitung HPP per porsi dari bahan baku secara real-time. Tahu persis modal satu porsi dan rekomendasi harga jual ideal." },
  { Icon: Camera, tone: "amber", title: "Scan Struk Belanja", text: "Cukup foto struk belanja pasar atau supermarket. Sistem otomatis catat pengeluaran dan update harga bahan baku." },
  { Icon: Wallet, tone: "amber", title: "Pantau Kas Harian", text: "Catat pemasukan dan pengeluaran harian dalam hitungan detik. Pantau apakah tokomu hari ini untung atau tekor." },
  { Icon: ChartColumn, tone: "teal", title: "Laporan Laba Rugi", text: "Laporan otomatis tersusun rapi tanpa rumus Excel. Tinggal export PDF atau Excel kapan saja untuk evaluasi usaha." },
] as const;

const footerCols = [
  { title: "Produk", links: [{ href: "#fitur", label: "Fitur" }, { href: "#simulasi", label: "Simulasi HPP" }, { href: "#harga", label: "Harga" }] },
  { title: "Bantuan", links: [{ href: "mailto:halo@usahaku.id", label: "halo@usahaku.id" }] },
];

// Deterministic pseudo-random so server and client render identical markup.
const meteors = Array.from({ length: 24 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return {
    left: `${(r(1) * 110 - 5).toFixed(1)}%`,
    top: `${-Math.round(r(2) * 120) - 20}px`,
    delay: `${(0.1 + r(3) * 3.9).toFixed(2)}s`,
    duration: `${(2.5 + r(4) * 3).toFixed(2)}s`,
    angle: `${(14 + r(5) * 8 - 4).toFixed(1)}deg`,
  };
});

function Meteors() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {meteors.map((m, i) => (
        <span
          key={i}
          className="meteor"
          style={{ left: m.left, top: m.top, animationDelay: m.delay, animationDuration: m.duration, ["--angle" as string]: m.angle }}
        />
      ))}
    </div>
  );
}

function SectionHeading({ id, eyebrow, title, desc, center = false, pill = false }: { id: string; eyebrow: string; title: string; desc: string; center?: boolean; pill?: boolean }) {
  return (
    <div className={`mb-10 max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <span className={pill
        ? "mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary dark:bg-primary/15"
        : "mb-2 block font-mono text-xs font-bold text-primary"}>
        {eyebrow}
      </span>
      <h2 id={id} className="text-balance text-2xl font-bold tracking-tight md:text-4xl">{title}</h2>
      <p className="mt-3 leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-8">
          <Logo />
          <nav aria-label="Navigasi utama" className="hidden items-center gap-6 md:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className={`rounded text-[15px] text-muted-foreground transition-colors hover:text-foreground`}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link href="/login" className={`rounded px-2 py-1 text-[15px] text-muted-foreground transition-colors hover:text-foreground`}>
              Masuk
            </Link>
            <Link href="/register" className={`${btnPrimary} h-10 px-4 sm:h-11 sm:px-6`}>
              <span className="sm:hidden">Mulai</span>
              <span className="hidden sm:inline">Mulai Gratis</span>
            </Link>
            <span aria-hidden className="hidden size-8 items-center justify-center rounded-full border bg-muted lg:flex">
              <User className="size-[18px] text-muted-foreground" />
            </span>
          </div>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="hero-bg relative overflow-hidden py-8 md:py-16">
          <Meteors />
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.045]" style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="absolute -left-[100px] -top-[60px] h-[560px] w-[680px] -rotate-6 rounded-full opacity-60 dark:opacity-80" style={{ background: "radial-gradient(circle, rgb(15 118 110 / 0.15) 0%, rgb(245 158 11 / 0.08) 60%, transparent 100%)" }} />
            <div className="absolute left-[240px] top-[120px] size-[340px] rounded-full border border-primary/10" />
            <div className="absolute left-[200px] top-[80px] size-[420px] rounded-full border border-dashed border-warning/15 dark:border-warning/10" />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8">
            <div className="flex flex-col items-center justify-between gap-10 lg:flex-row lg:items-start lg:gap-16">
              <div className="flex w-full flex-col pt-2 lg:w-[55%] lg:pt-6">
                <h1 id="hero-title" className="max-w-xl text-balance text-3xl font-extrabold leading-[1.1] tracking-tight md:text-4xl">
                  Tahu untung rugi usaha kuliner kamu, <span className="text-primary">setiap hari.</span>
                </h1>
                <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-muted-foreground">
                  Bebas dari pusing hitung resep manual dan bon tercecer. Sekali catat, margin bersih dan modal per porsi langsung terhitung otomatis.
                </p>
                <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                  <Link href="/register" className={btnPrimary}>
                    Coba Gratis Sekarang <ArrowRight className="ml-2 size-[18px]" />
                  </Link>
                  <a href="#simulasi" className={`rounded py-2 text-center text-[15px] font-semibold transition-colors hover:text-primary`}>
                    Coba simulasi HPP <span aria-hidden>→</span>
                  </a>
                </div>
                <figure id="testimoni" className="mt-10 max-w-xl rounded-xl border bg-muted p-5 shadow-sm lg:mt-14 dark:bg-card">
                  <blockquote className="text-[15px] leading-normal text-foreground/80">
                    “Dulu omzet belasan juta tapi uang kas sering ludes tanpa tahu ke mana. Pas hitung pakai UsahaKu, baru sadar resep kopi susu kita kemurahan dan cup-nya bocor margin 2 ribu per cup.”
                  </blockquote>
                </figure>
              </div>

              {/* Dashboard preview (illustrative data) */}
              <div className="flex w-full justify-center lg:w-[45%] lg:justify-end">
                <div aria-label="Contoh tampilan dashboard UsahaKu" role="img" className="w-full max-w-md rounded-xl border bg-card p-6 shadow-[0_20px_40px_-15px_rgb(0_0_0/0.15)]">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-block size-2.5 rounded-full bg-income shadow-[0_0_8px_rgb(74_222_128/0.5)]" />
                      <span className="text-sm font-semibold">Kedai Kopi Ruang Tenang</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">Hari ini, 14:20</span>
                  </div>
                  <div className="mt-4 rounded-lg border bg-card-inner p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Laba Bersih Hari Ini</span>
                      <span className="flex items-center gap-1 rounded-full border border-income/30 bg-income-soft px-2 py-0.5 font-mono text-xs font-bold text-income">
                        <ArrowUp className="size-3.5" /> +18,4%
                      </span>
                    </div>
                    <p className="tabular mt-2 text-[26px] font-bold tracking-tight text-primary md:text-[32px]">Rp 485.000</p>
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between font-mono text-xs font-semibold">
                        <span className="text-muted-foreground">Target Harian: Rp 600.000</span>
                        <span>81%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-track">
                        <div className="h-full w-[81%] rounded-full bg-primary" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-card-inner p-3.5">
                      <span className="block text-sm text-muted-foreground">Omzet Masuk</span>
                      <span className="tabular mt-1 block font-bold">Rp 850.000</span>
                      <span className="mt-1 inline-block font-mono text-xs font-semibold text-income">+12% vs kemarin</span>
                    </div>
                    <div className="rounded-lg border bg-card-inner p-3.5">
                      <span className="block text-sm text-muted-foreground">Modal Belanja HPP</span>
                      <span className="tabular mt-1 block font-bold">Rp 365.000</span>
                      <span className="mt-1 inline-block font-mono text-xs text-muted-foreground">42 pesanan terlayani</span>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border bg-card-inner p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded border border-accent/30 bg-secondary text-secondary-foreground">
                          <Coffee className="size-4" />
                        </span>
                        <div>
                          <span className="block text-sm font-bold">Es Kopi Susu Aren</span>
                          <span className="block text-xs text-muted-foreground">1 Porsi (Cup 14oz)</span>
                        </div>
                      </div>
                      <span className="rounded-full border border-income/30 bg-income-soft px-2 py-0.5 font-mono text-xs font-bold text-income">Margin 67%</span>
                    </div>
                    <div className="flex items-center justify-between rounded border bg-card p-2.5 text-sm">
                      <div>
                        <span className="block text-xs text-muted-foreground">HPP / Porsi</span>
                        <span className="tabular font-semibold">Rp 5.950</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs text-muted-foreground">Harga Jual</span>
                        <span className="tabular font-bold text-primary">Rp 18.000</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Fitur */}
        <section id="fitur" aria-labelledby="fitur-title" className="border-t py-10 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <SectionHeading id="fitur-title" eyebrow="Fitur Utama" title="Semua yang Kamu Butuh untuk Tahu Untung Rugi" desc="Sederhana, praktis, dan dirancang khusus agar pemilik usaha kuliner tidak perlu pusing akuntansi." />
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              {features.map(({ Icon, tone, title, text }) => (
                <li key={title} className="rounded-2xl border bg-card p-6 shadow-sm">
                  <span className={`mb-5 flex size-12 items-center justify-center rounded-xl ${tone === "teal" ? "bg-primary/10 text-primary dark:bg-primary/15" : "bg-secondary text-secondary-foreground"}`}>
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mb-2 text-xl font-bold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Simulasi HPP */}
        <section id="simulasi" aria-labelledby="simulasi-title" className="border-y bg-muted py-10 md:py-20 dark:bg-[#181615] md:dark:bg-[#292524]">
          <div className="mx-auto max-w-5xl px-4 md:px-8">
            <SectionHeading id="simulasi-title" center eyebrow="Coba Sekarang" title="Hitung HPP Menu Kamu dalam 10 Detik" desc="Coba langsung kalkulator resep di bawah ini tanpa perlu daftar atau login." />
            <HppSimulator />
          </div>
        </section>

        {/* Harga */}
        <section id="harga" aria-labelledby="harga-title" className="relative overflow-hidden py-10 md:py-24">
          <Meteors />
          <div className="relative z-10 mx-auto max-w-5xl px-4 md:px-8">
            <SectionHeading id="harga-title" center pill eyebrow="Harga" title="Mulai Gratis, Upgrade Kalau Sudah Siap" desc="Tanpa kontrak, bisa berhenti kapan saja sesuai kebutuhan usaha kamu." />
            <ul className="mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-6 md:grid-cols-2">
              {plans.map((p) => (
                <li key={p.name} className={`relative flex flex-col justify-between rounded-2xl bg-card p-6 md:p-8 ${p.featured ? "border-2 border-primary shadow-md" : "border shadow-sm"}`}>
                  {p.featured && (
                    <span className="absolute -top-3.5 right-6 rounded-full border border-accent/30 bg-secondary px-3 py-1 font-mono text-xs font-bold text-secondary-foreground">
                      Paling Populer
                    </span>
                  )}
                  <div>
                    <h3 className={`text-xl font-bold ${p.featured ? "text-primary" : ""}`}>{p.name}</h3>
                    <p className="mb-2 mt-4">
                      <span className={`tabular text-3xl font-bold tracking-tight md:text-4xl ${p.featured ? "text-primary" : ""}`}>{p.price}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{p.period}</span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                    <hr className="my-6" />
                    <ul className="space-y-3.5">
                      {p.items.map((item, i) => (
                        <li key={item} className={`flex items-center gap-3 text-sm ${p.featured && i === 0 ? "font-semibold" : ""}`}>
                          <Check className="size-5 shrink-0 text-primary" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    href="/register"
                   
                    className={p.featured
                      ? `${btnPrimary} mt-8 w-full text-sm`
                      : `mt-8 inline-flex h-11 w-full items-center justify-center rounded-lg border text-sm font-semibold transition-colors hover:bg-muted dark:hover:bg-card-inner`}
                  >
                    {p.cta}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-10 text-center text-sm text-muted-foreground">
              Butuh paket khusus untuk banyak cabang?{" "}
              <a href="mailto:halo@usahaku.id" className={`rounded underline-offset-4 transition-colors hover:text-primary hover:underline`}>
                Hubungi kami →
              </a>
            </p>
          </div>
        </section>

        {/* CTA */}
        <section aria-labelledby="cta-title" className="bg-[#0f766e] px-5 py-12 text-center text-white md:py-20 [&_:focus-visible]:outline-white">
          <div className="mx-auto max-w-4xl">
            <h2 id="cta-title" className="text-balance text-2xl font-extrabold tracking-tight md:text-4xl">Siap Tahu Untung Rugi Usaha Kamu Hari Ini?</h2>
            <p className="mx-auto mt-3 max-w-xl leading-relaxed text-[#f0fdfa]/90">Gratis selamanya untuk fitur dasar. Tanpa kartu kredit.</p>
            <div className="mt-8 flex flex-col items-center">
              <Link href="/register" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-8 font-semibold text-[#0f766e] shadow-sm transition-colors hover:bg-[#f0fdfa] sm:w-auto">
                Mulai Gratis Sekarang →
              </Link>
              <a href="#simulasi" className="mt-4 rounded text-sm text-[#f0fdfa] underline hover:text-white">
                atau coba simulasi HPP dulu
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#2e2a27] bg-[#1c1917] text-[#f5f5f4]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-12 md:grid-cols-4 md:py-16">
          <div className="space-y-4 md:col-span-2">
            <Logo onDark />
            <p className="max-w-xs text-sm leading-relaxed text-[#a8a29e]">Aplikasi hitung HPP &amp; catat kas untuk UMKM kuliner Indonesia.</p>
          </div>
          {footerCols.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-4 text-xs font-bold">{col.title}</h2>
              <ul className="flex flex-col space-y-2.5 text-sm text-[#a8a29e]">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="rounded transition-colors hover:text-white">{l.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-[#2e2a27]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs text-[#a8a29e] md:flex-row">
            <p>© 2026 UsahaKu. Hak cipta dilindungi.</p>
            <p>🇮🇩 Indonesia · IDR (Rp)</p>
          </div>
        </div>
      </footer>
    </>
  );
}
