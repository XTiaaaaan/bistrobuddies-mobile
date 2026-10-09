/** Philippine peso formatting shared by every price shown in the app. */
export const PESO_LOCALE = 'en-PH';

/**
 * Formats a PHP amount as `₱1,234.50`. Missing or invalid amounts render as
 * an em dash so a price is never displayed as `₱NaN` or `₱undefined`.
 */
export function formatPeso(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  return `₱${value.toLocaleString(PESO_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
