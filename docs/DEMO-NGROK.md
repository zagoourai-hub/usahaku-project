# Demo di HP lewat satu tunnel ngrok

Untuk mencoba UsahaKu dari HP (termasuk kamera scan struk) tanpa deploy. Satu tunnel cukup: frontend meneruskan `/api/*` ke backend, jadi browser hanya melihat satu alamat dan cookie login tetap berlaku. Dua tunnel (frontend dan backend terpisah) **tidak** akan bisa login: dua domain ngrok dianggap situs berbeda.

```
HP → https://xxx.ngrok-free.app ─→ Next :3000 ──/api/*──→ Backend :4000
```

## Langkah

1. Infra dev dan ngrok (dari root):
   ```bash
   docker compose -f docker/docker-compose.yml up -d     # postgres, redis, s3
   ngrok http 3000                                        # catat https://xxx.ngrok-free.app
   ```
2. Backend (`backend/.env`, ganti `xxx`):
   ```bash
   FRONTEND_ORIGIN="https://xxx.ngrok-free.app"
   BETTER_AUTH_URL="https://xxx.ngrok-free.app"   # origin saja, tanpa /api
   MAX_SIGNUPS_PER_IP_PER_DAY=50                    # semua tamu terlihat satu IP lokal
   TURNSTILE_SECRET_KEY=""                          # kosong = cek bot mati
   ```
   ```bash
   cd backend && pnpm build && node dist/main.js
   ```
3. Frontend: build **production** dengan mode proxy (jangan `pnpm dev`, HMR menolak origin ngrok):
   ```bash
   cd frontend
   NEXT_PUBLIC_API_URL=/api API_PROXY_TARGET=http://localhost:4000 NEXT_PUBLIC_TURNSTILE_SITE_KEY= pnpm build
   pnpm start
   ```
   Build frontend tidak memuat domain ngrok, jadi cukup sekali. Saat domain ngrok berubah, hanya env backend yang diganti lalu backend direstart.
4. Buka `https://xxx.ngrok-free.app` di HP. Klik "Visit Site" pada halaman peringatan ngrok (sekali, paket gratis).

## Catatan

- **Keamanan:** tunnel membuka aplikasi dev ke internet. Pakai `BETTER_AUTH_SECRET` yang kuat dan bagikan URL hanya ke orang yang perlu. Untuk batasan tambahan: `ngrok http 3000 --basic-auth "user:sandi"`.
- **Scan struk dan saran AI** butuh SeaweedFS (sudah di `docker compose`) dan `OPENROUTER_API_KEY` di `backend/.env`.
- **Setelah demo:** kembalikan `FRONTEND_ORIGIN` dan `BETTER_AUTH_URL` ke `localhost`, lalu build frontend tanpa `NEXT_PUBLIC_API_URL`/`API_PROXY_TARGET` (mode normal, tanpa rewrite).
- **Alternatif tanpa ngrok:** HP di Wi-Fi yang sama membuka `http://IP-laptop:3000` (API di `http://IP-laptop:4000`, set `FRONTEND_ORIGIN` ke alamat itu).
