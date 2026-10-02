import {
  BadRequestException,
  Body,
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
import { CurrentBusiness } from '../auth/auth.guard.js';
import type { CategoryType, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SubscriptionModule,
  UsageService,
} from '../subscription/subscription.module.js';
import {
  CreateTransactionDto,
  QueryTransactionDto,
  UpdateTransactionDto,
} from './transaction.dto.js';

const include = {
  category: { select: { id: true, name: true } },
  recipe: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  async list(businessId: string, q: QueryTransactionDto) {
    const where: Prisma.TransactionWhereInput = {
      businessId,
      categoryId: q.categoryId,
      type: q.type,
      transactionDate: {
        ...(q.from && { gte: new Date(q.from) }),
        ...(q.to && { lte: new Date(q.to) }),
      },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  async get(businessId: string, id: string) {
    const trx = await this.prisma.transaction.findFirst({
      where: { id, businessId },
      include,
    });
    if (!trx) throw new NotFoundException('Transaksi tidak ditemukan');
    return trx;
  }

  create(businessId: string, dto: CreateTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      const category = await ownedCategory(tx, businessId, dto.categoryId);
      await this.usage.consume(tx, businessId, 'transaction');
      return tx.transaction.create({
        data: {
          businessId,
          categoryId: category.id,
          type: category.type,
          amount: dto.amount,
          description: dto.description,
          transactionDate: new Date(dto.transactionDate),
          ...(await saleOf(tx, businessId, category.type, dto)),
        },
        include,
      });
    });
  }

  /** `source` is never changed: OCR transactions stay OCR after edits. */
  update(businessId: string, id: string, dto: UpdateTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.transaction.findFirst({
        where: { id, businessId },
        select: { type: true },
      });
      if (!current) throw new NotFoundException('Transaksi tidak ditemukan');
      const category =
        dto.categoryId && (await ownedCategory(tx, businessId, dto.categoryId));
      const type = category ? category.type : current.type;
      // Omitted recipeId keeps the sale, unless the entry became an expense.
      const sale =
        dto.recipeId !== undefined
          ? await saleOf(tx, businessId, type, dto)
          : type === 'EXPENSE'
            ? { recipeId: null, portions: null }
            : {};
      return tx.transaction.update({
        where: { id },
        data: {
          amount: dto.amount,
          description: dto.description,
          ...(dto.transactionDate && {
            transactionDate: new Date(dto.transactionDate),
          }),
          ...(category && { categoryId: category.id, type: category.type }),
          ...sale,
        },
        include,
      });
    });
  }

  async remove(businessId: string, id: string) {
    const { count } = await this.prisma.transaction.deleteMany({
      where: { id, businessId },
    });
    if (!count) throw new NotFoundException('Transaksi tidak ditemukan');
  }
}

async function ownedCategory(
  tx: Prisma.TransactionClient,
  businessId: string,
  categoryId: string,
) {
  const category = await tx.category.findFirst({
    where: { id: categoryId, businessId },
  });
  if (!category) throw new BadRequestException('Kategori tidak ditemukan');
  return category;
}

/** Validates the optional menu sale: INCOME only, recipe owned by the business. */
async function saleOf(
  tx: Prisma.TransactionClient,
  businessId: string,
  type: CategoryType,
  dto: { recipeId?: string | null; portions?: number | null },
) {
  if (!dto.recipeId) return { recipeId: null, portions: null };
  if (type !== 'INCOME') {
    throw new BadRequestException('Menu terjual hanya untuk pemasukan');
  }
  const found = await tx.recipe.count({
    where: { id: dto.recipeId, businessId },
  });
  if (!found) throw new BadRequestException('Resep tidak ditemukan');
  return { recipeId: dto.recipeId, portions: dto.portions! };
}

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactions: TransactionService) {}

  @Get()
  list(
    @CurrentBusiness() businessId: string,
    @Query() query: QueryTransactionDto,
  ) {
    return this.transactions.list(businessId, query);
  }

  @Get(':id')
  get(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactions.get(businessId, id);
  }

  @Post()
  create(
    @CurrentBusiness() businessId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactions.create(businessId, dto);
  }

  @Patch(':id')
  update(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactions.update(businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactions.remove(businessId, id);
  }
}

@Module({
  imports: [SubscriptionModule],
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}
