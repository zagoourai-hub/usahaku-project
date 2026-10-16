import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/auth.guard.js';
import { PrismaService } from './prisma/prisma.service.js';

/** Liveness + DB check for the reverse proxy / Coolify health check. */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle() // polled every few seconds by the proxy, cheap query
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
