import { Prisma } from '../generated/prisma/client.js';

type Num = Prisma.Decimal | number | string;
const D = Prisma.Decimal;

export interface HppInput {
  yieldPortions: number;
  ingredients: { quantity: Num; pricePerUsageUnit: Num }[];
  overheads: { costPerPortion: Num }[];
}

/**
 * HPP per portion = sum(qty * pricePerUsageUnit) / yieldPortions
 *                 + sum(overhead.costPerPortion), rounded to 2 dp.
 */
export function calculateHpp(input: HppInput) {
  if (!Number.isInteger(input.yieldPortions) || input.yieldPortions < 1) {
    throw new RangeError('yieldPortions must be a positive integer');
  }
  const ingredientsPerBatch = input.ingredients.reduce(
    (sum, i) => sum.add(new D(i.quantity).mul(i.pricePerUsageUnit)),
    new D(0),
  );
  const ingredientsPerPortion = ingredientsPerBatch.div(input.yieldPortions);
  const overheadPerPortion = input.overheads.reduce(
    (sum, o) => sum.add(o.costPerPortion),
    new D(0),
  );
  const round = (d: Prisma.Decimal) => d.toDecimalPlaces(2, D.ROUND_HALF_UP);
  return {
    ingredientsPerPortion: round(ingredientsPerPortion),
    overheadPerPortion: round(overheadPerPortion),
    hppPerPortion: round(ingredientsPerPortion.add(overheadPerPortion)),
  };
}

/** Rounds a price up to the next multiple of `step` (e.g. Rp 500). */
export function ceilToRupiah(price: Num, step: Num) {
  return new D(price).div(step).ceil().mul(step);
}

/** Margin on selling price (not markup): hpp / (1 - margin%). */
export function recommendedPrice(hpp: Num, targetMarginPct: Num) {
  const margin = new D(targetMarginPct);
  if (margin.lt(0) || margin.gte(100)) {
    throw new RangeError('targetMarginPct must be in [0, 100)');
  }
  return new D(hpp)
    .div(new D(1).sub(margin.div(100)))
    .toDecimalPlaces(2, D.ROUND_HALF_UP);
}
