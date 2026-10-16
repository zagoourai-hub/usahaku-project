# UsahaKu — Task Tracker

Sumber: `docs/PRD.md` · Desain: `design/` (Stitch export) · Last Updated: 2026-10-16

## Summary

| Phase | Total | Completed | In Progress | Blocked | Todo | Dropped |
|---|---|---|---|---|---|---|
| 0 Landing | 6 | 6 | 0 | 0 | 0 | 0 |
| 1 Fondasi, Auth & Costing | 46 | 43 | 0 | 0 | 0 | 3 |
| 2 Finance | 23 | 23 | 0 | 0 | 0 | 0 |
| 3 Reporting, Tier & Deploy | 21 | 19 | 0 | 0 | 2 | 0 |
| 4 Integrasi Backend | 9 | 9 | 0 | 0 | 0 | 0 |
| 5 Auth & Anti-Abuse | 9 | 7 | 0 | 0 | 2 | 0 |

## Arsitektur

```
usahaku/
├── frontend/   Next.js 16 App Router (app/), Tailwind v4, lucide-react
├── backend/    NestJS 12 ESM + Prisma 7 (@prisma/adapter-pg) + PostgreSQL
├── docker/     docker-compose.yml (postgres; backend+frontend via --profile app), backend/ & frontend/ Dockerfile
├── design/     referensi UI dari Stitch (DESIGN.md, globals.css, landing *.html/*.png)
└── docs/       PRD + tracker ini
```

- **Auth:** Better Auth, sesi di DB + cookie httpOnly (bukan localStorage) — profile `saas-web-no-ai`. Dipindah dari JWT custom 2026-10-16 (keputusan bigboss: library + plugin luas). PRD menyebut "attach JWT" di api-client → diganti `credentials: "include"`.
- **Data:** semua query di-scope `businessId` user; uang `Decimal(14,2)`, kuantitas `Decimal(12,3)`.
- **Validasi:** BE pakai `class-validator` DTO (profile), FE pakai Zod + RHF.
- **Frontend route:** `/` landing (publik) · `/login` `/register` `/onboarding` · app terproteksi via `proxy.ts`.
- **AI (disetujui bigboss 2026-09-26):** OCR struk & saran harga via OpenRouter (model `:free` saat development). Infra dev: Redis (BullMQ) + SeaweedFS (S3) di `docker/docker-compose.yml`.
- Tema: token `design/globals.css` → `frontend/app/globals.css`, dark mode via class `.dark` di `<html>`.

## Backend API (terintegrasi FE)

Base `http://localhost:4000`, cookie `usahaku.session_token` (FE fetch `credentials: "include"`). Uang/kuantitas di response = string Decimal.
`POST /auth/sign-up/email|sign-in/email|sign-out` · `GET|PATCH /business/me` · `GET /subscription/me` · CRUD `/ingredients` · CRUD `/recipes` + `GET /recipes/:id/hpp-history` · CRUD `/categories` · CRUD `/transactions` · `GET /reports/summary|profit-loss|recipe-sales|export` · `GET /notifications` · `POST /receipts` (multipart `image`, 202) + `GET /receipts/:id` (polling) + `GET /receipts/:id/image` + `POST /receipts/:id/confirm` · `POST /recipes/:id/price-suggestion` + `GET /recipes/:id/price-suggestions`. Error kuota = **402**, AI tidak tersedia/belum dikonfigurasi = **503**.

`pnpm audit --prod` backend & frontend: 0 temuan (backend via `overrides` di `backend/pnpm-workspace.yaml`; hapus saat upstream bump).

## Tasks

