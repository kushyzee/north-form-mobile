/**
 * Pure helpers for the product-detail screen's quantity control.
 *
 * These exist as a separate module, away from the screen, for one reason: the
 * rules they encode are the ones a mistake would make *silently*. A stepper that
 * can be driven to `0` looks fine in a screenshot and only fails when the cart
 * API answers `400 INVALID_QUANTITY`; a stepper capped at the wrong number is
 * equally invisible until a shopper hits an `INSUFFICIENT_STOCK` rejection at the
 * moment they press "Add to cart".
 *
 * Nothing here reaches for React, so the boundaries can be asserted directly
 * (see `product-detail.test.ts`) rather than inferred from a rendered screen.
 */

import { getAvailability, LOW_STOCK_THRESHOLD } from '@/lib/catalogue-schema';
import type { Cart } from '@/lib/cart-schema';

/** A shopper always adds at least one unit. */
export const MIN_QUANTITY = 1;

/**
 * The quantity already in the cart for a given `(productId, size)` line.
 *
 * Returns `0` when the cart is unloaded or holds no such line, so callers get one
 * uniform "how many do they already have" answer instead of a nullable one.
 *
 * The match is on **both** product and size because a cart line is keyed by that
 * pair on the server (`unique (user_id, product_id, size)`). Matching on the
 * product alone would count a size-M line against a size-L selection and wrongly
 * hide available stock.
 */
export function quantityInCart(cart: Cart | null, productId: string, size: string): number {
  if (!cart) return 0;

  const line = cart.items.find((item) => item.productId === productId && item.size === size);
  return line ? line.quantity : 0;
}

/**
 * How many more units of this product **and size** may be added.
 *
 * This is deliberately `stockQuantity - quantityInCart(...)` rather than just
 * `stockQuantity`, because the server checks the **resulting** total, not the
 * requested amount:
 *
 * ```sql
 * v_total := coalesce(v_current, 0) + p_quantity;
 * if v_total > v_stock then raise exception 'INSUFFICIENT_STOCK';
 * ```
 *
 * (`supabase/migrations/20261003190000_add_cart_migration_id.sql:139-152`)
 *
 * Because `POST /api/cart/items` increments an existing line, a shopper already
 * holding 2 of a size with 5 in stock has **3** left to add. Capping the stepper
 * at 5 would let them choose a quantity that is guaranteed to fail.
 *
 * Stock is per *product*, not per size — the schema has no per-size stock column
 * — so this subtracts only the quantity in the matching size line, never the
 * whole cart's quantity for that product.
 *
 * Returns 0 when nothing more can be added. The server remains authoritative:
 * stock can change between this read and the mutation, so a non-zero result is
 * still a promise the client cannot keep.
 */
export function availableToAdd(
  cart: Cart | null,
  productId: string,
  size: string | null,
  stockQuantity: number
): number {
  const max = maxQuantityFor(stockQuantity);
  if (size === null || size === '') return max;

  return Math.max(0, max - quantityInCart(cart, productId, size));
}

/**
 * The most a shopper may add in one action, derived from the product's stock.
 *
 * The API exposes stock **per product, not per size**, so this is the only stock
 * figure that exists. Inventing a per-size number here would be a fiction, and a
 * wrong one: it would either block a purchase the server would accept, or permit
 * one it will reject.
 *
 * A product with no stock clamps to 0 — but callers gate the control on
 * `getAvailability()` first, so 0 is never reachable as a selectable value.
 */
export function maxQuantityFor(stockQuantity: number): number {
  if (!Number.isFinite(stockQuantity)) return MIN_QUANTITY;
  return Math.max(0, Math.floor(stockQuantity));
}

/**
 * Constrains `quantity` to `[MIN_QUANTITY, max]`.
 *
 * Takes the **ceiling**, not the stock figure, because the ceiling is not always
 * the stock figure: it is `availableToAdd(...)`, which subtracts what the shopper
 * already holds in that exact size line. `max` is therefore clamped to at least
 * `MIN_QUANTITY` so a ceiling of 0 yields 1 rather than 0.
 *
 * Used when the product or the cart arrives, so a shopper cannot be left holding
 * a quantity of `3` because a previous selection had more room — or because
 * another line in their cart consumed the stock.
 */
export function clampQuantity(quantity: number, max: number): number {
  const ceiling = Number.isFinite(max) ? Math.max(MIN_QUANTITY, Math.floor(max)) : MIN_QUANTITY;

  if (!Number.isFinite(quantity)) return MIN_QUANTITY;

  const rounded = Math.floor(quantity);
  if (rounded < MIN_QUANTITY) return MIN_QUANTITY;
  if (rounded > ceiling) return ceiling;

  return rounded;
}

