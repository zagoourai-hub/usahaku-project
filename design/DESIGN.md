---
version: alpha
name: HPPKu
description: Design system HPPKu — SaaS hitung HPP & cashflow untuk UMKM F&B. Mobile-first, hangat, angka jelas. Token diturunkan dari tema shadcn/ui (format tweakcn).
colors:
  # Brand
  primary: "#0F766E"            # teal-700 — aksi utama, brand
  primary-foreground: "#F0FDFA"
  secondary: "#FEF3C7"          # amber-100 — surface sekunder hangat
  secondary-foreground: "#78350F"
  accent: "#F59E0B"             # amber-500 — highlight, badge PRO
  accent-foreground: "#1C1917"
  # Neutral
  background: "#FAFAF7"
  foreground: "#1C1917"
  card: "#FFFFFF"
  card-foreground: "#1C1917"
  muted: "#F5F5F0"
  muted-foreground: "#6B6B63"
  border: "#E7E5DF"
  input: "#E7E5DF"
  ring: "#14B8A6"
  # Semantic keuangan
  income: "#16A34A"             # pemasukan / laba
  income-soft: "#DCFCE7"
  expense: "#DC2626"            # pengeluaran / rugi
  expense-soft: "#FEE2E2"
  warning: "#D97706"            # margin tipis
  warning-soft: "#FEF3C7"
  destructive: "#DC2626"
  # Chart
  chart-1: "#0F766E"
  chart-2: "#F59E0B"
  chart-3: "#16A34A"
  chart-4: "#DC2626"
  chart-5: "#6366F1"
  # Dark mode
  dark-background: "#0C0A09"
  dark-foreground: "#F5F5F4"
  dark-card: "#1C1917"
  dark-muted: "#292524"
  dark-muted-foreground: "#A8A29E"
  dark-border: "#2E2A27"
  dark-primary: "#2DD4BF"
  dark-primary-foreground: "#042F2E"
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.02em
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.015em
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.3
  h3:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.0625rem
    fontWeight: 600
    lineHeight: 1.4
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.02em
  money-xl:
    fontFamily: Geist Mono
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "'tnum' 1"
  money-md:
    fontFamily: Geist Mono
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px 20px
    height: 44px
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    height: 44px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: 40px
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 0 14px
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: 16px
  stat-tile:
    backgroundColor: "{colors.card}"
    typography: "{typography.money-xl}"
    rounded: "{rounded.lg}"
    padding: 16px
  badge-income:
    backgroundColor: "{colors.income-soft}"
    textColor: "{colors.income}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  badge-expense:
    backgroundColor: "{colors.expense-soft}"
    textColor: "{colors.expense}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  badge-pro:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.full}"
    padding: 2px 10px
  bottom-nav:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted-foreground}"
    height: 64px
  fab-scan:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    size: 56px
---

## Overview

HPPKu adalah "buku kas pintar" untuk pemilik warung, kedai minuman, dan katering. Rasanya harus **hangat, tenang, dan bisa dipercaya** — seperti kalkulator yang rapi, bukan software akuntansi yang menakutkan. User utama membuka app di HP, di sela jam jualan, sering dengan satu tangan. Setiap layar menjawab satu pertanyaan: *"Untung atau rugi?"*, *"HPP menu ini berapa?"*, *"Uang hari ini ke mana?"*

Karakter visual: latar krem lembut, teal tegas sebagai brand, aksen amber hangat. Angka uang adalah hero di setiap layar — besar, monospace, tabular. Bahasa UI: Bahasa Indonesia santai ("Catat Pemasukan", "Foto Struk").

Target platform: **mobile web first (360–430px)**, lalu tablet dan desktop dengan sidebar.

## Colors

