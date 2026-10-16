import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH } from './auth.constants.js';
import type { Auth } from './auth.config.js';

export interface AuthPayload {
  sub: string; // userId
  bid: string; // businessId
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

/**
 * Registered globally: every route requires a valid Better Auth session
 * unless @Public(). Sessions live in the database, so sign-out revokes
 * immediately.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) throw new UnauthorizedException();
    const business = await this.prisma.business.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!business) throw new UnauthorizedException();
    req.auth = { sub: session.user.id, bid: business.id };
    return true;
  }
}