/** `+` is unavailable at the ceiling — there is nothing more to add. */
export function canIncrement(quantity: number, max: number): boolean {
  const ceiling = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;
  return clampQuantity(quantity, max) < ceiling;
}

/** `−` is unavailable at 1: removal is the cart screen's job, not this one. */
export function canDecrement(quantity: number): boolean {
  return Number.isFinite(quantity) && Math.floor(quantity) > MIN_QUANTITY;
}

/**
 * Availability, as it should read on a product page.
 *
 * `getAvailability()` already distinguishes the three states from `stockQuantity`;
 * this adds only the copy, and deliberately reuses `LOW_STOCK_THRESHOLD` rather
 * than hardcoding a count, so the detail screen cannot drift from the cards.
 *
 * Returns `null` for a healthy product: "In stock" as a permanent badge is noise
 * when the whole page is available to buy.
 */
export function availabilityLabel(stockQuantity: number): string | null {
  const availability = getAvailability(stockQuantity);

  if (availability === 'out_of_stock') return 'Sold out';
  if (availability === 'low_stock') {
    // Bounded by the threshold, so this can never read "Low stock — 40 left".
    return `Low stock — ${stockQuantity} left`;
  }
  return null;
}

/**
 * A one-line, human-readable availability statement for the detail page.
 *
 * Unlike the card badge, the detail page states stock even when it is healthy,
 * because here it answers "can I actually buy this?" rather than being an
 * exception worth flagging.
 */
export function availabilitySummary(stockQuantity: number): string {
  const availability = getAvailability(stockQuantity);

  if (availability === 'out_of_stock') return 'Sold out — this piece is currently unavailable.';
  if (availability === 'low_stock') {
    return `Low stock — only ${stockQuantity} left in total.`;
  }
  if (stockQuantity <= LOW_STOCK_THRESHOLD * 4) {
    return `In stock — ${stockQuantity} available.`;
  }
  return 'In stock and ready to ship.';
}

/**
 * The confirmation shown after a successful add.
 *
 * States the **resulting total**, not the quantity that was typed. Because the
 * server increments, "added 1" against a line of 2 means the shopper now has 3 —
 * saying "Added 1" would read as though the cart had been *set* to 1, which is
 * the exact misunderstanding the additive semantics create.
 *
 * Kept here rather than inline in the screen so the wording is covered by the
 * test suite: it is the one place where a phrasing change could quietly
 * misdescribe what happened to the shopper's cart.
 */
export function cartAddConfirmation({
  productName,
  size,
  alreadyInCart,
  added,
}: {
  productName: string;
  size: string;
  /** How many of this size the shopper held before this add. */
  alreadyInCart: number;
  /** How many were selected on the product page. */
  added: number;
}): string {
  // Floored and clamped, because a fractional or negative unit count reaching a
  // screen ("2.9 units") is nonsense. `clampQuantity` already guarantees whole
  // numbers upstream; this keeps the guarantee local to the copy, since this
  // string is the one place the figure is stated as fact.
  const resulting = Math.floor(Math.max(0, alreadyInCart) + Math.max(0, added));

  return `${resulting} ${resulting === 1 ? 'unit' : 'units'} of ${productName} (${size}) in your cart.`;
}

/**
 * Whether the Add-to-cart button should accept a press.
 *
 * The server is authoritative and re-checks all of this, but disabling the
 * control is the difference between a shopper being told the truth immediately
 * and being told it by a failed request. `submitting` is included so a second
 * press cannot start a second increment while the first is still in flight.
 *
 * `max` is `availableToAdd(...)`, so a shopper who has already taken all the
 * stock in that size sees the button disabled rather than pressing it into a
 * certain `INSUFFICIENT_STOCK`.
 */
export function canAddToCart({
  stockQuantity,
  size,
  max,
  submitting,
}: {
  stockQuantity: number;
  /** The chosen size, or `null` when nothing is selected. */
  size: string | null;
  /** How many more units may be added for this size. */
  max: number;
  submitting: boolean;
}): boolean {
  if (submitting) return false;
  if (getAvailability(stockQuantity) === 'out_of_stock') return false;
  if (maxQuantityFor(stockQuantity) < MIN_QUANTITY) return false;
  // Nothing left to add beyond what is already in the cart.
  if (!Number.isFinite(max) || max < MIN_QUANTITY) return false;
  return size !== null && size !== '';
}
