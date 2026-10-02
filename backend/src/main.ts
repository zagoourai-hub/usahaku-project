import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule, configureApp } from './app.module.js';

// Local dev reads .env; production injects env vars directly.
if (existsSync('.env')) process.loadEnvFile();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN, credentials: true });
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
