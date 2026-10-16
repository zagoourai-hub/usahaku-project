import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare Turnstile check for the public register form, to stop scripted
 * mass signups. Without TURNSTILE_SECRET_KEY the check is off (dev, tests).
 * Cloudflare's always-pass test keys work for local dev, see .env.example.
 */
@Injectable()
export class TurnstileService {
  private readonly secret = process.env.TURNSTILE_SECRET_KEY;

  constructor() {
    if (!this.secret && process.env.NODE_ENV === 'production') {
      new Logger(TurnstileService.name).warn(
        'TURNSTILE_SECRET_KEY is not set: signup bot check is disabled',
      );
    }
  }

  async verify(token: string | undefined, ip: string) {
    if (!this.secret) return;
    if (!token) {
      throw new BadRequestException('Selesaikan verifikasi keamanan dulu');
    }
    let success = false;
    try {
      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        body: new URLSearchParams({
          secret: this.secret,
          response: token,
          remoteip: ip,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok)
        success =
          ((await res.json()) as { success?: boolean }).success === true;
    } catch {
      // Fail closed: an unreachable verifier must not turn the check off.
      throw new ServiceUnavailableException(
        'Verifikasi keamanan sedang tidak tersedia, coba lagi sebentar',
      );
    }
    if (!success) {
      throw new BadRequestException(
        'Verifikasi keamanan gagal, muat ulang halaman lalu coba lagi',
      );
    }
  }
}
