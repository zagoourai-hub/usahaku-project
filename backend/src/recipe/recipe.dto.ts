import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsMoney, IsQuantity, Trim } from '../dto.decorators.js';

export class RecipeIngredientDto {
  @IsUUID()
  ingredientId: string;

  /** In the ingredient's usage unit, per batch. */
  @IsQuantity()
  quantity: number;
}

export class RecipeOverheadDto {
  @Trim()
  @IsString()
  @Length(1, 100)
  name: string;

  @IsMoney()
  costPerPortion: number;
}

export class CreateRecipeDto {
  @Trim()
  @IsString()
  @Length(1, 150)
  name: string;

  /** Menu group, e.g. "Minuman". null or "" clears it. */
  @IsOptional()
  @Trim()
  @IsString()
  @Length(0, 60)
  category?: string | null;

  @IsInt()
  @Min(1)
  @Max(100_000)
  yieldPortions: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99.99)
  targetMarginPct: number;

  @IsOptional()
  @IsMoney()
  sellingPrice?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((i: RecipeIngredientDto) => i.ingredientId, {
    message: 'Bahan tidak boleh duplikat',
  })
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RecipeOverheadDto)
  overheads?: RecipeOverheadDto[];
}

/** Omitted arrays are left unchanged; provided arrays replace the old list. */
export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {}
