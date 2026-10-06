import { z } from 'zod';

/**
 * Catalogue schemas for the public NORTH & FORM catalogue API.
 *
 * These mirror `lib/catalogue/types.ts` in the web app exactly. That module is
 * `server-only`, so the shapes cannot be imported from here — but the API it
 * backs serialises those same types, and this file is the mobile half of one
 * contract, not a second definition of it. Keep the two in step.
 *
 * Every schema here is used to **reject** a malformed server response rather
 * than to widen one: `safeParse` failing becomes an `InvalidResponseError`
 * (see `src/lib/api.ts`) instead of a screen rendering `₦undefined`.
 */

/**
 * Ids are `uuid` columns in Postgres. They are validated as non-empty strings
 * rather than as strict UUIDs so a future id scheme does not silently break the
 * catalogue, while still rejecting `null`, `undefined` and `""`.
 */
const idSchema = z.string().min(1);

/** `price` is `numeric(12,2)` in naira, returned by PostgREST as a number. */
const priceSchema = z.number().finite().nonnegative();

/**
 * `stock_quantity` has a `check (stock_quantity >= 0)`, so 0 is a legitimate
 * value meaning "out of stock" and must not fail validation.
 */
const stockQuantitySchema = z.number().int().nonnegative();

/** A public catalogue category. */
export const categorySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  /** Nullable in the database — a category need not be described. */
  description: z.string().nullable(),
});

/** A public catalogue product, always resolved with its category. */
export const productSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  price: priceSchema,
  stockQuantity: stockQuantitySchema,
  sizes: z.array(z.string()),
  images: z.array(z.string()),
  featured: z.boolean(),
  category: categorySchema,
});

/** Sorting options the API accepts, mirroring `PRODUCT_SORTS` on the server. */
export const PRODUCT_SORTS = [
  'featured',
  'newest',
  'price-asc',
  'price-desc',
  'name-asc',
] as const;

export const productSortSchema = z.enum(PRODUCT_SORTS);

/** `GET /api/catalogue/categories` and `GET /api/catalogue/products`. */
export const categoriesResponseSchema = z.array(categorySchema);
export const productsResponseSchema = z.array(productSchema);

export type Category = z.infer<typeof categorySchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductSort = z.infer<typeof productSortSchema>;

/** Query parameters accepted by `GET /api/catalogue/products`. */
export type ProductQuery = {
  /** Exact category slug to filter by. */
  category?: string | undefined;
  /** Free-text term matched against product name and description. */
  search?: string | undefined;
  sort?: ProductSort | undefined;
};

/**
 * Server error codes for catalogue reads. The wire format is
 * `KnownCatalogueErrorCode | string`, since the server may add codes.
 *
 * `UNAUTHENTICATED` and `CART_FAILED` are deliberately absent — they belong to
 * the cart API. `ApiErrorCode` still accepts them (see `src/lib/api-error.ts`),
 * so nothing here narrows what a caller can receive.
 */
export const KNOWN_CATALOGUE_ERROR_CODES = [
  'INVALID_REQUEST',
  'PRODUCT_NOT_FOUND',
  'CATEGORIES_NOT_FOUND',
  'CATALOGUE_FAILED',
  'METHOD_NOT_ALLOWED',
] as const;

export type KnownCatalogueErrorCode = (typeof KNOWN_CATALOGUE_ERROR_CODES)[number];

/**
 * Product stock state, derived from `stock_quantity`.
 *
 * Mirrors `getAvailability()` in the web app's `lib/catalogue/types.ts`, including
 * the same threshold, so a product reads as "low stock" in the app at the same
 * count it does on the web.
 *
 * This is **derived, not transmitted**: the API sends only `stockQuantity`, so
 * nothing here validates a server response. It lives beside `Product` because it
 * is derived from it.
 */
export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock';

/** At or below this many units we surface a "low stock" note (not urgency copy). */
export const LOW_STOCK_THRESHOLD = 5;

export function getAvailability(stockQuantity: number): Availability {
  if (stockQuantity <= 0) return 'out_of_stock';
  if (stockQuantity <= LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
}