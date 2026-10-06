import { describe, expect, it } from 'vitest';

import type { Cart } from '@/lib/cart-schema';
import { LOW_STOCK_THRESHOLD } from '@/lib/catalogue-schema';
import {
  availabilityLabel,
  availabilitySummary,
  availableToAdd,
  canAddToCart,
  canDecrement,
  canIncrement,
  cartAddConfirmation,
  clampQuantity,
  maxQuantityFor,
  MIN_QUANTITY,
  quantityInCart,
} from '@/lib/product-detail';

/**
 * The product-detail screen's pure logic.
 *
 * These are the rules a mistake would make **silently**. A stepper that can be
 * driven to `0` looks identical in a screenshot to one that cannot, and only
 * fails when the cart API answers `400`. A stepper capped at the wrong number
 * likewise only fails at the moment a shopper is refused with
 * `INSUFFICIENT_STOCK` — after they believed they had added the item.
 *
 * The screen itself is React Native and needs a renderer this project
 * deliberately does not have, so its logic is asserted here and its wiring is
 * verified by typecheck and bundling.
 */

const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';

function cartWith(
  lines: { productId: string; size: string; quantity: number }[]
): Cart {
  return {
    items: lines.map((line) => ({
      lineId: `${line.productId}::${line.size}`,
      productId: line.productId,
      productSlug: 'essential-oxford',
      productName: 'Essential Oxford',
      productImage: null,
      categoryName: 'Shirts',
      unitPrice: 28000,
      size: line.size,
      quantity: line.quantity,
      maxQuantity: 24,
    })),
    itemCount: lines.reduce((total, line) => total + line.quantity, 0),
    subtotal: 0,
  };
}

describe('maxQuantityFor', () => {
  it('uses the product stock as the ceiling', () => {
    expect(maxQuantityFor(24)).toBe(24);
  });

  it('is zero for an out-of-stock product', () => {
    expect(maxQuantityFor(0)).toBe(0);
  });

  it('never goes negative, even for a negative stock', () => {
    // The schema forbids negative stock, so this is defensive rather than
    // reachable. It matters because a negative ceiling would let the clamp
    // arithmetic produce a quantity below the floor.
    expect(maxQuantityFor(-5)).toBe(0);
  });

  it('truncates a fractional stock rather than permitting a partial unit', () => {
    expect(maxQuantityFor(3.9)).toBe(3);
  });

  it('falls back to the floor for a non-finite stock', () => {
    expect(maxQuantityFor(Number.NaN)).toBe(MIN_QUANTITY);
  });
});

describe('quantityInCart', () => {
  const cart = cartWith([
    { productId: PRODUCT_ID, size: 'M', quantity: 2 },
    { productId: PRODUCT_ID, size: 'L', quantity: 1 },
  ]);

  it('reads the quantity of the matching product and size', () => {
    expect(quantityInCart(cart, PRODUCT_ID, 'M')).toBe(2);
  });

  it('is zero for a size that is not in the cart', () => {
    expect(quantityInCart(cart, PRODUCT_ID, 'S')).toBe(0);
  });

  it('is zero when the cart has not loaded', () => {
    // The initial `getCart()` is outstanding or failed. A shopper must still be
    // able to add an item rather than being blocked by an unknown cart.
    expect(quantityInCart(null, PRODUCT_ID, 'M')).toBe(0);
  });

  it('does not let another size of the same product consume this one', () => {
    // Cart lines are keyed by (productId, size), so an L line says nothing about
    // how much M is available. Counting both would hide real stock.
    expect(quantityInCart(cart, PRODUCT_ID, 'L')).toBe(1);
    expect(quantityInCart(cartWith([{ productId: PRODUCT_ID, size: 'L', quantity: 4 }]), PRODUCT_ID, 'M'))
      .toBe(0);
  });

  it('ignores a different product entirely', () => {
    expect(quantityInCart(cart, 'other-product-id', 'M')).toBe(0);
  });
});

