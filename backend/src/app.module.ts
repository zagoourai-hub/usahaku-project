import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import type { NextFunction, Request, Response } from 'express';
import { AiModule } from './ai/ai.service.js';
import { AuthModule } from './auth/auth.module.js';
import { BusinessModule } from './business/business.module.js';
import { HealthController } from './health.controller.js';
import { CategoryModule } from './category/category.module.js';
import { IngredientModule } from './ingredient/ingredient.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { OcrModule } from './ocr/ocr.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter.js';
import { PrismaModule } from './prisma/prisma.service.js';
import { RecipeModule } from './recipe/recipe.module.js';
import { ReportModule } from './report/report.module.js';
import { SubscriptionModule } from './subscription/subscription.module.js';
import { TransactionModule } from './transaction/transaction.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    PrismaModule,
    BullModule.forRootAsync({
      useFactory: () => {
        const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            db: Number(url.pathname.slice(1) || 0),
          },
        };
      },
    }),
    AiModule,
    AuthModule,
    BusinessModule,
    SubscriptionModule,
    IngredientModule,
    RecipeModule,
    CategoryModule,
    TransactionModule,
    ReportModule,
    OcrModule,
    PricingModule,
    NotificationModule,
    MaintenanceModule,
  ],
})
export class AppModule {}

/** Shared by main.ts and e2e tests so both run the same pipeline. */
export function configureApp(app: INestApplication) {
  // JSON API + receipt images: no framing, no MIME sniffing, no referrer leak.
  // ponytail: hand-rolled instead of helmet, whose default CORP would block
  // the frontend's cross-origin <img> of receipt photos.
  const securityHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    ...(process.env.NODE_ENV === 'production' && {
      'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
    }),
  };
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.set(securityHeaders);
    res.removeHeader('X-Powered-By');
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );
}
