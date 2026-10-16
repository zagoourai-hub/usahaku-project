# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Profile: `saas-web-no-ai` · Pasangan: `AGENTS.md`

## Persona & Output

- Panggil user **"bigboss"**, asisten **"Zagoour"**. Senior fullstack engineer.
- Penjelasan Bahasa Indonesia; kode/komentar Bahasa Inggris. Langsung ke inti (caveman `ultra` autoaktif).
- Setiap perubahan kode sertakan perintah verifikasi.

## Proyek

- **UsahaKu**: kalkulator HPP resep + cashflow UMKM F&B. Spesifikasi: `docs/PRD.md`.
- Backend API fase 1–3 selesai termasuk AI (OCR struk + saran harga); status per task di `docs/PRD.tasks.md`.
- Frontend lengkap per desain `design/` (Stitch) dan **terintegrasi penuh ke backend (2026-09-27)** — tidak ada data dummy lagi (`lib/mock.ts` dihapus).
- Keputusan bigboss: stok/inventori **tidak** dibangun (dihapus dari UI, diganti tren harga dari `IngredientPriceLog`); porsi terjual = **input manual** (transaksi INCOME + `recipeId` + `portions` → `GET /reports/recipe-sales`); AI nyata via OpenRouter.
- AI aktif (key diisi 2026-09-27). Model wajib dukung gambar + `structured_outputs`; default `dots-studio/dots-3-note-preview:free` (OCR ±35 dtk, saran harga ±60 dtk). Jangan `openrouter/free` (router acak → JSON gagal); `qwen/qwen3.8-27b:free` sering rate-limit.
- Sisa task: `/pricing` (3-13), UsageMeter (3-14), UpgradeModal saat 402 (3-15), Coolify (3-16), halaman legal (3-21, teks dari bigboss), reset sandi/verifikasi email/Google (A-07), cookie lintas subdomain production (A-08).
- Git repo di root (remote `origin` = `git@github.com:zagoourai-hub/usahaku-project.git`, cabang `main`), tanpa workspace root. Jalankan perintah dari dalam `backend/` atau `frontend/`.
- **AI diizinkan bigboss (2026-09-26)** untuk OCR struk & saran harga: backend nyata via OpenRouter (dev: model `:free`, lib gratis). Fitur AI lain tetap butuh konfirmasi.

## Perintah

**Backend** (`cd backend`)
- `pnpm start:dev` · `pnpm build` · `pnpm lint` (oxlint) · `pnpm format`
- `pnpm test` · `pnpm test:e2e` · satu test: `pnpm vitest run <file>` / `-t "<nama>"`
- Prisma wajib `--config prisma7.config.ts`, mis. `pnpm prisma migrate dev --config prisma7.config.ts`

**Frontend** (`cd frontend`)
- `pnpm dev` · `pnpm build` · `pnpm lint`
- Typecheck TS7: `node node_modules/@typescript/native/bin/tsc --noEmit` · cek hitungan HPP: `node lib/hpp.check.mts`
- Uji full stack: Postgres jalan → `cd backend && pnpm build && node dist/main.js` (:4000) → `cd frontend && pnpm build && pnpm start` (:3000). API URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).

## Gotcha