describe('availableToAdd — the ceiling accounts for what is already in the cart', () => {
  /**
   * The server checks the **resulting** total, not the requested amount:
   *
   * ```sql
   * v_total := coalesce(v_current, 0) + p_quantity;
   * if v_total > v_stock then raise exception 'INSUFFICIENT_STOCK';
   * ```
   *
   * (`supabase/migrations/20261003190000_add_cart_migration_id.sql:139-152`)
   *
   * So a shopper already holding 2 of 5 in stock has 3 left, and a stepper capped
   * at 5 would offer them a quantity guaranteed to fail.
   */
  it('is the full stock when the line is not yet in the cart', () => {
    expect(availableToAdd(null, PRODUCT_ID, 'M', 5)).toBe(5);
    expect(availableToAdd(cartWith([{ productId: PRODUCT_ID, size: 'M', quantity: 2 }]), PRODUCT_ID, 'S', 5))
      .toBe(5);
  });

  it('subtracts what is already held in that exact size', () => {
    expect(availableToAdd(cartWith([{ productId: PRODUCT_ID, size: 'M', quantity: 2 }]), PRODUCT_ID, 'M', 5))
      .toBe(3);
  });

  it('is zero once the cart holds all the stock for that size', () => {
    expect(availableToAdd(cartWith([{ productId: PRODUCT_ID, size: 'M', quantity: 5 }]), PRODUCT_ID, 'M', 5))
      .toBe(0);
  });

  it('never goes negative if the cart somehow exceeds the stock', () => {
    // Stock may have shrunk since the cart was written. A negative ceiling would
    // let the clamp arithmetic produce an invalid quantity.
    expect(availableToAdd(cartWith([{ productId: PRODUCT_ID, size: 'M', quantity: 9 }]), PRODUCT_ID, 'M', 5))
      .toBe(0);
  });

  it('falls back to full stock before a size is chosen', () => {
    // Nothing to subtract until the size is known; the stepper is not rendered
    // in this state anyway.
    expect(availableToAdd(cartWith([{ productId: PRODUCT_ID, size: 'M', quantity: 2 }]), PRODUCT_ID, null, 5))
      .toBe(5);
  });

  it('leaves another size of the same product fully available', () => {
    // Stock is per product but the line is per size: the server compares the
    // requested *size's* line against total product stock, so 2 × M already in
    // the cart does not reduce what may be added in L.
    const cart = cartWith([{ productId: PRODUCT_ID, size: 'M', quantity: 4 }]);
    expect(availableToAdd(cart, PRODUCT_ID, 'L', 5)).toBe(5);
  });

  it('is zero for an out-of-stock product regardless of the cart', () => {
    expect(availableToAdd(null, PRODUCT_ID, 'M', 0)).toBe(0);
  });
});

describe('clampQuantity', () => {
  it('holds the floor at 1, never 0', () => {
    // 0 is the value the cart API rejects, and the one a decrement bug produces.
    expect(clampQuantity(1, 24)).toBe(1);
    expect(clampQuantity(0, 24)).toBe(1);
    expect(clampQuantity(-1, 24)).toBe(1);
  });

  it('never allows more than the ceiling', () => {
    expect(clampQuantity(999, 24)).toBe(24);
    expect(clampQuantity(3, 2)).toBe(2);
  });

  it('leaves an in-range quantity untouched', () => {
    expect(clampQuantity(5, 24)).toBe(5);
    expect(clampQuantity(24, 24)).toBe(24);
  });

  it('truncates a fractional quantity, since units are whole', () => {
    expect(clampQuantity(2.7, 24)).toBe(2);
  });

  it('returns the floor rather than 0 when the ceiling is 0', () => {
    // The stepper is hidden in this state, so 0 is never shown or sent — but a
    // helper that could hand back 0 is one refactor away from sending it.
    expect(clampQuantity(5, 0)).toBe(MIN_QUANTITY);
    expect(clampQuantity(1, 0)).toBe(MIN_QUANTITY);
  });

  it('falls back to the floor for any non-finite quantity', () => {
    // `Infinity` is treated as nonsense rather than clamped down to the ceiling:
    // both are unreachable from the stepper, and the floor is the value that
    // cannot send an invalid request.
    expect(clampQuantity(Number.NaN, 24)).toBe(MIN_QUANTITY);
    expect(clampQuantity(Number.POSITIVE_INFINITY, 24)).toBe(MIN_QUANTITY);
    expect(clampQuantity(Number.NEGATIVE_INFINITY, 24)).toBe(MIN_QUANTITY);
  });

  it('falls back to the floor for a non-finite ceiling', () => {
    expect(clampQuantity(5, Number.NaN)).toBe(MIN_QUANTITY);
  });

  it('never produces an out-of-range value for any input, at any ceiling', () => {
    // The property the stepper actually depends on, asserted across a grid
    // rather than case by case.
    for (const ceiling of [0, 1, 2, 5, 24]) {
      for (const quantity of [-5, 0, 1, 2, 7, 24, 1000]) {
        const result = clampQuantity(quantity, ceiling);
        expect(result).toBeGreaterThanOrEqual(MIN_QUANTITY);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeLessThanOrEqual(Math.max(1, ceiling));
      }
    }
  });
});