| ID | Phase | Layer | Status | Task | Dependencies | Verification | Notes |
|---|---|---|---|---|---|---|---|
| L-01 | 0 | FE | completed | Ambil desain Stitch ke `design/` | - | 8 file ada di `design/` | DESIGN.md, globals.css, logo, landing desktop+mobile html/png |
| L-02 | 0 | FE | completed | Theme token + font (Plus Jakarta Sans, Geist Mono) di `globals.css`/`layout.tsx` | L-01 | `pnpm build` hijau; TS7 `tsc --noEmit` OK | Warning teks light #b45309 (AA) |
| L-03 | 0 | FE | completed | Landing: header, hero + meteor, fitur, simulasi HPP, harga, CTA, footer | L-02 | `pnpm lint` + `pnpm build` hijau; 1 `main`, `lang=id`, no overflow-x 375px | Link /login /register `prefetch={false}` sampai 1-22/1-23 |
| L-04 | 0 | FE | completed | Simulasi HPP live (client) | L-03 | Playwright: harga 10.000 → margin 36% "Sedang"; tambah bahan → HPP 6.950 | Hanya demo, tidak disimpan |
| L-05 | 0 | FE | completed | Toggle dark/light + simpan preferensi | L-03 | Playwright: toggle → light, reload tetap light (localStorage) | Default dark (sesuai desain) |
| L-06 | 0 | FE | completed | Screenshot desktop+mobile, bandingkan dengan desain | L-03 | `screenshots/landing-{desktop,mobile}-dark.png`, `landing-desktop-light.png`; console 0 error, network 0 gagal | Footer: hanya link nyata (tanpa sosmed/halaman legal) |
| V-01 | 1 | FE | completed | Samakan visual app (dashboard, resep, form resep, bahan, transaksi) dengan desain Stitch | L-01 | Screenshot desktop+mobile vs design/; 375px tanpa overflow; console 0 error | Data yang belum ada di backend = dummy di `lib/mock.ts` (chip "Contoh"); AI/OCR tetap tidak ditampilkan |
| 1-01 | 1 | OPS | dropped | `pnpm-workspace.yaml` root | - |  | Keputusan: root tanpa workspace (lihat CLAUDE.md); perintah dijalankan dari `backend/` atau `frontend/` |
| 1-02 | 1 | OPS | completed | Spike decorator metadata NestJS + vitest di TS 7 | - | `nest build` OK dgn alias TS6; `pnpm typecheck` (TS7) OK; vitest OK | `typescript`=TS6 alias (Nest CLI butuh compiler API), TS7 di `@typescript/native` |
| 1-03 | 1 | OPS | completed | `docker/docker-compose.yml` (postgres, redis, backend, frontend) | - | `--profile app up -d --build` → FE `/` 200 (title OK), BE 401 tanpa cookie, postgres healthy | postgres (default) + backend/frontend (profile `app`). Redis tidak dipasang: belum ada pemakai |
| 1-04 | 1 | OPS | completed | `docker/backend/Dockerfile` multi-stage | - | `docker build -f docker/backend/Dockerfile backend` OK; container jalan sbg uid 1000 (node) | node:24-slim, pnpm prune --prod; generator Prisma dipin `moduleFormat=esm`, `importFileExtension=js` |
| 1-05 | 1 | OPS | completed | `docker/frontend/Dockerfile` standalone | - | `docker compose ... build` OK; container `node server.js` → `/` 200 | `output: "standalone"` di `next.config.ts`; `NEXT_PUBLIC_API_URL` = build arg |
| 1-06 | 1 | OPS | completed | `.env.example` | - | file `backend/.env.example` | Backend saja |
| 1-07 | 1 | BE | completed | `schema.prisma` generator + datasource | - | `prisma migrate dev` → migration `init` applied | Semua model non-AI sekaligus (1-15/1-26/1-34/2-01/3-08) |
| 1-08 | 1 | BE | completed | `PrismaService` (adapter-pg) | 1-07 | `pnpm test:e2e` 19/19 | `src/prisma/prisma.service.ts` + `@Global` PrismaModule |
| 1-09 | 1 | BE | completed | Global `ValidationPipe` + exception filter | - | `pnpm test:e2e` 19/19 (400 validasi, 409 P2002) | ValidationPipe whitelist+forbidNonWhitelisted; `PrismaExceptionFilter` map P2002/P2003/P2025 |
| 1-10 | 1 | BE | completed | Hapus/pindah key `@nestjs/observe` hardcoded ke env | - | `pnpm build` + boot OK | `@nestjs/observe` dihapus (placeholder key) |
| 1-11 | 1 | FE | dropped | Init shadcn/ui di atas token tema | L-02 |  | Tidak dipakai: form memakai <dialog> native (`app/_components/sheet.tsx`); komponen pihak ketiga manual di `components/ui/` |
| 1-12 | 1 | FE | completed | `providers.tsx` (TanStack Query + Sonner) | 1-11 | Dipakai dashboard/onboarding; E2E: cookie palsu → 401 → logout → /login tanpa loop | `app/providers.tsx`: QueryCache/MutationCache onError 401; retry hanya 5xx/jaringan. Sonner ditunda (belum ada toast) |
| 1-13 | 1 | FE | completed | `lib/api-client.ts` (fetch, `credentials: include`) | - | `pnpm lint`/build hijau; Playwright: backend mati → pesan koneksi tampil | `lib/api-client.ts`, `NEXT_PUBLIC_API_URL` default `http://localhost:4000` |
| 1-14 | 1 | FE | completed | `proxy.ts` redirect route protected | 1-20 | curl: tanpa cookie /dashboard → 307 /login; cookie ada di /login → 307 /dashboard | Cek optimistik keberadaan cookie sesi Better Auth (`usahaku.session_token`); verifikasi sesi tetap di API |
| 1-15 | 1 | BE | completed | Model `User`, `Business`, `Subscription` | 1-07 | migration init |  |
| 1-16 | 1 | BE | completed | `RegisterDto`, `LoginDto` | 1-09 | `pnpm test:e2e` 19/19 | class-validator (bukan Zod) sesuai profile |
| 1-17 | 1 | BE | completed | `AuthService.register` (argon2 + Business + FREE + kategori default) | 1-15 | `pnpm test:e2e` 19/19 | argon2id; Business+Subscription FREE+6 kategori default dalam 1 nested write |
| 1-18 | 1 | BE | completed | Login → sesi Better Auth (cookie httpOnly) | 1-15 | `pnpm test:e2e` 19/19 | Diganti 2026-10-16 dari JWT custom ke Better Auth: sesi di tabel `Session`, cookie `usahaku.session_token` httpOnly/sameSite=lax/secure di prod, 7 hari; argon2 dipertahankan |
| 1-19 | 1 | BE | completed | `AuthController` (mount Better Auth) | 1-17, 1-18 | `pnpm test:e2e` 19/19 | `/auth/sign-up/email|sign-in/email|sign-out|get-session`; limit sign-up 5/menit, sign-in 10/menit per IP |
| 1-20 | 1 | BE | completed | `SessionGuard` + `@CurrentBusiness()` | 1-18 | `pnpm test:e2e` 19/19 (401 + scoping A/B) | Guard global (APP_GUARD), `@Public()` opt-out; sesi dicari lewat `auth.api.getSession`, `businessId` dari tabel Business |
| 1-21 | 1 | BE | completed | `BusinessController` GET/PATCH `/business/me` | 1-20 | `pnpm test:e2e` 19/19 |  |
| 1-22 | 1 | FE | completed | Halaman `/register` | 1-13 | E2E nyata (Postgres+API): daftar → cookie httpOnly, `/business/me` 200; email duplikat → error di kolom email | Kontrak = `RegisterDto` BE: {name, businessName?, email, password 8–128}; sukses → /onboarding (belum ada) |
| 1-23 | 1 | FE | completed | Halaman `/login` | 1-13 | E2E nyata: sandi salah → "Email atau kata sandi salah."; benar → /dashboard | Kontrak = `LoginDto` BE; /dashboard belum ada (3-06) |
| 1-24 | 1 | FE | dropped | State auth (Zustand bila perlu) | 1-23 |  | Tidak perlu: sesi di cookie httpOnly, state user dari `/business/me` (TanStack Query) |
| 1-25 | 1 | FE | completed | Halaman `/onboarding` | 1-21 | E2E: prefill nama usaha, pilih Kedai Minuman + Surabaya → PATCH /business/me tersimpan → /dashboard | Radio card aksesibel (fieldset/legend, has-focus-visible); tombol "Lewati dulu" |
| 1-26 | 1 | BE | completed | Model `Ingredient`, `IngredientPriceLog` | 1-15 | migration init | `pricePerUsageUnit` Decimal(14,4) (harga/gram sering pecahan) |
| 1-27 | 1 | BE | completed | Konversi unit (kg↔gram, liter↔ml) | - | `pnpm test` 10/10 (hpp-calculator.spec) | kg→gram, liter→ml ×1000; `pack` = isi dalam usageUnit; kombinasi lain 400 |
| 1-28 | 1 | BE | completed | `Create/UpdateIngredientDto` | 1-09 | `pnpm test:e2e` 19/19 |  |
| 1-29 | 1 | BE | completed | `IngredientService` CRUD + `pricePerUsageUnit` + log | 1-26, 1-27 | `pnpm test:e2e` 19/19 | Hapus bahan dipakai resep → 409 |
| 1-30 | 1 | BE | completed | `IngredientController` | 1-29 | `pnpm test:e2e` 19/19 | `/ingredients` CRUD + `?q=` |
| 1-31 | 1 | FE | completed | Hook `useIngredients` | 1-12 | E2E: 4 bahan via UI (kg/liter/pack) → harga per satuan server = preview | `lib/ingredients.ts` |
| 1-32 | 1 | FE | completed | Halaman `/ingredients` | 1-31 | E2E: daftar + cari; hapus bahan terpakai → 409 "Bahan dipakai di 1 resep"; mobile 375 no overflow | Stok/inventori dari desain dilewati (di luar PRD) |
| 1-33 | 1 | FE | completed | `IngredientFormDialog` (RHF + Zod) | 1-32 | E2E: sheet <dialog> modal, fokus terkunci, Esc/backdrop tutup | Native <dialog>, bukan shadcn Dialog |
| 1-34 | 1 | BE | completed | Model `Recipe`, `RecipeIngredient`, `RecipeOverhead`, `HppSnapshot` | 1-26 | migration init |  |
| 1-35 | 1 | BE | completed | HPP calculator (pure) + harga jual formula | - | `pnpm test` 10/10 (hpp-calculator.spec) | Decimal, round half-up 2dp; margin atas harga jual |
| 1-36 | 1 | BE | completed | `Create/UpdateRecipeDto` | 1-09 | `pnpm test:e2e` 19/19 | Update: array dikirim = replace list |
| 1-37 | 1 | BE | completed | `RecipeService` CRUD + recalc + snapshot | 1-34, 1-35 | `pnpm test:e2e` 19/19 | Snapshot saat create & saat HPP berubah |
| 1-38 | 1 | BE | completed | `RecipeService.recalcByIngredient` | 1-37 | `pnpm test:e2e` 19/19 (harga susu naik → HPP 3800→4800 + PRICE_CHANGE) | Dalam 1 `$transaction` dgn update bahan |
| 1-39 | 1 | BE | completed | `RecipeController` + `/hpp-history` | 1-37 | `pnpm test:e2e` 19/19 |  |
| 1-40 | 1 | FE | completed | Hook `useRecipes` | 1-12 | Dipakai daftar & editor resep | `lib/recipes.ts` (tipe + margin health) |
| 1-41 | 1 | FE | completed | Halaman `/recipes` | 1-40 | E2E: kartu HPP/harga/margin; setelah harga kopi naik → "Di bawah target 56,8%" | "Porsi terjual" & kategori menu dari desain dilewati (tidak ada data) |
| 1-42 | 1 | FE | completed | `RecipeForm` (`useFieldArray`) | 1-41 | E2E: buat resep 4 bahan + overhead → redirect /recipes/[id]; server HPP 8.350 = preview | useFieldArray bahan & overhead; hapus resep |
| 1-43 | 1 | FE | completed | `HppBreakdownCard` + `MarginSlider` | 1-42 | `node lib/hpp.check.mts` + uji silang 2.000 input acak vs backend identik | HPP live eksak (BigInt) cermin hpp-calculator.ts; slider margin + "Pakai harga ini" (kelipatan Rp 500) |
| 1-44 | 1 | FE | completed | `HppTrendChart` | 1-39 | Data asli /recipes/:id/hpp-history: 8.350 → 9.070 (+8,6%), tooltip & tabel sr-only | Garis SVG non-scaling + marker HTML fokus-able |
| 1-45 | 1 | FE | completed | App shell: sidebar desktop + bottom nav mobile + logout + theme toggle | 1-12 | E2E: logout → /login, sesi hilang; aria-current di menu aktif | Link ke /recipes /ingredients /transactions /reports `prefetch={false}` sampai halamannya ada |
| 2-01 | 2 | BE | completed | Model `Category`, `Transaction` | 1-15 | migration init | `Transaction.type` diturunkan dari kategori |
| 2-02 | 2 | BE | completed | `CategoryService` + `CategoryController` | 2-01 | `pnpm test:e2e` 19/19 | Kategori default tak bisa dihapus (400); dipakai → 409 |
| 2-03 | 2 | BE | completed | `CreateTransactionDto`, `QueryTransactionDto` | 1-09 | `pnpm test:e2e` 19/19 | Tanggal `YYYY-MM-DD` |
| 2-04 | 2 | BE | completed | `TransactionService` CRUD + filter + pagination | 2-01 | `pnpm test:e2e` 19/19 (scoping A/B) | Filter from/to/categoryId/type, page/limit≤100 |
| 2-05 | 2 | BE | completed | `TransactionController` | 2-04 | `pnpm test:e2e` 19/19 |  |
| 2-06 | 2 | FE | completed | Hook `useTransactions` | 1-12 | Dipakai halaman transaksi & dashboard | `lib/transactions.ts`, useInfiniteQuery |
| 2-07 | 2 | FE | completed | `TransactionFormSheet` | 2-06 | E2E: 3 transaksi via sheet (termasuk Rp 120.000,50) tersimpan | Tipe Masuk/Keluar memfilter kategori |
| 2-08 | 2 | FE | completed | Halaman `/transactions` | 2-06 | E2E: grup per tanggal, subtotal eksak 605.000,50; filter jenis/tanggal/kategori; mobile tanpa terpotong | Muat lebih banyak (20/halaman) |
| 2-09 | 2 | BE | completed | Model `PriceSuggestion`-free: formula harga di Recipe cukup | 1-35 | `pnpm test:e2e` 19/19 | `recommendedPrice` di list/detail resep |
| 2-10 | 2 | FE | completed | Tampilkan harga rekomendasi formula di detail resep | 1-43 | Editor: rekomendasi formula + pembulatan Rp 500; daftar resep: "minimal Rp 16.000" | Tanpa AI |
| 2-11 | 2 | BE | completed | Rate limit endpoint publik (auth) | 1-19 | `pnpm test:e2e` 19/19 (429) | @nestjs/throttler: register 5/menit, login 10/menit per IP |
| 2-12 | 2 | OPS | completed | MinIO bucket `receipts` | - | `docker compose up -d` → s3 :8333 200; bucket dibuat otomatis saat boot | SeaweedFS (Apache-2.0) menggantikan MinIO: image `minio/minio` tidak bisa di-pull lagi. Kode pakai AWS SDK standar → bisa pindah ke MinIO/S3/R2 via env |
| 2-13 | 2 | BE | completed | Model `ReceiptScan`, `ReceiptItem` | - | migration `ocr_pricing` + `receipt_item_position` | `ReceiptItem.position` menjaga urutan baris struk |
| 2-14 | 2 | BE | completed | `StorageService` MinIO | - | `pnpm test:e2e` 26/26 (AI di-mock) (gambar tersimpan & terbaca ulang identik) | `src/ocr/storage.service.ts`; gambar disajikan lewat `GET /receipts/:id/image` (scoped), bukan signed URL |
| 2-15 | 2 | BE | completed | AES-256-GCM API key | - | N/A | Tidak diperlukan: API key OpenRouter hanya di env server, tidak pernah disimpan di DB |
| 2-16 | 2 | AI | completed | OpenRouter client + schema + prompt OCR | - | `pnpm typecheck` OK (AI SDK v7); smoke build tanpa key → 503 aman | `ai` v7 + `@openrouter/ai-sdk-provider` + zod; default model free `google/gemma-4-31b-it:free` (`OPENROUTER_MODEL`) |
| 2-17 | 2 | BE | completed | `OcrController` + `OcrProcessor` (BullMQ) | - | `pnpm test:e2e` 26/26 (AI di-mock); smoke `node dist/main.js`: upload→queue→worker→FAILED pesan aman | BullMQ + Redis (docker). 202 + polling `GET /receipts/:id`. Scan nyangkut di-enqueue ulang saat boot. Validasi magic bytes JPG/PNG/WEBP, maks 5MB |
| 2-18 | 2 | BE | completed | Ingredient matcher + `OcrService.confirm` | - | `pnpm test` 18/18 (ocr-logic.spec); `pnpm test:e2e` 26/26 (AI di-mock) | Dice bigram (tanpa lib). Confirm: 1 tx = Transaction EXPENSE (source OCR) + update harga (log OCR) + recalc HPP; double-confirm 409 |
| 2-19 | 2 | FE | completed | `ReceiptCapture` + polling + review page | - | Lihat I-06, I-07 (Playwright: upload → review → konfirmasi) | Dikerjakan di Fase 4 (integrasi) |
| 2-20 | 2 | AI | completed | Schema + prompt price suggestion | - | `pnpm test:e2e` 26/26 (AI di-mock) | Output dinormalisasi min<=rec<=max, dibulatkan 2dp |
| 2-21 | 2 | BE | completed | `PricingService` AI | - | `pnpm test:e2e` 26/26 (AI di-mock) | `POST /recipes/:id/price-suggestion`, `GET /recipes/:id/price-suggestions`. Kuota dicek sebelum & dipotong sesudah AI sukses (gagal tidak memotong kuota) |
| 2-22 | 2 | FE | completed | `PriceSuggestionCard` AI | - | Lihat I-08 (Playwright: 503 tampil rapi saat AI mati) | Dikerjakan di Fase 4 (integrasi) |
| 2-23 | 2 | BE | completed | Model `PriceSuggestion` | - | migration `ocr_pricing` | + `hppAtRequest` untuk konteks |
| 3-01 | 3 | BE | completed | `ReportService.summary` | 2-04 | `pnpm test:e2e` 19/19 | `/reports/summary?from&to&granularity=day|week|month`; tanpa Redis (belum perlu) |
| 3-02 | 3 | BE | completed | `ReportService.profitLoss` | 2-04 | `pnpm test:e2e` 19/19 | `/reports/profit-loss` per kategori |
| 3-03 | 3 | BE | completed | `PdfExporter` | 3-02 | `pnpm test:e2e` 19/19 (PDF 200) | pdfkit |
| 3-04 | 3 | BE | completed | `ExcelExporter` | 3-02 | `pnpm test:e2e` 19/19 (PRO 200, FREE 402) | exceljs |
| 3-05 | 3 | BE | completed | `ReportController` | 3-01 | `pnpm test:e2e` 19/19 | Rentang maks 366 hari |
| 3-06 | 3 | FE | completed | Halaman `/dashboard` | 3-05 | E2E data nyata: 850rb vs 760rb → +12%; laba 485rb; chart 4 minggu + tooltip; empty state; mobile 375 no overflow; dark | Palet chart lolos validator dataviz (light+dark). Dilewati (tidak ada data API): target harian, menu terlaris, kuota OCR, notifikasi |
| 3-07 | 3 | FE | completed | Halaman `/reports` | 3-05 | E2E: laba rugi 970.000,50 − 365.000 = 605.000,50; klik PDF → unduh laba-rugi_*.pdf; Excel terkunci FREE (402) | Preset Bulan ini/lalu/30 hari + rentang kustom |
| 3-08 | 3 | BE | completed | Model `UsageCounter` | 1-15 | migration init |  |
| 3-09 | 3 | BE | completed | Tier limits config | - | `pnpm test:e2e` 26/26 | `TIER_LIMITS`: + OCR (FREE 10 / PRO 300) + saran AI (FREE 5 / PRO 100, PRO belum ada di PRD = usulan) |
| 3-10 | 3 | BE | completed | `UsageService` (increment + check atomic) | 3-08 | `pnpm test:e2e` 19/19 (402 + counter rollback) | Upsert increment dalam tx yang sama dgn insert |
| 3-11 | 3 | BE | completed | `TierGuard` + `@RequireQuota()` | 3-10 | `pnpm test:e2e` 19/19 | Diganti cek kuota di service (atomic dgn create), bukan guard; HTTP 402 |
| 3-12 | 3 | BE | completed | `SubscriptionController` | 3-08 | `pnpm test:e2e` 19/19 | `GET /subscription/me` (tier, limit, usage) |
| 3-13 | 3 | FE | completed | Halaman `/pricing` | L-03 | Playwright: `/pricing` desktop + mobile 375 (tanpa overflow-x), paket aktif ditandai, tabel perbandingan; `screenshots/pricing-*-free.png` | Di grup (app), butuh login (matcher `proxy.ts`). Data paket di `lib/plans.ts` (cermin `TIER_LIMITS`), dipakai juga oleh landing. Pembayaran online belum ada: tombol Pro = email ke halo@usahaku.id. Klaim landing yang tak ada di backend (trial 14 hari, 3 pengguna tim, backup cloud, resep tanpa batas di Gratis) dihapus |
| 3-14 | 3 | FE | completed | `UsageMeter` | 3-12 | Playwright: kartu pemakaian di Beranda dan `/pricing` (0/10, 0/100, 0/10, 0/5); `screenshots/dashboard-desktop-usage-meter.png` | `app/(app)/usage-meter.tsx` + `lib/subscription.ts` (satu query key untuk sidebar, laporan, meter). Bar kuning ≥80%, merah saat penuh |
| 3-15 | 3 | FE | completed | `UpgradeModal` saat 402 | 3-11 | Playwright: 402 pada upload struk → modal "Batas paket tercapai" → "Lihat paket Pro" → `/pricing`, modal tertutup; `screenshots/upgrade-modal-desktop-402.png` | Global: `providers.tsx` menangkap semua 402 (query & mutation) → `lib/upgrade.ts` + `upgrade-modal.tsx` (native `<dialog>`, bukan SweetAlert2). 402 disimulasikan (route mock); kontrak 402 sudah dites e2e backend |
| 3-16 | 3 | OPS | todo | Coolify resource config | 1-04, 1-05 | | |
| 3-17 | 3 | OPS | completed | `.github/workflows/ci.yml` | - | actionlint bersih; belum dijalankan di GitHub | Job backend: postgres + redis (services) + SeaweedFS (docker run) → lint, typecheck, test, e2e, build, audit. Job frontend: lint, tsc, build |
| 3-18 | 3 | OPS | completed | `.github/workflows/deploy.yml` | 3-17 | actionlint bersih; belum dijalankan (root belum repo GitHub, secrets belum ada) | Setelah CI sukses di main: build+push GHCR (backend, frontend) → webhook Coolify. Butuh secrets `COOLIFY_TOKEN`, `COOLIFY_WEBHOOK_BACKEND/FRONTEND`, var `NEXT_PUBLIC_API_URL` |
| 3-19 | 3 | OPS | completed | `prisma migrate deploy` di entrypoint | 1-04 | Log container: "No pending migrations to apply" lalu Nest started | CMD: `prisma migrate deploy` lalu `node dist/main.js`; `prisma` pindah ke dependencies, dotenv dihapus |
| 3-20 | 3 | OPS | completed | `pnpm audit` BE+FE sebelum rilis | - | BE `pnpm audit --prod`: 0; FE `pnpm audit`: 0 | BE: override mysql2/deepmerge-ts/uuid di `pnpm-workspace.yaml` (e2e 19/19 + migrate OK). Sisa temuan hanya devDependencies |
| 3-21 | 3 | FE | todo | Halaman legal (Syarat, Privasi) untuk footer | L-03 | | footer landing masih teks |

