import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';
import { AUTH } from './auth.constants.js';
import type { Auth } from './auth.config.js';
import { Public } from './auth.guard.js';
import { SignupLimiter } from './rate-limit.js';

/**
 * Mounts Better Auth under /auth (sign-up/email, sign-in/email, sign-out,
 * get-session, ...). It runs as a Nest route so the global ThrottlerGuard
 * applies; Better Auth reads the body Nest already parsed.
 */
@Controller('auth')
export class AuthController {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  constructor(
    @Inject(AUTH) auth: Auth,
    private readonly signups: SignupLimiter,
  ) {
    this.handler = toNodeHandler(auth);
  }

  @Public()
  @All('*path')
  async handle(@Req() req: Request, @Res() res: Response) {
    const isSignUp =
      req.method === 'POST' && req.path === '/auth/sign-up/email';
    if (!isSignUp) return this.handler(req, res);

    // Per-IP daily cap on new accounts; the slot is returned if sign-up fails.
    const ip = req.ip ?? 'unknown';
    await this.signups.take(ip);
    try {
      await this.handler(req, res);
    } catch (e) {
      await this.signups.release(ip);
      throw e;
    }
    if (res.statusCode >= 400) await this.signups.release(ip);
  }
}
