import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsString, Length } from 'class-validator';
import { CurrentBusiness } from '../auth/auth.guard.js';
import { IsMoney, IsQuantity, NOT_NULL, Trim } from '../dto.decorators.js';
import {
  type EntrySource,
  type Prisma,
  PurchaseUnit,
  UsageUnit,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecipeModule } from '../recipe/recipe.module.js';
import { RecipeService } from '../recipe/recipe.service.js';
import {
  SubscriptionModule,
  UsageService,
} from '../subscription/subscription.module.js';
import { pricePerUsageUnit } from './unit-conversion.js';

export class CreateIngredientDto {
  @Trim()
  @IsString()
  @Length(1, 150)
  name: string;

  @IsEnum(PurchaseUnit)
  purchaseUnit: PurchaseUnit;

  /** Content per purchase unit (kg/liter/pcs count, or usage units for `pack`). */
  @IsQuantity()
  purchaseQty: number;

  @IsEnum(UsageUnit)
  usageUnit: UsageUnit;

  @IsMoney()
  purchasePrice: number;
}

export class UpdateIngredientDto extends PartialType(
  CreateIngredientDto,
  NOT_NULL,
) {}

@Injectable()
export class IngredientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipes: RecipeService,
    private readonly usage: UsageService,
  ) {}

  list(businessId: string, q?: string) {
    return this.prisma.ingredient.findMany({
      where: {
        businessId,
        ...(q && { name: { contains: q, mode: 'insensitive' } }),
      },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { recipeItems: true } },
        // Latest + previous price: the list shows the last price change.
        priceLogs: {
          orderBy: { createdAt: 'desc' },
          take: 2,
          select: { purchasePrice: true, createdAt: true },
        },
      },
    });
  }

  async get(businessId: string, id: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id, businessId },
      include: {
        priceLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { recipeItems: true } },
      },
    });
    if (!ingredient) throw new NotFoundException('Bahan tidak ditemukan');
    return ingredient;
  }

  create(businessId: string, dto: CreateIngredientDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.usage.assertCountQuota(tx, businessId, 'ingredients');
      return tx.ingredient.create({
        data: {
          businessId,
          name: dto.name,
          purchaseUnit: dto.purchaseUnit,
          purchaseQty: dto.purchaseQty,
          usageUnit: dto.usageUnit,
          purchasePrice: dto.purchasePrice,
          pricePerUsageUnit: pricePerUsageUnit(dto),
          priceLogs: { create: { purchasePrice: dto.purchasePrice } },
        },
      });
    });
  }

  update(businessId: string, id: string, dto: UpdateIngredientDto) {
    return this.prisma.$transaction((tx) =>
      this.updateInTx(tx, businessId, id, dto),
    );
  }

  /**
   * Price change -> log (with source) + recalc HPP of every recipe using it.
   * Runs inside the caller's transaction (manual edit or OCR confirm).
   */
  async updateInTx(
    tx: Prisma.TransactionClient,
    businessId: string,
    id: string,
    dto: Omit<UpdateIngredientDto, 'purchasePrice'> & {
      purchasePrice?: Prisma.Decimal | number;
    },
    source: EntrySource = 'MANUAL',
  ) {
    const current = await tx.ingredient.findFirst({
      where: { id, businessId },
    });
    if (!current) throw new NotFoundException('Bahan tidak ditemukan');

    const ppu = pricePerUsageUnit({
      purchaseUnit: dto.purchaseUnit ?? current.purchaseUnit,
      usageUnit: dto.usageUnit ?? current.usageUnit,
      purchaseQty: dto.purchaseQty ?? current.purchaseQty,
      purchasePrice: dto.purchasePrice ?? current.purchasePrice,
    });
    const priceChanged =
      dto.purchasePrice !== undefined &&
      !current.purchasePrice.eq(dto.purchasePrice);

    const updated = await tx.ingredient.update({
      where: { id },
      data: {
        name: dto.name,
        purchaseUnit: dto.purchaseUnit,
        purchaseQty: dto.purchaseQty,
        usageUnit: dto.usageUnit,
        purchasePrice: dto.purchasePrice,
        pricePerUsageUnit: ppu,
        ...(priceChanged && {
          priceLogs: {
            create: { purchasePrice: dto.purchasePrice!, source },
          },
        }),
      },
    });
    if (!ppu.eq(current.pricePerUsageUnit)) {
      await this.recipes.recalcByIngredient(tx, id);
    }
    return updated;
  }

  async remove(businessId: string, id: string) {
    const ingredient = await this.get(businessId, id);
    if (ingredient._count.recipeItems > 0) {
      throw new ConflictException(
        `Bahan dipakai di ${ingredient._count.recipeItems} resep. Ubah resep dulu.`,
      );
    }
    // FK Restrict still guards the race where a recipe links it meanwhile (-> 409)
    await this.prisma.ingredient.delete({ where: { id } });
  }
}

@Controller('ingredients')
export class IngredientController {
  constructor(private readonly ingredients: IngredientService) {}

  @Get()
  list(@CurrentBusiness() businessId: string, @Query('q') q?: string) {
    return this.ingredients.list(businessId, q?.slice(0, 100));
  }

  @Get(':id')
  get(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ingredients.get(businessId, id);
  }

  @Post()
  create(
    @CurrentBusiness() businessId: string,
    @Body() dto: CreateIngredientDto,
  ) {
    return this.ingredients.create(businessId, dto);
  }

  @Patch(':id')
  update(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIngredientDto,
  ) {
    return this.ingredients.update(businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ingredients.remove(businessId, id);
  }
}

@Module({
  imports: [RecipeModule, SubscriptionModule],
  controllers: [IngredientController],
  providers: [IngredientService],
  exports: [IngredientService],
})
export class IngredientModule {}
