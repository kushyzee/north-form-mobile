import { describe, expect, it } from 'vitest';

import {
  getAvailability,
  LOW_STOCK_THRESHOLD,
  productSchema,
} from '@/lib/catalogue-schema';
import { formatItemCount, formatNaira } from '@/lib/format';

const PRODUCT = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Essential Oxford',
  slug: 'essential-oxford',
  description: 'A shirt you will keep for years.',
  price: 28000,
  stockQuantity: 24,
  sizes: ['S', 'M'],
  images: [],
  featured: true,
  category: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Shirts',
    slug: 'shirts',
    description: null,
  },
};

/**
 * The pure helpers the catalogue UI depends on.
 *
 * Only the logic worth asserting on is covered here. The screen itself is
 * React Native and needs a renderer the project deliberately does not have — no
 * jsdom, no testing-library — and adding one for this phase was out of scope.
 * These functions are where a mistake would be silent: a wrong stock threshold
 * mislabels availability on every card, and a broken currency formatter renders
 * `NaN` or a bare number across the whole shop.
 */

describe('getAvailability', () => {
  it('treats zero stock as out of stock, not as missing data', () => {
    // `stock_quantity` has a `>= 0` check, so 0 is a real value. A card that
    // showed "Low stock" here would invite a tap that cannot succeed.
    expect(getAvailability(0)).toBe('out_of_stock');
  });

  it('treats negative stock as out of stock', () => {
    expect(getAvailability(-1)).toBe('out_of_stock');
  });

  it('reports low stock at and below the threshold', () => {
    expect(getAvailability(1)).toBe('low_stock');
    expect(getAvailability(LOW_STOCK_THRESHOLD)).toBe('low_stock');
  });

  it('reports in stock above the threshold', () => {
    expect(getAvailability(LOW_STOCK_THRESHOLD + 1)).toBe('in_stock');
    expect(getAvailability(24)).toBe('in_stock');
  });

  it('matches the web app threshold of 5', () => {
    expect(LOW_STOCK_THRESHOLD).toBe(5);
  });

  it('uses the same threshold for both low-stock boundaries', () => {
    expect(getAvailability(LOW_STOCK_THRESHOLD)).not.toBe(getAvailability(LOW_STOCK_THRESHOLD + 1));
  });
});

describe('formatNaira', () => {
  it('renders whole naira with the naira sign and thousands separators', () => {
    expect(formatNaira(28000)).toBe('₦28,000');
  });

  it('renders zero without a decimal fraction', () => {
    expect(formatNaira(0)).toBe('₦0');
  });

  it('drops the fraction on whole amounts, as the web app does', () => {
    // `price` is `numeric(12,2)`, so a fractional value can reach the client.
    // Whole-naira display is the storefront's existing convention.
    expect(formatNaira(28000.4)).toBe('₦28,000');
  });

  it('relies on the schema, not on itself, to reject a bad amount', () => {
    // `Intl` renders a non-finite amount as `₦NaN` / `₦∞`, so this formatter is
    // not defensive about it by design. The guarantee lives one layer up:
    // `productSchema` requires a finite, non-negative `price`, so no unvalidated
    // number reaches here. Asserted in `catalogue-api.test.ts`; restated so the
    // formatter's precondition is not mistaken for an oversight.
    expect(productSchema.safeParse({ ...PRODUCT, price: Number.NaN }).success).toBe(false);
    expect(
      productSchema.safeParse({ ...PRODUCT, price: Number.POSITIVE_INFINITY }).success
    ).toBe(false);
  });
});

describe('formatItemCount', () => {
  it('agrees in number with the singular and plural', () => {
    expect(formatItemCount(0)).toBe('0 items');
    expect(formatItemCount(1)).toBe('1 item');
    expect(formatItemCount(4)).toBe('4 items');
  });
});