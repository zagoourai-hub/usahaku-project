import type { Mail } from './mail.service.js';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(
  to: string,
  name: string,
  subject: string,
  intro: string,
  button: string,
  url: string,
  outro: string,
): Mail {
  const text = `Halo ${name},\n\n${intro}\n\n${url}\n\n${outro}\n\nTim UsahaKu`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.6;color:#111">
<p>Halo ${esc(name)},</p>
<p>${esc(intro)}</p>
<p><a href="${esc(url)}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(button)}</a></p>
<p style="font-size:14px;color:#555">Kalau tombol tidak berfungsi, salin tautan ini ke browser:<br>${esc(url)}</p>
<p style="font-size:14px;color:#555">${esc(outro)}</p>
<p>Tim UsahaKu</p></div>`;
  return { to, subject, text, html };
}

export const verifyEmailMail = (to: string, name: string, url: string) =>
  layout(
    to,
    name,
    'Konfirmasi email UsahaKu',
    'Satu langkah lagi: konfirmasi email kamu supaya bisa memakai scan struk dan saran harga.',
    'Konfirmasi email',
    url,
    'Tautan berlaku 1 jam. Kalau kamu tidak mendaftar di UsahaKu, abaikan email ini.',
  );

export const resetPasswordMail = (to: string, name: string, url: string) =>
  layout(
    to,
    name,
    'Atur ulang kata sandi UsahaKu',
    'Kami menerima permintaan mengatur ulang kata sandi akun kamu.',
    'Atur kata sandi baru',
    url,
    'Tautan berlaku 1 jam dan hanya bisa dipakai sekali. Kalau bukan kamu yang meminta, abaikan email ini, kata sandi kamu tidak berubah.',
  );
