import {
  BadRequestException,
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
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsEnum, IsString, Length } from 'class-validator';
import { CurrentBusiness } from '../auth/auth.guard.js';
import { Trim } from '../dto.decorators.js';
import { CategoryType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SubscriptionModule,
  UsageService,
} from '../subscription/subscription.module.js';

export class CreateCategoryDto {
  @Trim()
  @IsString()
  @Length(1, 60)
  name: string;

  @IsEnum(CategoryType)
  type: CategoryType;
}

export class UpdateCategoryDto {
  @Trim()
  @IsString()
  @Length(1, 60)
  name: string;
}

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  list(businessId: string, type?: CategoryType) {
    return this.prisma.category.findMany({
      where: { businessId, type },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  create(businessId: string, dto: CreateCategoryDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.usage.assertCountQuota(tx, businessId, 'categories');
      return tx.category.create({
        data: { name: dto.name, type: dto.type, businessId },
      });
    });
  }

  async update(businessId: string, id: string, dto: UpdateCategoryDto) {
    await this.find(businessId, id);
    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  async remove(businessId: string, id: string) {
    const category = await this.find(businessId, id);
    if (category.isDefault) {
      throw new BadRequestException('Kategori bawaan tidak bisa dihapus');
    }
    const used = await this.prisma.transaction.count({
      where: { categoryId: id },
    });
    if (used) {
      throw new ConflictException(`Kategori dipakai ${used} transaksi`);
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async find(businessId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, businessId },
    });
    if (!category) throw new NotFoundException('Kategori tidak ditemukan');
    return category;
  }
}

@Controller('categories')
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  list(
    @CurrentBusiness() businessId: string,
    @Query('type', new ParseEnumPipe(CategoryType, { optional: true }))
    type?: CategoryType,
  ) {
    return this.categories.list(businessId, type);
  }

  @Post()
  create(
    @CurrentBusiness() businessId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categories.create(businessId, dto);
  }

  @Patch(':id')
  update(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(businessId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentBusiness() businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categories.remove(businessId, id);
  }
}

@Module({
  imports: [SubscriptionModule],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
