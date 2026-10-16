import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
} from '@nestjs/common';
import { CurrentBusiness } from '../auth/auth.guard.js';
import type { Prisma, Tier } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

// Initial numbers from PRD 10.5, to be tuned after market validation.
// null = unlimited.
export const TIER_LIMITS: Record<
  Tier,
  {
    recipes: number | null;
    ingredients: number | null;
    categories: number | null;
    transactionsPerMonth: number | null;
    ocrPerMonth: number | null;
    aiSuggestionsPerMonth: number | null;
    excelExport: boolean;
  }
> = {
  FREE: {
    recipes: 10,
    ingredients: 200, // caps list size, OCR matching cost and report/PDF rows
    categories: 30,
    transactionsPerMonth: 100,
    ocrPerMonth: 10,
    aiSuggestionsPerMonth: 5,
    excelExport: false,
  },
  PRO: {
    recipes: null,
    ingredients: 1000,
    categories: 100,
    transactionsPerMonth: null,
    ocrPerMonth: 300,
    aiSuggestionsPerMonth: 100, // not in PRD; proposed default
    excelExport: true,
  },
};

/** Monthly metered features: counter column, limit key, user-facing label. */
const METERS = {
  transaction: {
    counter: 'transactionCount',
    limit: 'transactionsPerMonth',
    label: 'transaksi',
  },
  ocr: { counter: 'ocrCount', limit: 'ocrPerMonth', label: 'scan struk' },
  aiSuggestion: {
    counter: 'aiSuggestionCount',
    limit: 'aiSuggestionsPerMonth',
    label: 'saran harga AI',
  },
} as const;
export type Meter = keyof typeof METERS;

/** Current usage period (YYYY-MM) in Indonesian time (WIB). */
export function currentPeriod(now = new Date()): string {
  return now.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 7);
}

export class QuotaExceededException extends HttpException {
  constructor(message: string) {
    super(
      { statusCode: 402, error: 'Payment Required', message },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async tier(businessId: string, db: Db = this.prisma): Promise<Tier> {
    const sub = await db.subscription.findFirst({
      where: { user: { business: { id: businessId } } },
    });
    const active =
      sub?.status === 'ACTIVE' &&
      (!sub.expiresAt || sub.expiresAt > new Date());
    return active ? sub.tier : 'FREE';
  }

  async limits(businessId: string, db: Db = this.prisma) {
    return TIER_LIMITS[await this.tier(businessId, db)];
  }

  // ponytail: count-then-insert can let 2 concurrent creates pass at the edge
  // (11 instead of 10 recipes). Acceptable for a soft product limit.
  async assertRecipeQuota(tx: Prisma.TransactionClient, businessId: string) {
    const { recipes } = await this.limits(businessId, tx);
    if (recipes === null) return;
    if ((await tx.recipe.count({ where: { businessId } })) >= recipes) {
      throw new QuotaExceededException(
        `Batas ${recipes} resep paket FREE tercapai. Upgrade ke PRO.`,
      );
    }
  }

  /** Total-count cap (not monthly) for ingredients/categories, checked inside the insert's tx. */
  async assertCountQuota(
    tx: Prisma.TransactionClient,
    businessId: string,
    kind: 'ingredients' | 'categories',
  ) {
    const tier = await this.tier(businessId, tx);
    const limit = TIER_LIMITS[tier][kind];
    if (limit === null) return;
    const count =
      kind === 'ingredients'
        ? await tx.ingredient.count({ where: { businessId } })
        : await tx.category.count({ where: { businessId } });
    if (count >= limit) {
      const label = kind === 'ingredients' ? 'bahan baku' : 'kategori';
      throw new QuotaExceededException(
        `Batas ${limit} ${label} paket ${tier} tercapai.${tier === 'FREE' ? ' Upgrade ke PRO.' : ''}`,
      );
    }
  }

  /**
   * Atomically increments this month's counter for `meter`. Must run inside
   * the same DB transaction as the insert: throwing rolls back both.
   * The upsert's row lock serializes concurrent creates.
   */
  async consume(
    tx: Prisma.TransactionClient,
    businessId: string,
    meter: Meter,
  ) {
    const { counter, limit: limitKey } = METERS[meter];
    const period = currentPeriod();
    const row = await tx.usageCounter.upsert({
      where: { businessId_period: { businessId, period } },
      create: { businessId, period, [counter]: 1 },
      update: { [counter]: { increment: 1 } },
    });
    const limits = await this.limits(businessId, tx);
    if (limits[limitKey] !== null && row[counter] > limits[limitKey]) {
      throw this.exceeded(meter, limits[limitKey]);
    }
  }

  /** Read-only pre-check, for work done before `consume` (e.g. a slow AI call). */
  async assertAvailable(businessId: string, meter: Meter) {
    const { counter, limit: limitKey } = METERS[meter];
    const limit = (await this.limits(businessId))[limitKey];
    if (limit === null) return;
    const row = await this.prisma.usageCounter.findUnique({
      where: { businessId_period: { businessId, period: currentPeriod() } },
    });
    if ((row?.[counter] ?? 0) >= limit) throw this.exceeded(meter, limit);
  }

  private exceeded(meter: Meter, limit: number) {
    return new QuotaExceededException(
      `Batas ${limit} ${METERS[meter].label}/bulan tercapai. Upgrade paket untuk menambah kuota.`,
    );
  }

  async summary(businessId: string) {
    const period = currentPeriod();
    const [tier, counter, recipeCount, ingredientCount, categoryCount] =
      await Promise.all([
        this.tier(businessId),
        this.prisma.usageCounter.findUnique({
          where: { businessId_period: { businessId, period } },
        }),
        this.prisma.recipe.count({ where: { businessId } }),
        this.prisma.ingredient.count({ where: { businessId } }),
        this.prisma.category.count({ where: { businessId } }),
      ]);
    const sub = await this.prisma.subscription.findFirst({
      where: { user: { business: { id: businessId } } },
      select: { tier: true, status: true, startedAt: true, expiresAt: true },
    });
    return {
      subscription: sub,
      effectiveTier: tier,
      limits: TIER_LIMITS[tier],
      usage: {
        period,
        recipes: recipeCount,
        ingredients: ingredientCount,
        categories: categoryCount,
        transactions: counter?.transactionCount ?? 0,
        ocr: counter?.ocrCount ?? 0,
        aiSuggestions: counter?.aiSuggestionCount ?? 0,
      },
    };
  }
}

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly usage: UsageService) {}

  @Get('me')
  me(@CurrentBusiness() businessId: string) {
    return this.usage.summary(businessId);
  }
}

@Module({
  controllers: [SubscriptionController],
  providers: [UsageService],
  exports: [UsageService],
})
export class SubscriptionModule {}
