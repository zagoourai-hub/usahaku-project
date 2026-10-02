import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { HppTrigger, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsageService } from '../subscription/subscription.module.js';
import { calculateHpp, recommendedPrice } from './hpp-calculator.js';
import type { CreateRecipeDto, UpdateRecipeDto } from './recipe.dto.js';

type Tx = Prisma.TransactionClient;

const detailInclude = {
  ingredients: {
    include: {
      ingredient: {
        select: {
          id: true,
          name: true,
          usageUnit: true,
          pricePerUsageUnit: true,
        },
      },
    },
  },
  overheads: true,
} as const;

@Injectable()
export class RecipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  async list(businessId: string, q?: string) {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        businessId,
        ...(q && { name: { contains: q, mode: 'insensitive' } }),
      },
      orderBy: { name: 'asc' },
    });
    return recipes.map((r) => ({
      ...r,
      recommendedPrice: recommendedPrice(r.currentHpp, r.targetMarginPct),
    }));
  }

  async get(businessId: string, id: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, businessId },
      include: detailInclude,
    });
    if (!recipe) throw new NotFoundException('Resep tidak ditemukan');
    const breakdown = calculateHpp({
      yieldPortions: recipe.yieldPortions,
      ingredients: recipe.ingredients.map((i) => ({
        quantity: i.quantity,
        pricePerUsageUnit: i.ingredient.pricePerUsageUnit,
      })),
      overheads: recipe.overheads,
    });
    return {
      ...recipe,
      breakdown,
      recommendedPrice: recommendedPrice(
        recipe.currentHpp,
        recipe.targetMarginPct,
      ),
    };
  }

  async create(businessId: string, dto: CreateRecipeDto) {
    const id = await this.prisma.$transaction(async (tx) => {
      await this.usage.assertRecipeQuota(tx, businessId);
      await assertIngredientsOwned(tx, businessId, dto.ingredients);
      const recipe = await tx.recipe.create({
        data: {
          businessId,
          name: dto.name,
          category: dto.category === '' ? null : dto.category,
          yieldPortions: dto.yieldPortions,
          targetMarginPct: dto.targetMarginPct,
          sellingPrice: dto.sellingPrice,
          isActive: dto.isActive,
          ingredients: { create: dto.ingredients },
          overheads: { create: dto.overheads ?? [] },
        },
      });
      await this.recalc(tx, recipe.id, 'RECIPE_EDIT', true);
      return recipe.id;
    });
    return this.get(businessId, id);
  }

  async update(businessId: string, id: string, dto: UpdateRecipeDto) {
    await this.prisma.$transaction(async (tx) => {
      await this.assertOwned(tx, businessId, id);
      if (dto.ingredients) {
        await assertIngredientsOwned(tx, businessId, dto.ingredients);
      }
      await tx.recipe.update({
        where: { id },
        data: {
          name: dto.name,
          category: dto.category === '' ? null : dto.category,
          yieldPortions: dto.yieldPortions,
          targetMarginPct: dto.targetMarginPct,
          sellingPrice: dto.sellingPrice,
          isActive: dto.isActive,
          ...(dto.ingredients && {
            ingredients: { deleteMany: {}, create: dto.ingredients },
          }),
          ...(dto.overheads && {
            overheads: { deleteMany: {}, create: dto.overheads },
          }),
        },
      });
      await this.recalc(tx, id, 'RECIPE_EDIT');
    });
    return this.get(businessId, id);
  }

  async remove(businessId: string, id: string) {
    const { count } = await this.prisma.recipe.deleteMany({
      where: { id, businessId },
    });
    if (!count) throw new NotFoundException('Resep tidak ditemukan');
  }

  async history(businessId: string, id: string) {
    await this.assertOwned(this.prisma, businessId, id);
    return this.prisma.hppSnapshot.findMany({
      where: { recipeId: id },
      orderBy: { createdAt: 'asc' },
      select: { hppPerPortion: true, trigger: true, createdAt: true },
    });
  }

  /** Called inside the ingredient price-update transaction. */
  async recalcByIngredient(tx: Tx, ingredientId: string) {
    const recipes = await tx.recipe.findMany({
      where: { ingredients: { some: { ingredientId } } },
      select: { id: true },
    });
    for (const r of recipes) await this.recalc(tx, r.id, 'PRICE_CHANGE');
  }

  /** Recomputes cached HPP; snapshots when it changed (or `force`). */
  private async recalc(tx: Tx, id: string, trigger: HppTrigger, force = false) {
    const recipe = await tx.recipe.findUniqueOrThrow({
      where: { id },
      include: detailInclude,
    });
    const { hppPerPortion } = calculateHpp({
      yieldPortions: recipe.yieldPortions,
      ingredients: recipe.ingredients.map((i) => ({
        quantity: i.quantity,
        pricePerUsageUnit: i.ingredient.pricePerUsageUnit,
      })),
      overheads: recipe.overheads,
    });
    if (!force && hppPerPortion.eq(recipe.currentHpp)) return;
    await tx.recipe.update({
      where: { id },
      data: { currentHpp: hppPerPortion },
    });
    await tx.hppSnapshot.create({
      data: { recipeId: id, hppPerPortion, trigger },
    });
  }

  private async assertOwned(
    db: Tx | PrismaService,
    businessId: string,
    id: string,
  ) {
    const found = await db.recipe.count({ where: { id, businessId } });
    if (!found) throw new NotFoundException('Resep tidak ditemukan');
  }
}

/** Rejects ingredient ids that don't belong to this business. */
async function assertIngredientsOwned(
  tx: Tx,
  businessId: string,
  items: { ingredientId: string }[],
) {
  const ids = items.map((i) => i.ingredientId);
  if (!ids.length) return;
  const owned = await tx.ingredient.count({
    where: { id: { in: ids }, businessId },
  });
  if (owned !== new Set(ids).size) {
    throw new BadRequestException('Bahan baku tidak ditemukan');
  }
}
