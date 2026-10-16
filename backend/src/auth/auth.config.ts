import { randomUUID } from 'node:crypto';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { captcha } from 'better-auth/plugins';
import * as argon2 from 'argon2';
import type { PrismaService } from '../prisma/prisma.service.js';
import { canonicalEmail, isDisposableEmail } from './email.js';

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export const DEFAULT_CATEGORIES = [
  { name: 'Penjualan', type: 'INCOME' },
  { name: 'Belanja Bahan', type: 'EXPENSE' },
  { name: 'Gaji', type: 'EXPENSE' },
  { name: 'Sewa', type: 'EXPENSE' },
  { name: 'Listrik & Gas', type: 'EXPENSE' },
  { name: 'Lain-lain', type: 'EXPENSE' },
] as const;

const isProd = () => process.env.NODE_ENV === 'production';

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function createAuth(prisma: PrismaService) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be set (min 32 chars)');
  }
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  // Cookie security and CSRF trust derive from these: never guess them in production.
  if (
    isProd() &&
    !(process.env.BETTER_AUTH_URL && process.env.FRONTEND_ORIGIN)
  ) {
    throw new Error(
      'BETTER_AUTH_URL and FRONTEND_ORIGIN must be set in production',
    );
  }
  // Frontend and API on sibling subdomains (app.x.com / api.x.com): the session
  // cookie must be visible to both, e.g. COOKIE_DOMAIN=.x.com. Unset = host-only.
  const cookieDomain = process.env.COOKIE_DOMAIN;

  return betterAuth({
    appName: 'UsahaKu',
    basePath: '/auth',
    baseURL:
      process.env.BETTER_AUTH_URL ||
      `http://localhost:${process.env.PORT ?? 4000}`,
    secret,
    trustedOrigins: process.env.FRONTEND_ORIGIN
      ? [process.env.FRONTEND_ORIGIN]
      : [],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128, // argon2 would hash huge payloads otherwise
      // argon2id like before, so hashes of existing accounts keep verifying.
      password: {
        hash: (password) => argon2.hash(password),
        verify: ({ hash, password }) => argon2.verify(hash, password),
      },
    },
    session: { expiresIn: SESSION_TTL_SECONDS },
    // Throttling is done once, globally, by Nest's ThrottlerGuard (Redis).
    rateLimit: { enabled: false },
    user: {
      additionalFields: {
        emailCanonical: { type: 'string', required: false, input: false },
      },
    },
    advanced: {
      cookiePrefix: 'usahaku',
      useSecureCookies: isProd(),
      ...(cookieDomain && {
        crossSubDomainCookies: { enabled: true, domain: cookieDomain },
      }),
      // Better Auth skips the CSRF origin check when NODE_ENV=test; keep it on.
      disableOriginCheck: false,
      database: { generateId: () => randomUUID() },
    },
    hooks: {
      // Cheap checks before the (expensive) password hash and user insert.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-up/email') return;
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const email = str(body.email);
        if (isDisposableEmail(email)) {
          throw new APIError('BAD_REQUEST', {
            message:
              'Pakai email aktif milik Anda, email sementara tidak diterima',
          });
        }
        const name = str(body.name);
        if (name.length < 1 || name.length > 100) {
          throw new APIError('BAD_REQUEST', { message: 'Nama 1-100 karakter' });
        }
        if (body.businessName != null && str(body.businessName).length > 100) {
          throw new APIError('BAD_REQUEST', {
            message: 'Nama usaha maksimal 100 karakter',
          });
        }
        const taken = await prisma.user.findUnique({
          where: { emailCanonical: canonicalEmail(email) },
          select: { id: true },
        });
        if (taken) {
          throw new APIError('UNPROCESSABLE_ENTITY', {
            message: 'Email sudah terdaftar',
            code: 'USER_ALREADY_EXISTS',
          });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, emailCanonical: canonicalEmail(user.email) },
          }),
          // Every account owns exactly one Business + FREE subscription.
          after: async (user, ctx) => {
            const body = (ctx?.body ?? {}) as Record<string, unknown>;
            try {
              await prisma.$transaction([
                prisma.subscription.create({ data: { userId: user.id } }),
                prisma.business.create({
                  data: {
                    userId: user.id,
                    name: str(body.businessName) || `Usaha ${user.name}`,
                    categories: {
                      create: DEFAULT_CATEGORIES.map((c) => ({
                        ...c,
                        isDefault: true,
                      })),
                    },
                  },
                }),
              ]);
            } catch (e) {
              // No half-created account without a business.
              await prisma.user
                .delete({ where: { id: user.id } })
                .catch(() => undefined);
              throw e;
            }
          },
        },
      },
    },
    plugins: turnstileSecret
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: turnstileSecret,
            endpoints: ['/sign-up/email'],
          }),
        ]
      : [],
  });
}

export type Auth = ReturnType<typeof createAuth>;
