import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNumber, Max, Min, ValidateIf } from 'class-validator';

/** Like @IsOptional but only skips `undefined`: null still fails validation (non-nullable columns). */
export const IsOptionalNotNull = () =>
  ValidateIf((_: unknown, value: unknown) => value !== undefined);

/** For PartialType on update DTOs: null is validated, not skipped. */
export const NOT_NULL = { skipNullProperties: false } as const;

/** Trims string input before validation. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Fits Decimal(14,2): max 12 integer digits, 2 decimals. */
export const IsMoney = (min = 0) =>
  applyDecorators(
    IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }),
    Min(min),
    Max(999_999_999_999.99),
  );

/** Fits Decimal(12,3), strictly positive. */
export const IsQuantity = () =>
  applyDecorators(
    IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false }),
    Min(0.001),
    Max(999_999_999.999),
  );