describe('canIncrement / canDecrement', () => {
  it('disables increment once the ceiling is reached', () => {
    expect(canIncrement(23, 24)).toBe(true);
    expect(canIncrement(24, 24)).toBe(false);
    expect(canIncrement(25, 24)).toBe(false);
  });

  it('disables increment entirely when nothing more may be added', () => {
    expect(canIncrement(1, 0)).toBe(false);
  });

  it('disables decrement at the floor of 1', () => {
    // Removal is the cart screen's job; this control adds, it does not subtract
    // a line down to nothing.
    expect(canDecrement(1)).toBe(false);
    expect(canDecrement(2)).toBe(true);
  });

  it('disables decrement for a non-finite quantity', () => {
    expect(canDecrement(Number.NaN)).toBe(false);
  });

  it('allows a full round trip down to 1 and back up to the ceiling', () => {
    let quantity = 1;
    const ceiling = 5;

    while (canDecrement(quantity)) quantity = clampQuantity(quantity - 1, ceiling);
    expect(quantity).toBe(1);

    while (canIncrement(quantity, ceiling)) quantity = clampQuantity(quantity + 1, ceiling);
    expect(quantity).toBe(ceiling);
  });
});

describe('availabilityLabel', () => {
  it('says Sold out at zero stock', () => {
    expect(availabilityLabel(0)).toBe('Sold out');
  });

  it('counts the units left at low stock', () => {
    expect(availabilityLabel(LOW_STOCK_THRESHOLD)).toBe('Low stock — 5 left');
    expect(availabilityLabel(1)).toBe('Low stock — 1 left');
  });

  it('is silent for a healthy product rather than adding noise', () => {
    // The detail page states stock via `availabilitySummary`; a permanent
    // "In stock" badge would be noise on a page that is entirely purchasable.
    expect(availabilityLabel(LOW_STOCK_THRESHOLD + 1)).toBeNull();
    expect(availabilityLabel(24)).toBeNull();
  });

  it('never reports low stock above the threshold', () => {
    for (const stock of [6, 7, 24, 100]) {
      expect(availabilityLabel(stock)).toBeNull();
    }
  });
});

describe('availabilitySummary', () => {
  it('distinguishes all three states', () => {
    expect(availabilitySummary(0)).toMatch(/sold out/i);
    expect(availabilitySummary(LOW_STOCK_THRESHOLD)).toMatch(/low stock/i);
    expect(availabilitySummary(24)).toMatch(/in stock/i);
  });

  it('states the unit count for the states where the count matters', () => {
    expect(availabilitySummary(3)).toContain('3');
    expect(availabilitySummary(10)).toContain('10');
  });

  it('does not claim a per-size count, because stock is per product', () => {
    // There is no per-size stock column in the schema. Wording that implied
    // anything about an individual size would be inventing data.
    expect(availabilitySummary(LOW_STOCK_THRESHOLD)).not.toMatch(/per size|each size|in this size/i);
  });
});

describe('canAddToCart', () => {
  const ready = {
    stockQuantity: 24,
    size: 'M' as string | null,
    max: 24,
    submitting: false,
  };

  it('allows the add once a size is chosen', () => {
    expect(canAddToCart(ready)).toBe(true);
  });

  it('blocks the add until a size is chosen', () => {
    expect(canAddToCart({ ...ready, size: null })).toBe(false);
    expect(canAddToCart({ ...ready, size: '' })).toBe(false);
  });

  it('blocks the add for an out-of-stock product', () => {
    expect(canAddToCart({ ...ready, stockQuantity: 0 })).toBe(false);
  });

  it('blocks the add once the cart already holds all the stock for that size', () => {
    // Without this, a shopper holding all 5 units would tap a live button and be
    // refused with INSUFFICIENT_STOCK for a request they had no way to make valid.
    expect(canAddToCart({ ...ready, max: 0 })).toBe(false);
  });

  it('blocks a second press while the mutation is in flight', () => {
    // Without this, a double tap would start two increments.
    expect(canAddToCart({ ...ready, submitting: true })).toBe(false);
  });

  it('blocks the add when the size is missing even mid-submission', () => {
    expect(canAddToCart({ ...ready, size: null, submitting: true })).toBe(false);
  });
});

