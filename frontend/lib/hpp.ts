// Exact live-preview HPP, mirroring backend/src/recipe/hpp-calculator.ts
// (Decimal, ROUND_HALF_UP to 2 dp). BigInt fixed-point avoids float drift in money.

/** "12.5" -> 12500n at scale 3. Invalid/empty input -> 0n. */
export function toScaled(value: string | number, scale: number): bigint {
  const s = String(value).trim();
  const m = /^(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return 0n;
  const frac = (m[2] ?? "").padEnd(scale, "0");
  // Extra digits beyond `scale` are truncated; inputs are validated to fit anyway.
  return BigInt(m[1] + frac.slice(0, scale));
}

/** num/den rounded half-up (both non-negative). */
function divRound(num: bigint, den: bigint): bigint {
  return (num * 2n + den) / (den * 2n);
}

/** Cents (bigint) -> "1234.56" for display/API. */
export function centsToString(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  return `${neg ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

export type HppInput = {
  yieldPortions: number;
  ingredients: { quantity: string; pricePerUsageUnit: string }[]; // qty 3dp, price 4dp
  overheads: { costPerPortion: string }[]; // 2dp
};

/** Amounts in cents. */
export function calculateHpp({ yieldPortions, ingredients, overheads }: HppInput) {
  const y = BigInt(Math.max(1, Math.floor(yieldPortions) || 1));
  // qty(3dp) * price(4dp) -> 7dp units
  const batch = ingredients.reduce((sum, i) => sum + toScaled(i.quantity, 3) * toScaled(i.pricePerUsageUnit, 4), 0n);
  const overheadCents = overheads.reduce((sum, o) => sum + toScaled(o.costPerPortion, 2), 0n);
  const toCents = 100_000n; // 7dp -> 2dp
  return {
    ingredientsPerPortion: divRound(batch, y * toCents),
    overheadPerPortion: overheadCents,
    // backend rounds the unrounded sum, not the sum of rounded parts
    hppPerPortion: divRound(batch + overheadCents * toCents * y, y * toCents),
  };
}

/** HPP / (1 - margin%). margin 0..99.99 (2dp). Returns cents. */
export function recommendedPrice(hppCents: bigint, marginPct: string | number): bigint {
  const m = toScaled(marginPct, 2); // 51.5% -> 5150n
  if (m >= 10_000n) return 0n;
  return divRound(hppCents * 10_000n, 10_000n - m);
}

/** Cost of one recipe line per batch (qty × price per usage unit), in cents. */
export function lineCost(quantity: string, pricePerUsageUnit: string): bigint {
  return divRound(toScaled(quantity, 3) * toScaled(pricePerUsageUnit, 4), 100_000n);
}

/** Round cents up to the next multiple of `step` rupiah (menu-friendly price). */
export function ceilToRupiah(cents: bigint, step: number): bigint {
  const s = BigInt(step) * 100n;
  return ((cents + s - 1n) / s) * s;
}
