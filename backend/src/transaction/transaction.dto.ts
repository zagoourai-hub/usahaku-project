import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsMoney, NOT_NULL, Trim } from '../dto.decorators.js';
import { CategoryType } from '../generated/prisma/client.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const IsDateOnly = () =>
  Matches(DATE_ONLY, { message: 'Format tanggal YYYY-MM-DD' });

export class CreateTransactionDto {
  /** Transaction type (INCOME/EXPENSE) follows the category. */
  @IsUUID()
  categoryId: string;

  @IsMoney(0.01)
  amount: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsDateOnly()
  @IsISO8601({ strict: true })
  transactionDate: string;

  /** INCOME only: the menu sold in this entry (manual sales-per-menu). null clears. */
  @IsOptional()
  @IsUUID()
  recipeId?: string | null;

  /** Required with `recipeId`. */
  @ValidateIf((o: CreateTransactionDto) => o.recipeId != null)
  @IsInt()
  @Min(1)
  @Max(100_000)
  portions?: number | null;
}

export class UpdateTransactionDto extends PartialType(
  CreateTransactionDto,
  NOT_NULL,
) {}

export class QueryTransactionDto {
  @IsOptional()
  @IsDateOnly()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateOnly()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
