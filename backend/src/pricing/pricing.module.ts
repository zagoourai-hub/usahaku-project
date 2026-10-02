import {
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AiService } from '../ai/ai.service.js';
import { CurrentBusiness } from '../auth/auth.guard.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ceilToRupiah, recommendedPrice } from '../recipe/hpp-calculator.js';
import { RecipeModule } from '../recipe/recipe.module.js';
import { RecipeService } from '../recipe/recipe.service.js';
import {
  SubscriptionModule,
  UsageService,
} from '../subscription/subscription.module.js';

// Prices are quoted in steps of Rp 500.
const STEP = 500;
// The model has no market data, so this is fixed text instead of something it might invent.
const COMPETITOR_NOTE =
  'Ini perkiraan dari hitungan modal, bukan data pesaing: cek juga harga menu serupa di sekitarmu.';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipes: RecipeService,
    private readonly usage: UsageService,
    private readonly ai: AiService,
  ) {}

  // ponytail: quota is pre-checked, then consumed after the (slow) AI call so
  // failed calls don't burn quota. Concurrent requests at the edge may get 1 extra.
  async suggest(businessId: string, recipeId: string) {
    const recipe = await this.recipes.get(businessId, recipeId); // scoped, 404
    await this.usage.assertAvailable(businessId, 'aiSuggestion');
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { type: true, city: true },
    });

    // Computed from HPP + margin, never by the model: the target margin price, and a floor
    // that still earns half the target margin.
    const rec = ceilToRupiah(recipe.recommendedPrice, STEP);
    const min = ceilToRupiah(
      recommendedPrice(recipe.currentHpp, recipe.targetMarginPct.div(2)),
      STEP,
    );
    const out = await this.ai.suggestPrice({
      recipeName: recipe.name,
      businessType: business.type,
      city: business.city,
      hppPerPortion: recipe.currentHpp.toString(),
      targetMarginPct: recipe.targetMarginPct.toString(),
      minPrice: min.toString(),
      recommendedPrice: rec.toString(),
      currentSellingPrice: recipe.sellingPrice?.toString() ?? null,
      ingredients: recipe.ingredients.map((i) => ({
        name: i.ingredient.name,
        quantity: i.quantity.toString(),
        unit: i.ingredient.usageUnit,
      })),
    });
    // Model ceiling at or below HPP means a loss (or a unit slip like 18 instead of 18000).
    if (rec.lte(0) || new Prisma.Decimal(out.maxPrice).lte(recipe.currentHpp)) {
      throw new ServiceUnavailableException('Saran harga AI tidak valid');
    }
    const max = ceilToRupiah(Prisma.Decimal.max(out.maxPrice, rec), STEP);

    return this.prisma.$transaction(async (tx) => {
      await this.usage.consume(tx, businessId, 'aiSuggestion');
      return tx.priceSuggestion.create({
        data: {
          recipeId,
          hppAtRequest: recipe.currentHpp,
          minPrice: min,
          recommendedPrice: rec,
          maxPrice: max,
          reasoning: `${out.reasoning.trim()} ${COMPETITOR_NOTE}`,
          model: this.ai.modelId,
        },
      });
    });
  }

  async list(businessId: string, recipeId: string) {
    await this.recipes.get(businessId, recipeId); // scoped, 404
    return this.prisma.priceSuggestion.findMany({
      where: { recipeId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
}

@Controller('recipes')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  // Quota is only consumed after the slow AI call, so parallel requests could each
  // trigger a model call; cap the burst per client.
  @Post(':id/price-suggestion')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  suggest(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pricing.suggest(businessId, id);
  }

  @Get(':id/price-suggestions')
  list(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pricing.list(businessId, id);
  }
}

@Module({
  imports: [RecipeModule, SubscriptionModule],
  controllers: [PricingController],
  providers: [PricingService],
})
export class PricingModule {}
