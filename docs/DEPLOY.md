# Deploy UsahaKu ke Coolify

Alur: push ke `main` → workflow **CI** → bila hijau, workflow **Deploy** membangun image backend + frontend ke GHCR lalu memanggil webhook Coolify. Task tracker: 3-16 (konfigurasi di sisi Coolify butuh akses akun bigboss).

## 1. Domain

Pakai dua subdomain dari satu domain induk:

| Aplikasi | Contoh | Catatan |
|---|---|---|
| Frontend | `app.usahaku.id` | `FRONTEND_ORIGIN` backend harus sama persis (tanpa slash akhir) |
| Backend | `api.usahaku.id` | `BETTER_AUTH_URL` dan `NEXT_PUBLIC_API_URL` menunjuk ke sini |

Cookie sesi harus terlihat oleh frontend (`proxy.ts` membacanya) **dan** API, jadi set `COOKIE_DOMAIN=.usahaku.id` di backend. Alternatif: satu domain dengan routing path (`/api`) di Traefik, lalu `COOKIE_DOMAIN` dikosongkan.

## 2. Resource di Coolify

| Resource | Jenis | Catatan |
|---|---|---|
| Postgres 16 | Database (one-click) | Aktifkan scheduled backup. Ambil connection string internal untuk `DATABASE_URL` |
| Redis 7 | Database (one-click) | `REDIS_URL`. Dipakai antrean scan struk dan rate limit. Redis mati = login dan API ditolak (sengaja) |
| Penyimpanan foto struk | S3-compatible | Cloudflare R2, Backblaze B2, atau MinIO/SeaweedFS di Coolify. Isi `S3_*` |
| Backend | Application → Docker Image | `ghcr.io/zagoourai-hub/usahaku-project/backend:latest`, port 4000 |
| Frontend | Application → Docker Image | `ghcr.io/zagoourai-hub/usahaku-project/frontend:latest`, port 3000 |

Image GHCR bersifat privat secara default: tambahkan registry di Coolify (user GitHub + PAT dengan `read:packages`) atau jadikan package publik.

Health check: backend `GET /health` (port 4000, cek koneksi DB), frontend `GET /login` (port 3000).

Backend menjalankan `prisma migrate deploy` otomatis saat start. Worker OCR dan job pembersihan (tiap 6 jam: sesi kedaluwarsa, scan gagal >7 hari, draf >30 hari, foto struk tersimpan >30 hari) berjalan di proses backend yang sama, jadi cukup satu instance. Aplikasi menutup worker dan koneksi dengan rapi saat menerima SIGTERM (redeploy).

## 3. Environment backend

| Variabel | Wajib | Nilai |
|---|---|---|
| `DATABASE_URL` | ya | dari resource Postgres |
| `BETTER_AUTH_SECRET` | ya | acak min. 32 karakter: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `BETTER_AUTH_URL` | ya (prod) | `https://api.usahaku.id` |
| `FRONTEND_ORIGIN` | ya (prod) | `https://app.usahaku.id` |
| `COOKIE_DOMAIN` | bila subdomain | `.usahaku.id` |
| `TRUST_PROXY_HOPS` | ya | `1` di belakang Traefik Coolify; `2` bila Cloudflare proxy juga di depan. Salah isi = limit IP dan batas akun per IP dihitung per proxy, bukan per pengguna |
| `REDIS_URL` | ya | dari resource Redis |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` | ya | dari penyimpanan S3 |
| `SMTP_URL`, `MAIL_FROM` | ya (verifikasi email, reset sandi) | mis. `smtps://resend:API_KEY@smtp.resend.com:465` dan `UsahaKu <no-reply@usahaku.id>`. Domain pengirim harus terverifikasi (SPF/DKIM) di penyedia email. Kosong = email tidak terkirim, pengguna baru tidak bisa memakai scan struk dan saran AI |
| `TURNSTILE_SECRET_KEY` | disarankan | dari dashboard Cloudflare (kosong = cek bot mati) |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | untuk fitur AI | kosong = fitur AI mengembalikan 503 |
| `AI_DAILY_CALL_CAP` | opsional | default 1000 panggilan AI per hari, 0 = tanpa batas |
| `MAX_SIGNUPS_PER_IP_PER_DAY` | opsional | default 3 |
| `DB_POOL_MAX` | opsional | ukuran pool Postgres per instance, default 10 |

Backend menolak start di production bila `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, atau `FRONTEND_ORIGIN` kosong.

Frontend tidak punya env runtime: `NEXT_PUBLIC_*` ditanam saat build (lihat bagian 4).

## 4. GitHub (Settings → Secrets and variables → Actions)

| Jenis | Nama | Isi |
|---|---|---|
| Secret | `COOLIFY_TOKEN` | API token Coolify (izin deploy) |
| Secret | `COOLIFY_WEBHOOK_BACKEND` | URL webhook deploy aplikasi backend |
| Secret | `COOLIFY_WEBHOOK_FRONTEND` | URL webhook deploy aplikasi frontend |
| Variable | `NEXT_PUBLIC_API_URL` | `https://api.usahaku.id` |
| Variable | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | site key Turnstile (kosong = widget mati) |

Mengubah variable `NEXT_PUBLIC_*` butuh build ulang frontend (jalankan ulang workflow Deploy).

## 5. Cloudflare Turnstile

Buat widget di dashboard Cloudflare dengan hostname `app.usahaku.id`. Site key ke variable GitHub, secret key ke env backend.

## 6. Cek setelah deploy

1. `curl https://api.usahaku.id/health` → `{"status":"ok"}`.
2. Daftar akun dari `https://app.usahaku.id/register`: widget tampil, masuk ke onboarding.
3. DevTools → Application → Cookies: `__Secure-usahaku.session_token`, `HttpOnly`, `Secure`, domain `.usahaku.id`.
4. Refresh `/dashboard` tetap login, Keluar memutus sesi.
5. Daftar akun baru: email konfirmasi masuk, tautannya mengaktifkan scan struk dan saran AI; "Lupa kata sandi?" mengirim tautan reset yang bisa dipakai sekali.
6. Scan struk (butuh S3 dan `OPENROUTER_API_KEY`) dan lihat log `usage feature=ocr`.
7. Daftar dari 4 akun berbeda pada IP yang sama: yang ke-4 ditolak (membuktikan `TRUST_PROXY_HOPS` benar bila IP yang dilihat adalah IP klien, bukan IP proxy).
