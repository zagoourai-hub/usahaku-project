import { BadRequestException } from '@nestjs/common';
import {
  normalizeUnit,
  purchasePriceFromReceipt,
} from '../ingredient/unit-conversion.js';
import { matchIngredient, similarity } from './ingredient-matcher.js';

describe('normalizeUnit', () => {
  it('maps receipt spellings', () => {
    expect(normalizeUnit('KG')).toBe('kg');
    expect(normalizeUnit('gr.')).toBe('gram');
    expect(normalizeUnit('Ltr')).toBe('liter');
    expect(normalizeUnit('bks')).toBe('pack');
    expect(normalizeUnit('butir')).toBe('pcs');
    expect(normalizeUnit('dus')).toBeUndefined();
  });
});

describe('purchasePriceFromReceipt', () => {
  const sugar5kg = {
    purchaseUnit: 'kg',
    usageUnit: 'gram',
    purchaseQty: 5,
  } as const;

  it('same purchase unit: scales per-unit price to purchaseQty', () => {
    // 2 kg for 30.000 -> 15.000/kg -> 5 kg sack = 75.000
    const p = purchasePriceFromReceipt(sugar5kg, {
      qty: 2,
      unit: 'kg',
      price: 30000,
    });
    expect(p.toString()).toBe('75000');
  });

  it('usage unit on receipt: converts through price per gram', () => {
    // 500 gr for 8.000 -> 16/gram -> 5 kg = 80.000
    const p = purchasePriceFromReceipt(sugar5kg, {
      qty: 500,
      unit: 'gr',
      price: 8000,
    });
    expect(p.toString()).toBe('80000');
  });

  it('pack: price per pack regardless of purchaseQty', () => {
    const noodles = {
      purchaseUnit: 'pack',
      usageUnit: 'gram',
      purchaseQty: 250,
    } as const;
    const p = purchasePriceFromReceipt(noodles, {
      qty: 3,
      unit: 'bks',
      price: 10000,
    });
    expect(p.toString()).toBe('3333.33');
  });

  it('kg on receipt for a pack ingredient (grams per pack)', () => {
    const flourPack = {
      purchaseUnit: 'pack',
      usageUnit: 'gram',
      purchaseQty: 1000,
    } as const;
    // 2 kg for 26.000 -> 13/gram -> 1000 g pack = 13.000
    const p = purchasePriceFromReceipt(flourPack, {
      qty: 2,
      unit: 'kg',
      price: 26000,
    });
    expect(p.toString()).toBe('13000');
  });

  it('rejects incompatible or unknown units and zero qty', () => {
    const line = (unit: string, qty = 1) => ({ qty, unit, price: 1 });
    expect(() => purchasePriceFromReceipt(sugar5kg, line('liter'))).toThrow(
      BadRequestException,
    );
    expect(() => purchasePriceFromReceipt(sugar5kg, line('dus'))).toThrow(
      BadRequestException,
    );
    expect(() => purchasePriceFromReceipt(sugar5kg, line('kg', 0))).toThrow(
      BadRequestException,
    );
  });
});

describe('ingredient matcher', () => {
  const ingredients = [
    { id: '1', name: 'Gula Pasir' },
    { id: '2', name: 'Susu UHT' },
    { id: '3', name: 'Tepung Terigu' },
  ];

  it('matches noisy receipt names', () => {
    expect(matchIngredient('GULA PASIR 1KG', ingredients)?.id).toBe('1');
    expect(matchIngredient('susu uht 1L', ingredients)?.id).toBe('2');
    expect(matchIngredient('TPG TERIGU', ingredients)?.id).toBe('3');
  });

  it('returns nothing below threshold', () => {
    expect(matchIngredient('Kantong Plastik', ingredients)).toBeUndefined();
    expect(similarity('', 'gula')).toBe(0);
  });
});
