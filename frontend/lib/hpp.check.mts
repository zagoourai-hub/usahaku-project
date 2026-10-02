// Run: node lib/hpp.check.mts  (Node >= 23 strips TS types natively)
// Cases mirror backend/src/recipe/hpp-calculator.spec.ts expectations.
import assert from "node:assert/strict";
import { calculateHpp, ceilToRupiah, centsToString, lineCost, recommendedPrice, toScaled } from "./hpp.ts";

assert.equal(toScaled("12.5", 3), 12500n);
assert.equal(toScaled("0.1234", 4), 1234n);
assert.equal(toScaled("abc", 2), 0n);

// Es Kopi Susu Aren: 18g espresso @177.7778/g? keep simple integer-ish prices
const r = calculateHpp({
  yieldPortions: 1,
  ingredients: [
    { quantity: "18", pricePerUsageUnit: "177.7778" }, // 3200.0004
    { quantity: "120", pricePerUsageUnit: "15" }, // 1800
    { quantity: "15", pricePerUsageUnit: "63.3333" }, // 949.9995
  ],
  overheads: [{ costPerPortion: "500" }],
});
assert.equal(centsToString(r.ingredientsPerPortion), "5950.00");
assert.equal(centsToString(r.hppPerPortion), "6450.00");

// Batch of 3 portions: 1000 / 3 = 333.333.. -> 333.33; + 0.005 overhead rounding happens on the sum
const b = calculateHpp({ yieldPortions: 3, ingredients: [{ quantity: "1", pricePerUsageUnit: "1000" }], overheads: [{ costPerPortion: "0.01" }] });
assert.equal(centsToString(b.ingredientsPerPortion), "333.33");
assert.equal(centsToString(b.hppPerPortion), "333.34");

// Half-up: 0.005 -> 0.01
const h = calculateHpp({ yieldPortions: 2, ingredients: [{ quantity: "0.001", pricePerUsageUnit: "10" }], overheads: [] });
assert.equal(centsToString(h.hppPerPortion), "0.01");

// Margin on price (not markup): 6450 / (1 - 0.64) = 17916.67
assert.equal(centsToString(recommendedPrice(645000n, "64")), "17916.67");
assert.equal(centsToString(recommendedPrice(645000n, "0")), "6450.00");

assert.equal(centsToString(lineCost("18", "177.7778")), "3200.00");
assert.equal(centsToString(ceilToRupiah(1791667n, 500)), "18000.00");
assert.equal(centsToString(ceilToRupiah(1800000n, 500)), "18000.00");

console.log("hpp.check: all assertions passed");
