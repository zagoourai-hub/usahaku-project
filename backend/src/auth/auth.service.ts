import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthPayload, TokenDenylist } from './auth.guard.js';
import type { LoginDto, RegisterDto } from './auth.dto.js';
import { canonicalEmail, isDisposableEmail } from './email.js';
import { SignupLimiter } from './rate-limit.js';
import { TurnstileService } from './turnstile.js';

export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const DEFAULT_CATEGORIES = [
  { name: 'Penjualan', type: 'INCOME' },
  { name: 'Belanja Bahan', type: 'EXPENSE' },
  { name: 'Gaji', type: 'EXPENSE' },
  { name: 'Sewa', type: 'EXPENSE' },
  { name: 'Listrik & Gas', type: 'EXPENSE' },
  { name: 'Lain-lain', type: 'EXPENSE' },
] as const;

// Verified against when the email is unknown, so login timing doesn't reveal
// which emails are registered.
const DUMMY_HASH = argon2.hash('dummy-password-for-timing');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly denylist: TokenDenylist,
    private readonly signups: SignupLimiter,
    private readonly turnstile: TurnstileService,
  ) {}

  async register(dto: RegisterDto, ip: string) {
    if (isDisposableEmail(dto.email)) {
      throw new BadRequestException(
        'Pakai email aktif milik Anda, email sementara tidak diterima',
      );
    }
    // Bot check first: rejected bots must not eat the IP's signup quota.
    await this.turnstile.verify(dto.turnstileToken, ip);
    const passwordHash = await argon2.hash(dto.password);
    await this.signups.take(ip);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          emailCanonical: canonicalEmail(dto.email),
          name: dto.name,
          passwordHash,
          subscription: { create: {} }, // FREE / ACTIVE by default
          business: {
            create: {
              name: dto.businessName ?? `Usaha ${dto.name}`,
              categories: {
                create: DEFAULT_CATEGORIES.map((c) => ({
                  ...c,
                  isDefault: true,
                })),
              },
            },
          },
        },
        include: { business: true },
      });
      // business is created in the same nested write, never null here
      return this.issue(user.id, user.business!.id);
    } catch (e) {
      await this.signups.release(ip);
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Email sudah terdaftar');
      }
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { business: true },
    });
    const valid = await argon2.verify(
      user?.passwordHash ?? (await DUMMY_HASH),
      dto.password,
    );
    if (!user || !valid || !user.business) {
      throw new UnauthorizedException('Email atau password salah');
    }
    return this.issue(user.id, user.business.id);
  }

  /** Revokes the cookie token so a copy of it stops working before expiry. */
  async logout(token: unknown) {
    if (typeof token !== 'string') return;
    let payload: AuthPayload;
    try {
      payload = await this.jwt.verifyAsync<AuthPayload>(token);
    } catch {
      return; // invalid or expired: nothing to revoke
    }
    if (payload.exp) await this.denylist.revoke(token, payload.exp);
  }

  private issue(userId: string, businessId: string) {
    const payload: AuthPayload = { sub: userId, bid: businessId };
    return this.jwt.signAsync(payload);
  }
}
