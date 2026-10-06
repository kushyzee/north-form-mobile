/**
 * Presentation helpers, mirroring the web app's `lib/format.ts`.
 *
 * Nigerian Naira is formatted with the `en-NG` locale and `NGN` currency, which
 * renders as `₦28,000` — whole naira, no decimal noise. The web app formats
 * prices the same way in its storefront, so a price reads identically on both
 * surfaces. Keep the two in step.
 */

const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formats a naira amount for display.
 *
 * Expects a finite, non-negative number. `productSchema` enforces both, so no
 * unvalidated value reaches this function and there is no guard here for one —
 * the contract is checked at the boundary rather than re-checked downstream.
 */
export function formatNaira(amount: number): string {
  return nairaFormatter.format(amount);
}

/** "1 item" / "4 items". */
export function formatItemCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}