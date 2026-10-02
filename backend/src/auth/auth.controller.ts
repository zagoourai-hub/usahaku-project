import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AUTH_COOKIE, Public } from './auth.guard.js';
import { LoginDto, RegisterDto } from './auth.dto.js';
import { AuthService, TOKEN_TTL_SECONDS } from './auth.service.js';

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setCookie(res, await this.auth.register(dto));
    return { ok: true };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setCookie(res, await this.auth.login(dto));
    return { ok: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[AUTH_COOKIE]);
    res.clearCookie(AUTH_COOKIE, cookieOptions());
    return { ok: true };
  }
}

function setCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    ...cookieOptions(),
    maxAge: TOKEN_TTL_SECONDS * 1000,
  });
}
