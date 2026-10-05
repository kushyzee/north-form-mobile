/**
 * React-free API client for the existing NORTH & FORM Next.js API.
 *
 * `EXPO_PUBLIC_API_URL` is the API root including `/api`, so endpoints are
 * resolved relative to it (`${baseUrl}/cart`, `${baseUrl}/cart/items`,
 * `${baseUrl}/catalogue/products`). Point this at a LAN/tunnel origin for local
 * development; nothing here is bound to a specific deployment.
 *
 * Two families of endpoint share this one client:
 *
 * - **Cart** (`/cart`, `/cart/items`) — authenticated. A session is required,
 *   and a missing one is a `UnauthenticatedError` before any request is made.
 * - **Catalogue** (`/catalogue/**`) — public. The server does not require a
 *   token, so a missing one is not an error; a token that *does* exist is still
 *   attached, because the same client serves both and a signed-in shopper
 *   should not be downgraded to an anonymous reader.
 *
 * There is deliberately no second HTTP client. Both families share one request
 * path, one error normalisation and one response-validation rule, so a contract
 * change cannot be handled correctly for one and forgotten for the other.
 */

import type { ZodType } from 'zod';

import {
  ApiError,
  InvalidResponseError,
  NetworkError,
  UnauthenticatedError,
  type ApiErrorCode,
} from '@/lib/api-error';
import {
  categoriesResponseSchema,
  productSchema,
  productsResponseSchema,
  type Category,
  type Product,
  type ProductQuery,
} from '@/lib/catalogue-schema';
import {
  cartSchema,
  errorEnvelopeSchema,
  type AddItemInput,
  type Cart,
  type CartItemRef,
  type SetQuantityInput,
} from '@/lib/cart-schema';

const CART_PATH = '/cart';
const CART_ITEMS_PATH = '/cart/items';

const CATALOGUE_CATEGORIES_PATH = '/catalogue/categories';
const CATALOGUE_PRODUCTS_PATH = '/catalogue/products';
const CATALOGUE_FEATURED_PATH = '/catalogue/products/featured';

/**
 * Fallback code for a non-2xx that arrived without the `{ error: { code,
 * message } }` envelope — a proxy, a gateway, or an HTML error page. The
 * envelope's real code is always preferred; this only stands in when there is
 * none to read.
 */
const CART_FALLBACK_CODE = 'CART_FAILED';
const CATALOGUE_FALLBACK_CODE = 'CATALOGUE_FAILED';

const GENERIC_STATUS_MESSAGES: Record<number, string> = {
  400: 'That request was not valid.',
  401: 'Please sign in again.',
  404: 'That item could not be found.',
  405: 'That action is not supported.',
  409: 'There is not enough stock for that.',
  500: 'Something went wrong on our side. Please try again.',
};

/** The largest `limit` the featured endpoint accepts. Mirrors the server. */
const MAX_FEATURED_LIMIT = 20;

function resolveBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_URL;

  if (!base) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_URL. Set it in .env.local (include the /api path).'
    );
  }

  return base.replace(/\/+$/, '');
}

export type ApiClient = {
  getCart: () => Promise<Cart>;
  /** POST increments the existing line quantity. */
  addItem: (input: AddItemInput) => Promise<Cart>;
  /** PATCH sets the absolute quantity. Rejects 0. */
  setQuantity: (input: SetQuantityInput) => Promise<Cart>;
  removeItem: (input: CartItemRef) => Promise<Cart>;
  clearCart: () => Promise<Cart>;

  /* Catalogue — public reads, no session required. */

  getCategories: () => Promise<Category[]>;
  getProducts: (query?: ProductQuery) => Promise<Product[]>;
  getProductBySlug: (slug: string) => Promise<Product>;
  getFeaturedProducts: (limit?: number) => Promise<Product[]>;
};

function requirePositiveQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ApiError(
      400,
      'INVALID_QUANTITY',
      'Quantity must be a whole number of at least 1.'
    );
  }
}

/**
 * Rejects a limit the server would refuse anyway.
 *
 * The API accepts 1–20 and answers 400 for anything else, so this only saves a
 * round trip and gives the same answer in the same shape. No default is
 * supplied: the server already defaults to 4, and sending one would freeze that
 * default into the client.
 */
function requireValidLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_FEATURED_LIMIT) {
    throw new ApiError(
      400,
      'INVALID_REQUEST',
      `Limit must be a whole number between 1 and ${MAX_FEATURED_LIMIT}.`
    );
  }
}

/**
 * An empty slug would collapse the request to `/catalogue/products`, which is
 * the *list* endpoint — it would answer 200 with a whole product array where
 * the caller expects one product. Reject it here instead.
 */
function requireSlug(slug: string) {
  if (typeof slug !== 'string' || slug.trim() === '') {
    throw new ApiError(400, 'INVALID_REQUEST', 'A product slug is required.');
  }
}

/**
 * Appends only the query parameters that were actually supplied.
 *
 * `URLSearchParams` does the encoding, so a search term containing `&`, `#` or
 * a space cannot escape into the URL's structure. An absent option is omitted
 * rather than sent as `undefined`, `null` or an empty placeholder — the server
 * distinguishes "not supplied" from a value.
 */