- Backend ESM: import relatif pakai ekstensi `.js`.
- Auth = **Better Auth** (`backend/src/auth/auth.config.ts`), mount di `/auth/*` lewat `AuthController` (bukan paket Nest pihak ketiga). Sesi di tabel `Session` (cookie httpOnly `usahaku.session_token`, 7 hari), sandi argon2 di `Account.password`, sign-out mencabut sesi seketika. Endpoint: `POST /auth/sign-up/email|sign-in/email|sign-out`, `GET /auth/get-session`. Daftar: body `{name,email,password,businessName?}` + header `x-captcha-response`; Business+Subscription+kategori default dibuat di `databaseHooks.user.create.after`. Origin check (CSRF) wajib aktif: `FRONTEND_ORIGIN` harus benar. Respons sign-up/sign-in memuat `token` sesi di body (bawaan Better Auth). Redis dipakai throttler (gagal = request ditolak), bukan lagi untuk sesi.
- Anti multi-akun & IP limit: `ThrottlerGuard` global (120/menit/IP, counter di Redis via `RedisThrottlerStorage`), endpoint auth/upload/export/AI lebih ketat lewat `@Throttle`. Register: `emailCanonical` unik (dot gmail & `+tag` dilipat), domain email sekali-pakai ditolak, maks `MAX_SIGNUPS_PER_IP_PER_DAY` (default 3) akun baru per IP/hari (`SignupLimiter`, IPv6 per /64). Register juga cek Cloudflare Turnstile lewat plugin `captcha` Better Auth (`TURNSTILE_SECRET_KEY` BE + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` FE build arg; kosong = nonaktif; key tes Cloudflare ada di `backend/.env.example`; fail closed bila verifier tak terjangkau). Test e2e mem-bypass lewat override `ThrottlerStorage` + `SignupLimiter`; request ber-cookie perlu header `Origin`.
- Update DTO: pakai `PartialType(X, NOT_NULL)` / `IsOptionalNotNull` (`dto.decorators.ts`) agar `null` ke kolom wajib jadi 400, bukan 500.
- Prisma client di `src/generated/prisma`, koneksi via `@prisma/adapter-pg`.
- Infra dev: `docker compose -f docker/docker-compose.yml up -d` (dari root) → postgres, redis, s3 (SeaweedFS); tambah `--profile app --build` + `BETTER_AUTH_SECRET` untuk jalankan image backend. Env backend: `backend/.env.example`.
- Backend: `typescript` = alias TS6 (Nest CLI butuh compiler API); typecheck TS7: `pnpm typecheck`. e2e (`pnpm test:e2e`) butuh Postgres jalan dan server dev backend **mati** (worker-nya berbagi queue Redis `ocr` dan merebut job test).
- Next.js versi baru (breaking changes): baca `frontend/node_modules/next/dist/docs/` sebelum menulis kode Next. App Router di `frontend/app/`.
- Versi terpasang: NestJS 12, Next 16.3, React 19.2, TypeScript 7, Prisma 7.
- Frontend: `typescript` = alias TS6 (`@typescript/typescript6`) karena typescript-eslint belum dukung TS7; TS7 ada di `@typescript/native` → typecheck: `node node_modules/@typescript/native/bin/tsc --noEmit`. Error tipe route (`PageProps`) setelah tambah route → `pnpm build` lalu hapus `tsconfig.tsbuildinfo`.
- Notifikasi (`GET /notifications`) diturunkan dari data tiap request, tanpa tabel; status baca di localStorage browser.
- Upload FE: `api()` melewatkan `Content-Type` bila body `FormData`. Gambar struk = `<img>` ke API (cookie), bukan `next/image`.
- FE HPP live: `frontend/lib/hpp.ts` cermin `backend/src/recipe/hpp-calculator.ts`; ubah keduanya bersamaan, cek `node lib/hpp.check.mts`.
- FE uang: API kirim Decimal sebagai string. Tampilan pakai `formatIDR` (sen tampil bila ada, `Rp 3.412,50`); penjumlahan/subtotal pakai BigInt (`toScaled`/`centsToString` di `lib/hpp.ts`), jangan float. Persen pakai `formatPct` (koma desimal).
- FE auth: cookie httpOnly `usahaku.session_token` (`__Secure-` di production) dari backend. `proxy.ts` hanya cek keberadaan cookie (tambah route baru ke `matcher`); 401 → `providers.tsx` logout lalu `/login`.
- FE pola: form di `<dialog>` native (`app/_components/sheet.tsx`), field di `app/_components/fields.tsx`, RHF + Zod yang mencerminkan DTO backend. Struktur shadcn manual (tanpa `components.json`/CLI init, agar token `globals.css` tidak ditimpa): komponen pihak ketiga di `components/ui/`, `cn()` di `lib/utils.ts`.
- FE sidebar desktop = `components/ui/animated-sidebar.tsx` (beui.dev, diadaptasi; cari `UsahaKu:`). Status buka/tutup di cookie `sidebar_state`, dibaca server di `app/(app)/layout.tsx` → route app dinamis. Konstanta cookie di `sidebar-cookie.ts` (modul biasa: ekspor non-komponen dari file `"use client"` jadi client reference di server, bukan string). motion tidak bisa animasi `width` antar `var(...)` → pakai angka px.
- FE waktu ditampilkan "WIB" → format selalu `timeZone: "Asia/Jakarta"` (`timeOf` di `lib/transactions.ts`).

## Stack (pasang hanya saat dibutuhkan)

- FE: Next.js + shadcn/ui + Tailwind v4 + TanStack Query + RHF + Zod (+ Zustand bila perlu state global).
- BE: NestJS12 + Prisma7 + PostgreSQL + Better Auth (sesi cookie httpOnly) + class-validator (+ Redis bila perlu).
- Ops: Docker + Coolify + GitHub Actions.
- AI: hanya `ai` + `@openrouter/ai-sdk-provider` di `backend/src/ai/` (tanpa `ai-service/` terpisah). Key hanya dari env `OPENROUTER_API_KEY`.
- Terpasang di FE: lucide-react, react-hook-form, zod, @hookform/resolvers, @tanstack/react-query, motion (sidebar), clsx + tailwind-merge (`cn`).
- Struktur tetap `frontend/` + `backend/` + `docker/`. Tidak ada kode app di root, dan tidak ada `apps/`.

## Anti Over-Engineering

- Kerjakan hanya yang diminta. Tidak ada scaffolding atau fitur "untuk nanti".
- Urutan: kode yang sudah ada → fitur bawaan framework/DB → dependency terpasang → baru kode/dependency baru.
- Nest cukup Module + Controller + Service + DTO. Tanpa repository layer, interface, factory, atau wrapper yang cuma punya satu implementasi.
- File/modul baru hanya bila ada lebih dari satu pemakai atau boundary domain jelas. Jangan buat folder catch-all `utils/`.
- Test hanya untuk logika penting: hitungan HPP/uang, auth, scoping `businessId`.
- Bila keputusan teknis belum jelas: beri 1 rekomendasi + maks 2 alternatif.
- Pengecualian (jangan dipangkas): validasi, keamanan, aksesibilitas, error handling anti-kehilangan-data.

## Aturan Wajib

- Bug: root cause dulu. TypeScript tanpa `any`. Cek docs resmi sebelum modul besar.
- Secret hanya dari env; tidak pernah di-hardcode, dicatat di log, atau dikirim ke browser.
- Input publik divalidasi DTO/Zod. Endpoint publik di-rate limit, error tidak membocorkan detail internal.
- Uang pakai `Decimal`. Query selalu di-scope ke `businessId` user.
- Saat menyentuh auth/payment/upload/integrasi eksternal: jalankan `pnpm audit`.
- Jangan melemahkan validasi/security demi test lolos. Jangan klaim sukses sebelum verifikasi hijau.

## UI

- Semantic HTML: `header/nav/main/section/footer`, `button` untuk aksi, `next/link` untuk navigasi, `label` terhubung ke input, satu `main` per route, `<html lang>` di root layout.
- Keterbacaan (pengguna dewasa–lansia, keputusan bigboss 2026-09-27): teks min 14px (`text-xs`=14px, `text-sm`=16px, `text-base`=17px via token di `globals.css`; jangan `text-[10–13px]`), tanpa font mono, tanpa label KAPITAL/`uppercase`/`tracking-wide`, bahasa sehari-hari (bukan COGS/OCR/istilah teknis), mode terang default, filter chip `flex-wrap` (bukan scroll samping). Grid yang berisi input: pakai `grid-cols-1`/`minmax(0,1fr)` agar tidak melebar di mobile.
- Pakai `next/image` + `alt` dan Metadata API. Jaga keyboard, focus terlihat, contrast, dan reduced-motion.
- Referensi desain ada di `design/` → screenshot Playwright, bandingkan, perbaiki sampai mirip.
- Playwright: screenshot hanya di `screenshots/<halaman>-<viewport>-<state>.png`. Cek URL/H1, console error, network gagal, desktop + mobile.

## Eksekusi PRD

1. Ekstrak atomic task per fase dengan tag [FE]/[BE]/[OPS] ke `docs/<nama-prd>.tasks.md`, kolom: `ID | Phase | Layer | Status | Task | Dependencies | Verification | Notes`.
2. Kerjakan satu task sekaligus. Status: `in_progress` → `completed` / `blocked` + alasan.
3. Setelah tiap task: lint/typecheck/test/build relevan, lalu catat di `Verification`. Tiap akhir fase: update `Summary` + `Last Updated`.