## Phase 4: Integrasi Backend (mulai 2026-09-27)

Selesai 2026-09-27: semua data dummy `frontend/lib/mock.ts` diganti endpoint asli; file dihapus.

| ID | Phase | Layer | Status | Task | Dependencies | Verification | Notes |
|---|---|---|---|---|---|---|---|
| I-01 | 4 | BE+FE | completed | Target laba harian + label cabang di `GET/PATCH /business/me` (bukan endpoint baru); diedit di `/onboarding`, tampil di Beranda/topbar/Transaksi | - | e2e "stores daily profit target + branch label"; Playwright: ubah target 200rb→500rb, progres Beranda ikut | Kolom `Business.dailyProfitTarget` Decimal(14,2)?, `branchLabel`? |
| I-02 | 4 | BE+FE | completed | Porsi terjual = input manual: transaksi INCOME opsional `recipeId` + `portions`; `GET /reports/recipe-sales?from&to` (+tren vs periode sebelumnya); kategori menu = `Recipe.category` (field teks + datalist di editor) | - | e2e validasi INCOME-only, porsi wajib, scoping, agregasi+tren; Playwright: catat 15× Kopi Hitam → Terlaris Beranda & kartu Resep | Keputusan bigboss 2026-09-27: manual. Resep dihapus → `recipeId` SetNull |
| I-03 | 4 | FE | completed | Stok bahan dihapus dari UI; diganti tren harga nyata dari `IngredientPriceLog` (2 log terakhir di `GET /ingredients`), filter "Harga Naik" | - | Playwright: Susu UHT −1,5% vs harga sebelumnya | Keputusan bigboss 2026-09-27: hapus (sesuai PRD MVP) |
| I-04 | 4 | BE+FE | completed | `GET /notifications` diturunkan dari data (harga naik 14 hari, struk DONE/FAILED, menu rugi), tanpa tabel; status baca per-browser (localStorage) | - | e2e notifikasi + scoping; Playwright: popover 2 item + link | Tabel notifikasi bila perlu dismiss per item/push |
| I-05 | 4 | FE | completed | Kuota OCR dari `GET /subscription/me` (`limit` null = tanpa batas) | - | Playwright: 0/10 → 1/10 setelah upload | |
| I-06 | 4 | FE | completed | Upload multipart `POST /receipts` + polling `GET /receipts/:id`; gambar via `GET /receipts/:id/image` (cookie) | - | Playwright: upload → 202 → review, gambar tampil | Scan FAILED kini bisa diisi manual (backend sudah mendukung) |
| I-07 | 4 | FE | completed | Konfirmasi via `POST /receipts/:id/confirm` (1 DB transaction); item punya kolom satuan; preview harga beli baru cermin `purchasePriceFromReceipt` | - | Playwright: 2 liter Rp39.000 → Susu 19.800→19.500, HPP 5.670→5.625, transaksi OCR | |
| I-08 | 4 | FE | completed | Saran harga AI via `POST /recipes/:id/price-suggestion` (butuh resep tersimpan & tidak dirty) | - | Playwright: 503 "Fitur AI belum dikonfigurasi" tampil rapi | `OPENROUTER_API_KEY` di `backend/.env` masih kosong |
| I-09 | 4 | FE | completed | `lib/mock.ts` + `MockBadge` dihapus; E2E semua halaman | I-01..I-08 | BE typecheck/lint/test 18/18/e2e 30/30/build; FE tsc/lint/build/hpp.check; audit BE+FE 0; screenshots `screenshots/*-integrated.png` | |

