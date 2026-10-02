import { BadRequestException } from '@nestjs/common';
import {
  conversionFactor,
  pricePerUsageUnit,
} from '../ingredient/unit-conversion.js';
import {
  calculateHpp,
  ceilToRupiah,
  recommendedPrice,
} from './hpp-calculator.js';

describe('unit conversion', () => {
  it('converts kg->gram and liter->ml', () => {
    expect(conversionFactor('kg', 'gram')).toBe(1000);
    expect(conversionFactor('liter', 'ml')).toBe(1000);
    expect(conversionFactor('pack', 'gram')).toBe(1);
  });

  it('rejects incompatible units', () => {
    expect(() => conversionFactor('kg', 'ml')).toThrow(BadRequestException);
    expect(() => conversionFactor('pcs', 'gram')).toThrow(BadRequestException);
  });

  it('computes price per usage unit with 4 dp', () => {
    // 5 kg sugar for 72.500 -> 14.5 / gram
    expect(
      pricePerUsageUnit({
        purchaseUnit: 'kg',
        usageUnit: 'gram',
        purchaseQty: 5,
        purchasePrice: 72500,
      }).toString(),
    ).toBe('14.5');
    // 1 liter for 12.345 -> 12.345 / ml
    expect(
      pricePerUsageUnit({
        purchaseUnit: 'liter',
        usageUnit: 'ml',
        purchaseQty: 1,
        purchasePrice: 12345,
      }).toString(),
    ).toBe('12.345');
    // 3 pcs for 10.000 -> 3333.3333
    expect(
      pricePerUsageUnit({
        purchaseUnit: 'pcs',
        usageUnit: 'pcs',
        purchaseQty: 3,
        purchasePrice: 10000,
      }).toString(),
    ).toBe('3333.3333');
  });

  it('rejects zero quantity', () => {
    expect(() =>
      pricePerUsageUnit({
        purchaseUnit: 'kg',
        usageUnit: 'gram',
        purchaseQty: 0,
        purchasePrice: 1000,
      }),
    ).toThrow(BadRequestException);
  });
});

describe('calculateHpp', () => {
  it('divides batch ingredients by yield and adds overhead per portion', () => {
    const r = calculateHpp({
      yieldPortions: 10,
      ingredients: [
        { quantity: 1000, pricePerUsageUnit: '14.5' }, // 14.500
        { quantity: '250.5', pricePerUsageUnit: 2 }, // 501
      ],
      overheads: [{ costPerPortion: 500 }, { costPerPortion: '250.25' }],
    });
    expect(r.ingredientsPerPortion.toString()).toBe('1500.1');
    expect(r.overheadPerPortion.toString()).toBe('750.25');
    expect(r.hppPerPortion.toString()).toBe('2250.35');
  });

  it('avoids float drift (0.1 + 0.2)', () => {
    const r = calculateHpp({
      yieldPortions: 1,
      ingredients: [
        { quantity: 1, pricePerUsageUnit: '0.1' },
        { quantity: 1, pricePerUsageUnit: '0.2' },
      ],
      overheads: [],
    });
    expect(r.hppPerPortion.toString()).toBe('0.3');
  });

  it('rounds half up to 2 dp', () => {
    const r = calculateHpp({
      yieldPortions: 3,
      ingredients: [{ quantity: 1, pricePerUsageUnit: 10 }],
      overheads: [],
    });
    expect(r.hppPerPortion.toString()).toBe('3.33');
  });

  it('rejects invalid yield', () => {
    const base = { ingredients: [], overheads: [] };
    expect(() => calculateHpp({ ...base, yieldPortions: 0 })).toThrow();
    expect(() => calculateHpp({ ...base, yieldPortions: 1.5 })).toThrow();
  });
});

describe('recommendedPrice', () => {
  it('uses margin on selling price, not markup', () => {
    // HPP 6.500, margin 35% -> 10.000
    expect(recommendedPrice(6500, 35).toString()).toBe('10000');
    expect(recommendedPrice(1000, 0).toString()).toBe('1000');
    expect(recommendedPrice(1000, 30).toString()).toBe('1428.57');
  });

  it('rejects margin outside [0, 100)', () => {
    expect(() => recommendedPrice(1000, 100)).toThrow(RangeError);
    expect(() => recommendedPrice(1000, -1)).toThrow(RangeError);
  });
});

describe('ceilToRupiah', () => {
  it('rounds up to the step, keeps exact multiples', () => {
    expect(ceilToRupiah('13500', 500).toString()).toBe('13500');
    expect(ceilToRupiah('13500.01', 500).toString()).toBe('14000');
    expect(ceilToRupiah('1428.57', 500).toString()).toBe('1500');
    expect(ceilToRupiah(0, 500).toString()).toBe('0');
  });
});
