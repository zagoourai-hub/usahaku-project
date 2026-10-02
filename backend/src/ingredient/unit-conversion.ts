import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  type PurchaseUnit,
  type UsageUnit,
} from '../generated/prisma/client.js';

// How many usage units are in one purchase unit. `pack` has no fixed size:
// purchaseQty is already expressed in the usage unit (e.g. 1 pack = 250 gram).
const FACTORS: Record<PurchaseUnit, Partial<Record<UsageUnit, number>>> = {
  kg: { gram: 1000 },
  liter: { ml: 1000 },
  pcs: { pcs: 1 },
  pack: { gram: 1, ml: 1, pcs: 1 },
};

export function conversionFactor(from: PurchaseUnit, to: UsageUnit): number {
  const factor = FACTORS[from][to];
  if (factor === undefined) {
    throw new BadRequestException(
      `Satuan ${from} tidak bisa dikonversi ke ${to}`,
    );
  }
  return factor;
}

/** purchasePrice / (purchaseQty * factor), rounded to 4 dp (DB scale). */
export function pricePerUsageUnit(input: {
  purchaseUnit: PurchaseUnit;
  usageUnit: UsageUnit;
  purchaseQty: Prisma.Decimal | number | string;
  purchasePrice: Prisma.Decimal | number | string;
}): Prisma.Decimal {
  const qty = new Prisma.Decimal(input.purchaseQty).mul(
    conversionFactor(input.purchaseUnit, input.usageUnit),
  );
  if (qty.lte(0)) throw new BadRequestException('Isi per satuan harus > 0');
  return new Prisma.Decimal(input.purchasePrice)
    .div(qty)
    .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

// Unit spellings seen on Indonesian receipts -> canonical unit.
const UNIT_ALIASES: Record<string, PurchaseUnit | UsageUnit> = {
  kg: 'kg',
  kilo: 'kg',
  kilogram: 'kg',
  g: 'gram',
  gr: 'gram',
  grm: 'gram',
  gram: 'gram',
  l: 'liter',
  lt: 'liter',
  ltr: 'liter',
  liter: 'liter',
  litre: 'liter',
  ml: 'ml',
  pcs: 'pcs',
  pc: 'pcs',
  buah: 'pcs',
  bh: 'pcs',
  biji: 'pcs',
  butir: 'pcs',
  ea: 'pcs',
  pack: 'pack',
  pak: 'pack',
  pck: 'pack',
  bungkus: 'pack',
  bks: 'pack',
  sachet: 'pack',
};

export function normalizeUnit(
  unit: string,
): PurchaseUnit | UsageUnit | undefined {
  return UNIT_ALIASES[unit.trim().toLowerCase().replace(/\.$/, '')];
}

type Dec = Prisma.Decimal | number | string;

/**
 * New `purchasePrice` for an ingredient from one receipt line
 * (`price` = line total for `qty` x `unit`). purchasePrice always covers
 * `purchaseQty` purchase units (for `pack`: one pack of purchaseQty usage units).
 */
export function purchasePriceFromReceipt(
  ingredient: {
    purchaseUnit: PurchaseUnit;
    usageUnit: UsageUnit;
    purchaseQty: Dec;
  },
  line: { qty: Dec; unit: string; price: Dec },
): Prisma.Decimal {
  const D = Prisma.Decimal;
  const qty = new D(line.qty);
  if (qty.lte(0)) throw new BadRequestException('Jumlah item harus > 0');
  const unit = normalizeUnit(line.unit);
  const round = (d: Prisma.Decimal) => d.toDecimalPlaces(2, D.ROUND_HALF_UP);

  if (unit === ingredient.purchaseUnit) {
    const perPurchaseUnit = new D(line.price).div(qty);
    return round(
      ingredient.purchaseUnit === 'pack'
        ? perPurchaseUnit
        : perPurchaseUnit.mul(ingredient.purchaseQty),
    );
  }

  let usageQty: Prisma.Decimal;
  if (unit === ingredient.usageUnit) usageQty = qty;
  else if (unit === 'kg' || unit === 'liter' || unit === 'pcs') {
    usageQty = qty.mul(conversionFactor(unit, ingredient.usageUnit));
  } else {
    throw new BadRequestException(
      `Satuan struk "${line.unit}" tidak cocok dengan bahan (${ingredient.purchaseUnit}/${ingredient.usageUnit})`,
    );
  }
  const perUsageUnit = new D(line.price).div(usageQty);
  return round(
    perUsageUnit
      .mul(ingredient.purchaseQty)
      .mul(conversionFactor(ingredient.purchaseUnit, ingredient.usageUnit)),
  );
}
