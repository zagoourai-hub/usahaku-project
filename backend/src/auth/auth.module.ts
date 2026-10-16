import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard, TokenDenylist } from './auth.guard.js';
import { RedisThrottlerStorage, SignupLimiter } from './rate-limit.js';
import { TurnstileService } from './turnstile.js';
import { AuthService, TOKEN_TTL_SECONDS } from './auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET must be set (min 32 chars)');
        }
        return {
          secret,
          signOptions: { expiresIn: TOKEN_TTL_SECONDS, algorithm: 'HS256' },
          verifyOptions: { algorithms: ['HS256'] },
        };
      },
    }),
    // Global per-IP cap for every route; auth/AI/upload routes tighten it
    // with @Throttle. Counters live in Redis (see RedisThrottlerStorage).
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage: new RedisThrottlerStorage(),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenDenylist,
    SignupLimiter,
    TurnstileService,
    // Throttle first so unauthenticated floods are cut before JWT checks.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
