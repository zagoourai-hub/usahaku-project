const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const rupiahCents = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Display-only, sign stripped (callers add +/−). "Rp 12.500", or "Rp 3.412,50" when
 * there are cents — never silently round money. API Decimals arrive as strings.
 */
export function formatIDR(value: number | string): string {
  const n = Math.abs(Number(value));
  return `Rp ${(Math.round(n * 100) % 100 === 0 ? rupiah : rupiahCents).format(n)}`;
}

/** Local-calendar YYYY-MM-DD (not UTC), matching the backend's DATE columns. */
export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgo(n: number, from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

export function formatPct(value: number): string {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}