## Phase 5: Auth & Anti-Abuse (2026-10-16)

| ID | Phase | Layer | Status | Task | Dependencies | Verification | Notes |
|---|---|---|---|---|---|---|---|
| A-01 | 5 | BE | completed | Rate limit per IP global (120/menit) + counter di Redis (`RedisThrottlerStorage`); limit ketat upload struk & export | - | e2e "rate-limits login (429)"; hitungan bertahan antar restart | Fail closed bila Redis mati. `TRUST_PROXY_HOPS=1` wajib di belakang Coolify |
| A-02 | 5 | BE | completed | Email kanonik unik (`emailCanonical`: dot gmail, `+tag`, googlemail) + tolak domain email sementara | - | `email.spec.ts` + e2e "treats gmail dots and +tags as the same mailbox", "rejects disposable email domains" | Migrasi `email_canonical`; akun lama: canonical = email |
| A-03 | 5 | BE | completed | Batas akun baru per IP per hari (`MAX_SIGNUPS_PER_IP_PER_DAY`, default 3; IPv6 per /64), jatah dikembalikan bila gagal | A-01 | e2e "caps new accounts per IP per day" | `SignupLimiter` di Redis |
| A-04 | 5 | BE+FE | completed | Cloudflare Turnstile di register (plugin `captcha` Better Auth; widget `turnstile.tsx`) | A-05 | e2e: token kosong/salah/benar/verifier mati (fail closed); Playwright dengan widget tiruan | Kosong = nonaktif. Key tes Cloudflare di `backend/.env.example`. Belum diuji dengan Cloudflare asli |
| A-05 | 5 | BE | completed | Migrasi auth custom JWT → Better Auth 1.7.10 (sesi DB, argon2, hook Business+Subscription+kategori) | 1-18 | e2e 34/39 (5 gagal = S3 tidak jalan); tes hash lama tetap valid; CSRF origin 403; sign-out mencabut sesi | Migrasi `better_auth` memindah `passwordHash` → `Account.password`. Env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| A-06 | 5 | FE | completed | Login/register/logout memakai endpoint Better Auth; `proxy.ts` baca cookie baru | A-05 | Playwright: daftar → onboarding → dashboard → keluar → salah sandi → masuk; 0 error halaman | Sandbox tanpa S3/Cloudflare: OCR & captcha asli belum diuji |
| A-07 | 5 | BE | todo | Reset sandi, verifikasi email, login Google (plugin Better Auth) | A-05 | | Butuh pengirim email (Resend/SMTP) dan key OAuth |
| A-08 | 5 | OPS | todo | Cookie lintas subdomain di production (`crossSubDomainCookies`) atau FE+API satu domain | A-05 | | `proxy.ts` FE tidak melihat cookie host API bila domain berbeda |
| A-09 | 5 | BE | completed | Pengaman biaya AI: batas panggilan global harian (`AI_DAILY_CALL_CAP`), `maxRetries: 0`, `maxOutputTokens`, log pemakaian token | 2-16 | e2e `caps AI provider calls per day app-wide` (503; 0 = tanpa batas); pnpm lint/typecheck hijau; e2e 35/40 (5 gagal = S3 tidak jalan) | OCR maks 2 panggilan/scan (BullMQ), saran harga 1 panggilan. Token dicatat di log, belum per akun. Belum diuji dengan OpenRouter asli |
