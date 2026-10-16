import { ExecutionContext, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
  type ThrottlerOptions,
} from '@nestjs/throttler';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { createAuth } from './auth.config.js';
import { AUTH } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { SessionGuard } from './auth.guard.js';
import { RedisThrottlerStorage, SignupLimiter } from './rate-limit.js';

/** Throttler that only applies to one exact auth endpoint. */
const onlyFor = (
  name: string,
  path: string,
  limit: number,
): ThrottlerOptions => ({
  name,
  ttl: 60_000,
  limit,
  skipIf: (ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Request>().path !== path,
});

@Module({
  imports: [
    // Global per-IP cap for every route (`default`); auth endpoints get their
    // own tighter counters. Routes can still tighten `default` with @Throttle.
    // Counters live in Redis (see RedisThrottlerStorage).
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: 120 },
          onlyFor('sign-up', '/auth/sign-up/email', 5),
          onlyFor('sign-in', '/auth/sign-in/email', 10),
        ],
        storage: new RedisThrottlerStorage(),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    SignupLimiter,
    {
      provide: AUTH,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => createAuth(prisma),
    },
    // Throttle first so unauthenticated floods are cut before session lookups.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