function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }

  const query = search.toString();
  return query === '' ? path : `${path}?${query}`;
}

/**
 * Parse a JSON body without letting a parse exception escape, so a proxy or
 * HTML error page cannot surface as a raw SyntaxError.
 */
async function readJson(response: Response): Promise<unknown | undefined> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export function createApiClient(accessToken: string | null): ApiClient {
  if (accessToken !== null && accessToken.trim() === '') {
    // Guard against ever sending `Authorization: Bearer ` with an empty value.
    throw new UnauthenticatedError();
  }

  function apiUrl(path: string): string {
    return `${resolveBaseUrl()}${path}`;
  }

  /**
   * The single request path shared by every endpoint.
   *
   * `requireAuth` is the only difference between the cart and the catalogue:
   * it decides whether a missing session aborts before the fetch. Everything
   * after that — header construction, network normalisation, error-envelope
   * mapping, response validation — is identical on purpose.
   *
   * A 2xx whose body fails `schema` becomes an `InvalidResponseError`, never a
   * default value. Returning `[]` or a null product would turn a contract break
   * into an empty shop, which is indistinguishable from a real answer.
   */
  async function request<T>(options: {
    method: string;
    path: string;
    body?: unknown;
    requireAuth: boolean;
    schema: ZodType<T>;
    fallbackCode: ApiErrorCode;
  }): Promise<T> {
    const { method, path, body, requireAuth, schema, fallbackCode } = options;

    if (requireAuth && !accessToken) throw new UnauthenticatedError();

    const headers: Record<string, string> = { Accept: 'application/json' };
    // Attached when there is a session; simply omitted when there is not. A
    // public read is never blocked by the absence of a credential.
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(apiUrl(path), {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new NetworkError();
    }

    const payload = await readJson(response);

    if (!response.ok) {
      const envelope = errorEnvelopeSchema.safeParse(payload);
      if (envelope.success) {
        throw new ApiError(
          response.status,
          envelope.data.error.code as ApiErrorCode,
          envelope.data.error.message
        );
      }

      // Non-2xx without the expected envelope (proxy, gateway, HTML error page).
      // Normalise it instead of leaking the raw body.
      throw new ApiError(
        response.status,
        fallbackCode,
        GENERIC_STATUS_MESSAGES[response.status] ?? 'Something went wrong. Please try again.'
      );
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new InvalidResponseError();
    }

    return parsed.data;
  }

  function requestCart(method: string, path: string, body?: unknown): Promise<Cart> {
    return request({
      method,
      path,
      body,
      requireAuth: true,
      schema: cartSchema,
      fallbackCode: CART_FALLBACK_CODE,
    });
  }

  function requestCatalogue<T>(
    path: string,
    schema: ZodType<T>
  ): Promise<T> {
    return request({
      method: 'GET',
      path,
      requireAuth: false,
      schema,
      fallbackCode: CATALOGUE_FALLBACK_CODE,
    });
  }

  return {
    getCart: () => requestCart('GET', CART_PATH),

    addItem: ({ productId, size, quantity }) => {
      requirePositiveQuantity(quantity);
      return requestCart('POST', CART_ITEMS_PATH, { productId, size, quantity });
    },

    setQuantity: ({ productId, size, quantity }) => {
      // PATCH is absolute, and the API rejects 0 — removal must use DELETE.
      requirePositiveQuantity(quantity);
      return requestCart('PATCH', CART_ITEMS_PATH, { productId, size, quantity });
    },

    // This endpoint intentionally takes a JSON body despite being a DELETE.
    removeItem: ({ productId, size }) =>
      requestCart('DELETE', CART_ITEMS_PATH, { productId, size }),

    clearCart: () => requestCart('DELETE', CART_PATH),

    getCategories: () =>
      requestCatalogue(CATALOGUE_CATEGORIES_PATH, categoriesResponseSchema),

    getProducts: ({ category, search, sort }: ProductQuery = {}) =>
      requestCatalogue(
        withQuery(CATALOGUE_PRODUCTS_PATH, { category, search, sort }),
        productsResponseSchema
      ),

    // `async` on the two guarded methods so their rejection is a promise
    // rejection like every other failure here. A synchronous throw would slip
    // past a caller's `.catch()` at the call site.
    getProductBySlug: async (slug) => {
      requireSlug(slug);
      // `encodeURIComponent` per segment: a slug is one path segment, so it must
      // not be able to introduce a `/` or a `?` of its own.
      return requestCatalogue(
        `${CATALOGUE_PRODUCTS_PATH}/${encodeURIComponent(slug)}`,
        productSchema
      );
    },

    getFeaturedProducts: async (limit) => {
      if (limit !== undefined) requireValidLimit(limit);
      return requestCatalogue(
        withQuery(CATALOGUE_FEATURED_PATH, {
          limit: limit === undefined ? undefined : String(limit),
        }),
        productsResponseSchema
      );
    },
  };
}
