import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        // Explicit limits: pg waits forever for a free connection by default.
        max: Number(process.env.DB_POOL_MAX ?? 10),
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 30_000,
        statement_timeout: 15_000, // a runaway query must not hold a connection
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