- **Primary (Teal #0F766E):** brand dan aksi utama — tombol simpan, FAB scan struk, tab aktif. Memberi kesan stabil dan "uang aman".
- **Accent (Amber #F59E0B):** penekanan hangat — badge PRO, highlight rekomendasi harga AI, ilustrasi. Jangan untuk tombol utama.
- **Secondary (Amber-100):** surface kartu info/tips dan chip filter terpilih.
- **Income (Hijau #16A34A) / Expense (Merah #DC2626):** hanya untuk semantik keuangan — nominal masuk/keluar, laba/rugi, delta. Selalu disertai ikon/tanda (+/−, panah) supaya tidak bergantung warna saja.
- **Warning (#D97706):** margin di bawah target, kuota tier hampir habis.
- **Neutral:** background krem `#FAFAF7`, card putih, border `#E7E5DF` tipis. Hindari abu dingin.
- **Dark mode:** latar stone gelap, primary naik ke teal-400 `#2DD4BF` untuk kontras.
- Semua pasangan teks/latar minimal kontras WCAG AA 4.5:1.

## Typography

- **Plus Jakarta Sans** untuk seluruh UI — font lokal Indonesia, ramah, sangat terbaca di layar kecil.
- **Geist Mono** dengan `tnum` khusus angka uang, HPP, persentase margin — digit sejajar sehingga kolom nominal mudah dibandingkan.
- Format uang: `Rp 12.500` (titik ribuan, tanpa desimal di UI kecuali HPP per porsi: `Rp 3.412,50`).
- Hierarki: `money-xl` untuk saldo/laba di dashboard, `h1` judul halaman, `h3` judul kartu, `body-md` konten, `label` untuk label form & tombol.
- Minimal ukuran teks 13px; judul maksimal 2 baris.

## Layout

- **Mobile:** 1 kolom, gutter 16px, bottom navigation 5 item: Beranda · Resep · (FAB Scan Struk di tengah) · Transaksi · Laporan. Header sticky 56px dengan nama usaha + avatar.
- **Tablet/Desktop (≥1024px):** sidebar kiri 248px, konten max-width 1200px, dashboard grid 12 kolom.
- Spasi berbasis 4px: jarak antar kartu 12px, padding kartu 16px, jarak antar section 24px.
- Target sentuh minimal 44×44px. Form panjang dipecah jadi step atau sheet dari bawah (bottom sheet).
- Daftar transaksi dikelompokkan per tanggal dengan sticky date header dan subtotal harian.

## Elevation & Depth

Datar dan ringan. Kedalaman dari border tipis + surface, bukan bayangan tebal.

- Level 0: background krem.
- Level 1 (card): putih + border 1px `{colors.border}`, tanpa shadow.
- Level 2 (sheet, dropdown, FAB): shadow lembut `0 4px 16px rgba(28,25,23,0.08)`.
- Level 3 (dialog/SweetAlert2): overlay `rgba(12,10,9,0.4)` + blur 4px.
- Dark mode: gunakan surface lebih terang, bukan shadow.

## Shapes

- Radius dasar 10px (`md`) untuk tombol & input; 14px (`lg`) untuk kartu; 20px (`xl`) untuk bottom sheet (sudut atas saja).
- Badge, chip, FAB, avatar: pill/lingkaran penuh.
- Ikon: Lucide, stroke 1.75, ukuran 20px (nav 24px).
- Ilustrasi kosong (empty state): flat, 2 warna (teal + amber), gaya sederhana bertema dapur/warung.

## Components

- **Stat tile (dashboard):** label kecil di atas, nominal `money-xl`, delta % vs periode sebelumnya dengan badge income/expense. Tiga tile: Pemasukan, Pengeluaran, Laba Bersih.
- **Recipe card:** nama menu, HPP per porsi (`money-md`), harga jual, bar margin (hijau ≥ target, amber < target, merah < 0).
- **HPP breakdown card:** list bahan (nama · takaran · biaya), overhead, garis pemisah, total HPP bold. Update live saat user mengetik.
- **Margin slider:** slider 0–80%, di bawahnya harga jual rekomendasi besar + tombol "Minta saran AI" (ikon sparkle, aksen amber).
- **Transaction row:** ikon kategori dalam lingkaran soft, deskripsi + kategori, nominal kanan dengan warna & tanda +/−, badge kecil "OCR" bila dari scan.
- **FAB Scan Struk:** tombol lingkaran 56px di tengah bottom nav, ikon kamera, membuka kamera langsung.
- **OCR review screen:** thumbnail struk di atas (bisa di-zoom), daftar item editable, item yang cocok dengan bahan baku diberi chip teal "Terhubung: Gula Pasir", total terdeteksi, checkbox "Update harga bahan baku", tombol "Simpan Pengeluaran".
- **Processing state:** skeleton + teks status ("Membaca struk…"), jangan spinner kosong.
- **Usage meter:** progress bar kecil di sidebar/profil: "OCR 7/10 bulan ini", amber saat ≥80%.
- **Upgrade modal:** SweetAlert2, ilustrasi, perbandingan singkat FREE vs PRO, CTA primary.
- **Toast:** Sonner, posisi atas-tengah di mobile, sukses pakai warna income.
- **Empty state:** ilustrasi + 1 kalimat + 1 CTA ("Belum ada resep. Yuk hitung HPP menu pertamamu").

### Daftar layar untuk Stitch
1. Login & Register
2. Onboarding profil usaha (3 langkah)
3. Dashboard (stat tiles, chart tren 30 hari, transaksi terakhir)
4. Master Bahan Baku (list + form sheet)
5. Daftar Resep
6. Detail/Form Resep (HPP breakdown + margin slider + saran AI + tren HPP)
7. Daftar Transaksi (filter tanggal & kategori)
8. Form Transaksi (bottom sheet: tab Masuk/Keluar)
9. Scan Struk → Processing → Review OCR
10. Laporan Laba-Rugi + Export
11. Pricing / Upgrade PRO
12. Pengaturan & Profil

## Do's and Don'ts

**Do**
- Jadikan angka uang elemen terbesar dan paling kontras di layar.
- Pakai warna income/expense hanya untuk makna keuangan, selalu dengan ikon/tanda.
- Tampilkan HPP dan margin secara live saat user mengedit resep.
- Gunakan Bahasa Indonesia sehari-hari, kalimat pendek.
- Sediakan empty state, loading skeleton, dan error state di setiap layar data.

**Don't**
- Jangan pakai istilah akuntansi berat (debit/kredit, jurnal) di UI.
- Jangan pakai amber untuk tombol aksi utama — itu jatah primary teal.
- Jangan tabel lebar yang perlu scroll horizontal di mobile; ubah jadi list kartu.
- Jangan bayangan tebal, gradien mencolok, atau glassmorphism.
- Jangan menaruh aksi penting di pojok atas yang susah dijangkau jempol.
