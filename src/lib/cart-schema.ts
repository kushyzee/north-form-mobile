import { z } from 'zod';

/**
 * Cart line as returned by the API. Product data is flattened into the line —
 * there is no nested `Product` object.
 *
 * `lineId` is a derived client-side convenience key. It is not a database id
 * and must never be sent back to the API.
 */
export const cartLineSchema = z.object({
  lineId: z.string().min(1),
  productId: z.string().min(1),
  productSlug: z.string(),
  productName: z.string().min(1),
  productImage: z.string().nullable(),
  categoryName: z.string(),
  unitPrice: z.number().finite().nonnegative(),
  size: z.string().min(1),
  quantity: z.number().int().positive(),
  // The API sends `Math.max(stock_quantity, 0)`, so 0 is a valid value for an
  // out-of-stock product and must not fail validation.
  maxQuantity: z.number().int().nonnegative(),
});

export const cartSchema = z.object({
  items: z.array(cartLineSchema),
  itemCount: z.number().finite().nonnegative(),
  subtotal: z.number().finite().nonnegative(),
});

export type CartLine = z.infer<typeof cartLineSchema>;
export type Cart = z.infer<typeof cartSchema>;

/** Server error codes. The wire format is `KnownErrorCode | string`. */
export const KNOWN_CART_ERROR_CODES = [
  'UNAUTHENTICATED',
  'INVALID_REQUEST',
  'INVALID_QUANTITY',
  'INVALID_SIZE',
  'PRODUCT_NOT_FOUND',
  'CART_ITEM_NOT_FOUND',
  'INSUFFICIENT_STOCK',
  'CART_FAILED',
  'METHOD_NOT_ALLOWED',
] as const;

export type KnownCartErrorCode = (typeof KNOWN_CART_ERROR_CODES)[number];

/**
 * The server may add codes we do not know about, so treat this as a known-union
 * with a string fallback rather than an exhaustive enum.
 */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

/** Identifier for a single product/size line, as the API addresses it. */
export type CartItemRef = {
  productId: string;
  size: string;
};

export type AddItemInput = CartItemRef & {
  /** Added to the current quantity by the server. */
  quantity: number;
};

export type SetQuantityInput = CartItemRef & {
  /** Absolute quantity. Must be >= 1 — never 0. */
  quantity: number;
};