/** Lowercase, drop punctuation and size tokens ("1kg", "500 gr"), collapse spaces. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|gr|g|ml|l|ltr|pcs)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.replace(/ /g, '');
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Sorensen-Dice similarity on character bigrams, 0..1. */
export function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bx = bigrams(x);
  const by = bigrams(y);
  let overlap = 0;
  for (const [g, n] of bx) overlap += Math.min(n, by.get(g) ?? 0);
  let total = 0;
  for (const n of bx.values()) total += n;
  for (const n of by.values()) total += n;
  const dice = total ? (2 * overlap) / total : 0;
  // "gula pasir" vs "gula": whole-word containment is a strong signal
  const contains = ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `);
  return contains ? Math.max(dice, 0.8) : dice;
}

export const MATCH_THRESHOLD = 0.6;

// ponytail: O(items x ingredients) scan; fine for a few hundred ingredients.
export function matchIngredient<T extends { id: string; name: string }>(
  itemName: string,
  ingredients: T[],
): T | undefined {
  let best: T | undefined;
  let bestScore = MATCH_THRESHOLD;
  for (const ing of ingredients) {
    const score = similarity(itemName, ing.name);
    if (score >= bestScore) {
      best = ing;
      bestScore = score;
    }
  }
  return best;
}
