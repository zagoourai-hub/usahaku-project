import { createHash } from 'node:crypto';
import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  OnModuleDestroy,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Redis } from 'ioredis';

export const AUTH_COOKIE = 'access_token';

export interface AuthPayload {
  sub: string; // userId
  bid: string; // businessId
  exp?: number; // set by jwt on sign
}

/**
 * Logged-out tokens, kept in Redis until they would expire anyway.
 * Fails closed: if Redis is unreachable, authenticated requests error out.
 */
@Injectable()
export class TokenDenylist implements OnModuleDestroy {
  private readonly redis = new Redis(
    process.env.REDIS_URL || 'redis://localhost:6379',
    { maxRetriesPerRequest: 1, lazyConnect: true },
  );

  private key(token: string) {
    return `revoked:${createHash('sha256').update(token).digest('hex')}`;
  }

  async revoke(token: string, exp: number) {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await this.redis.set(this.key(token), '1', 'EX', ttl);
  }

  async isRevoked(token: string) {
    return (await this.redis.exists(this.key(token))) === 1;
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}

type AuthedRequest = Request & { auth?: AuthPayload };

const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** businessId of the logged-in user. Every query must be scoped by it. */
export const CurrentBusiness = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const auth = ctx.switchToHttp().getRequest<AuthedRequest>().auth;
    if (!auth) throw new UnauthorizedException();
    return auth.bid;
  },
);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const auth = ctx.switchToHttp().getRequest<AuthedRequest>().auth;
    if (!auth) throw new UnauthorizedException();
    return auth.sub;
  },
);

/** Registered globally: every route requires the JWT cookie unless @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly denylist: TokenDenylist,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[AUTH_COOKIE];
    if (typeof token !== 'string') throw new UnauthorizedException();
    try {
      req.auth = await this.jwt.verifyAsync<AuthPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (await this.denylist.isRevoked(token)) throw new UnauthorizedException();
    return true;
  }
}