describe('cartAddConfirmation', () => {
  const base = { productName: 'Studio Hoodie', size: 'XL', alreadyInCart: 0, added: 1 };

  it('states the resulting total for a first add', () => {
    expect(cartAddConfirmation(base)).toBe('1 unit of Studio Hoodie (XL) in your cart.');
  });

  it('uses the singular only at exactly one', () => {
    expect(cartAddConfirmation({ ...base, added: 2 })).toContain('2 units');
    expect(cartAddConfirmation({ ...base, alreadyInCart: 1, added: 1 })).toContain('2 units');
  });

  /**
   * The wording is the only defence against a shopper believing their cart was
   * *set* to what they typed. With 2 already held and 2 added, the truth is 4 —
   * so the message must say 4, not 2.
   */
  it('reports the sum, never the quantity typed', () => {
    const message = cartAddConfirmation({ ...base, alreadyInCart: 2, added: 2 });

    expect(message).toContain('4 units');
    expect(message).not.toContain('2 units');
  });

  it('matches the server-side increment for every starting point', () => {
    for (const existing of [0, 1, 2, 5]) {
      for (const added of [1, 2, 3]) {
        expect(cartAddConfirmation({ ...base, alreadyInCart: existing, added })).toContain(
          `${existing + added} ${existing + added === 1 ? 'unit' : 'units'}`
        );
      }
    }
  });

  it('names the product and the size, so the toast is unambiguous', () => {
    const message = cartAddConfirmation({ ...base, size: 'XXL' });

    expect(message).toContain('Studio Hoodie');
    expect(message).toContain('XXL');
  });

  it('never reports a negative or fractional unit count', () => {
    // Both inputs are already validated by the time this runs, so this is
    // defensive: a nonsense count must not reach a screen.
    expect(cartAddConfirmation({ ...base, alreadyInCart: -5, added: 0 })).toContain('0 units');
    expect(cartAddConfirmation({ ...base, alreadyInCart: 0, added: 2.9 })).toContain('2 units');
  });
});

describe('cart semantics — the quantity here is additive, not absolute', () => {
  /**
   * `POST /api/cart/items` increments an existing `(productId, size)` line:
   *
   * ```sql
   * on conflict (user_id, product_id, size) do update
   *   set quantity = public.cart_items.quantity + excluded.quantity
   * ```
   *
   * The quantity selected here therefore means "how many more to add". This is a
   * property of the **server**, so it cannot be fixed on the client — the only
   * way to fake absolute semantics would be to call `setQuantity()` instead,
   * which would silently turn "add 3" into "set 3" and discard whatever the
   * shopper already had.
   */
  it('means the shopper already holding 2 ends up with 5 when they add 3', () => {
    const existing = 2;
    const selected = clampQuantity(3, 24);

    expect(existing + selected).toBe(5);
    expect(selected).not.toBe(5); // the value sent is the increment, not the total
  });

  it('would destroy an existing line if absolute semantics were faked', () => {
    // Why `setQuantity()` must not be used here: it sends an absolute number, so
    // "add 1" against a line of 4 would reduce the cart to 1.
    const existing = 4;
    const selected = clampQuantity(1, 24);

    expect(selected).toBe(1);
    expect(existing + selected).toBe(5); // what the shopper meant
    // `selected` alone, sent as PATCH, would have silently removed 3 units.
    expect(selected).toBeLessThan(existing);
  });

  it('clamps the increment to what is actually addable, not to raw stock', () => {
    // Client-side clamping is a courtesy that prevents a guaranteed rejection,
    // not a substitute for the server's check: stock can change between this
    // read and the mutation.
    const cart = cartWith([{ productId: PRODUCT_ID, size: 'M', quantity: 4 }]);

    expect(clampQuantity(3, availableToAdd(cart, PRODUCT_ID, 'M', 5))).toBe(1);
  });
});
