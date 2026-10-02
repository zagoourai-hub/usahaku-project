import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsMoney, IsQuantity, Trim } from '../dto.decorators.js';

export class ConfirmReceiptItemDto {
  @Trim()
  @IsString()
  @Length(1, 150)
  name: string;

  @IsQuantity()
  qty: number;

  @Trim()
  @IsString()
  @Length(1, 20)
  unit: string;

  /** Line total. */
  @IsMoney()
  price: number;

  @IsOptional()
  @IsUUID()
  ingredientId?: string | null;

  /** Also update the ingredient master price (logged as source OCR). */
  @IsOptional()
  @IsBoolean()
  updateIngredientPrice?: boolean;
}

export class ConfirmReceiptDto {
  /** EXPENSE category; defaults to "Belanja Bahan". */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsMoney(0.01)
  amount: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  transactionDate: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ConfirmReceiptItemDto)
  items: ConfirmReceiptItemDto[];
}
