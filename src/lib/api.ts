/**
 * React-free API client for the existing NORTH & FORM Next.js API.
 *
 * `EXPO_PUBLIC_API_URL` is the API root including `/api`, so endpoints are
 * resolved relative to it (`${baseUrl}/cart`, `${baseUrl}/cart/items`). Point
 * this at a LAN/tunnel origin for local development; nothing here is bound to a
 * specific deployment.
 */

import {
  ApiError,
  InvalidResponseError,
  NetworkError,
  UnauthenticatedError,
  type ApiErrorCode,
} from '@/lib/api-error';
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

const GENERIC_STATUS_MESSAGES: Record<number, string> = {
  400: 'That request was not valid.',
  401: 'Please sign in again.',
  404: 'That item could not be found.',
  405: 'That action is not supported.',
  409: 'There is not enough stock for that.',
  500: 'Something went wrong on our side. Please try again.',
};

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

  async function requestCart(method: string, path: string, body?: unknown): Promise<Cart> {
    if (!accessToken) throw new UnauthenticatedError();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
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
        'CART_FAILED',
        GENERIC_STATUS_MESSAGES[response.status] ?? 'Something went wrong. Please try again.'
      );
    }

    const parsed = cartSchema.safeParse(payload);
    if (!parsed.success) {
      // Never fall back to an empty cart here — that would hide a contract break.
      throw new InvalidResponseError();
    }

    return parsed.data;
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
  };
}