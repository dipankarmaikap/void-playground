import type { PaymentTerm } from '../organization/invoicing.ts';

/** Calendar day offsets for fixed payment terms. */
const TERM_DAYS: Record<Exclude<PaymentTerm, 'custom'>, number> = {
  due_on_receipt: 0,
  net_7: 7,
  net_15: 15,
  net_30: 30,
  net_60: 60,
};

/** The cached Kolkata day formatter; constructing one per call is measurable in loops. */
let kolkataDayFormatter: Intl.DateTimeFormat | null = null;

/** Today's calendar date as seen in the invoice timezone, independent of the server's zone. */
export function todayInKolkata(now: Date = new Date()): string {
  let formatter = (kolkataDayFormatter ??= new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }));
  let parts = formatter.formatToParts(now);
  let part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** True for a real ISO calendar date in `YYYY-MM-DD` form. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  let [year, month, day] = value.split('-').map(Number);
  let date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Adds whole calendar days to an ISO date without crossing into local-time rounding. */
export function addDays(date: string, days: number): string {
  let [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const MS_PER_DAY = 86_400_000;

/** Whole UTC calendar days between two ISO dates; anomalous negative intervals are ignored. */
export function daysBetween(invoiceDate: string, paymentDate: string): number | null {
  let start = Date.parse(`${invoiceDate}T00:00:00Z`);
  let end = Date.parse(`${paymentDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / MS_PER_DAY);
}

/** The due date a payment term suggests from the invoice date. Custom terms default to the same day. */
export function suggestDueDate(invoiceDate: string, term: string): string {
  if (term === 'custom') return invoiceDate;
  let days = TERM_DAYS[term as Exclude<PaymentTerm, 'custom'>];
  return days == null ? invoiceDate : addDays(invoiceDate, days);
}
