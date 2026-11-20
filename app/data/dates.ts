/**
 * Shared date display formatters used by more than one route's pages. Screens speak
 * human: HTML renders these labels, while form inputs (`type="date"` values and
 * `min`/`max` attributes) and PDF documents keep the stored `YYYY-MM-DD` form.
 * Calendar-day math on ISO dates lives in `app/data/invoices/dates.ts`.
 */

/** A stored `YYYY-MM-DD` calendar date as a human label, e.g. "Oct 01, 2026". */
export function formatIsoDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** A Unix-ms timestamp as a medium Indian date with a short IST time, e.g. "21 Nov 2026, 2:30 pm". */
export function formatKolkataTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
