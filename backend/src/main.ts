import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule, configureApp } from './app.module.js';

// Local dev reads .env; production injects env vars directly.
if (existsSync('.env')) process.loadEnvFile();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind a reverse proxy (Coolify/Traefik) req.ip is the proxy's IP, so the
  // login rate limit would be shared by every user. Set to the proxy hop count.
  // Leave unset when exposed directly, or X-Forwarded-For can spoof the IP.
  if (process.env.TRUST_PROXY_HOPS) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
  }
  configureApp(app);
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN, credentials: true });
  // SIGTERM on redeploy: let Nest close the queue worker, Redis and Prisma cleanly.
  app.enableShutdownHooks();
  const server = await app.listen(process.env.PORT ?? 4000);
  // Keep-alive must outlive the proxy's idle timeout (Traefik 60s), or reused
  // connections get reset and show up as random 502s. headersTimeout must exceed it.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}
await bootstrap();
