import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  InvalidResponseError,
  NetworkError,
  UnauthenticatedError,
} from '@/lib/api-error';
import { createApiClient } from '@/lib/api';

/**
 * The catalogue client contract, exercised against a stubbed `fetch`.
 *
 * Two things are being defended here. First, the request each method makes:
 * right method, right path, and — the part most likely to rot quietly — query
 * parameters that are *present* when supplied and *absent* when not. Second,
 * that a response is only ever accepted when it matches the schema, so a
 * contract break on the server cannot reach a screen as an empty shop.
 *
 * The cart cases at the bottom exist because `request()` is shared. They pin
 * the behaviour that was already there, so refactoring one request path into
 * two cannot quietly change the authenticated one.
 */

const BASE_URL = 'http://api.test/api';

const CATEGORY = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Shirts',
  slug: 'shirts',
  description: 'Everyday shirts',
};

const PRODUCT = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Essential Oxford',
  slug: 'essential-oxford',
  description: 'A shirt you will keep for years.',
  price: 28000,
  stockQuantity: 24,
  sizes: ['S', 'M', 'L'],
  images: ['https://cdn.test/oxford-1.jpg'],
  featured: true,
  category: CATEGORY,
};

const TOKEN = 'test-access-token';

type Call = { url: string; init: RequestInit | undefined };

let calls: Call[];

/** Answers every request with `body`/`status`, recording what was asked for. */
function stubFetch(body: unknown, status = 200) {
  calls = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

/** A 200 whose body is not JSON at all, e.g. a gateway's HTML page. */
function stubNonJsonResponse(status: number) {
  calls = [];
  globalThis.fetch = vi.fn(
    async () => new Response('<html>gateway</html>', { status })
  ) as unknown as typeof fetch;
}

function lastCall(): Call {
  const call = calls[calls.length - 1];
  if (!call) throw new Error('no request was made');
  return call;
}

/** The query parameters of the recorded request, as a plain object. */
function lastQuery(): Record<string, string> {
  return Object.fromEntries(new URL(lastCall().url).searchParams);
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = BASE_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('catalogue — the request each method makes', () => {
  it('reads categories with GET /catalogue/categories and no query', async () => {
    stubFetch([CATEGORY]);

    await createApiClient(TOKEN).getCategories();

    expect(lastCall().url).toBe(`${BASE_URL}/catalogue/categories`);
    expect(lastCall().init?.method).toBe('GET');
    expect(lastQuery()).toEqual({});
  });

  it('sends no request body on a catalogue read', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getProducts();

    expect(lastCall().init?.body).toBeUndefined();
    expect(lastCall().init?.headers).not.toHaveProperty('Content-Type');
  });

  it('requests products with no query at all when nothing is supplied', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getProducts();

    expect(lastCall().url).toBe(`${BASE_URL}/catalogue/products`);
  });

  it('sends only the category when only the category is supplied', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getProducts({ category: 'shirts' });

    expect(lastQuery()).toEqual({ category: 'shirts' });
  });

  it('sends only the search term when only search is supplied', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getProducts({ search: 'oxford' });

    expect(lastQuery()).toEqual({ search: 'oxford' });
  });

  it('sends only the sort when only sort is supplied', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getProducts({ sort: 'price-asc' });

    expect(lastQuery()).toEqual({ sort: 'price-asc' });
  });

  it.each(['featured', 'newest', 'price-asc', 'price-desc', 'name-asc'] as const)(
    'sends the %s sort value the API supports',
    async (sort) => {
      stubFetch([]);

      await createApiClient(TOKEN).getProducts({ sort });

      expect(lastQuery()).toEqual({ sort });
    }
  );

  it('combines every parameter into one request', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getProducts({
      category: 'shirts',
      search: 'oxford',
      sort: 'price-desc',
    });

    expect(lastQuery()).toEqual({
      category: 'shirts',
      search: 'oxford',
      sort: 'price-desc',
    });
  });

  it('omits an empty option rather than sending a placeholder', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getProducts({ category: '', search: '', sort: undefined });

    // The server treats "absent" and "empty" differently; absent is what we mean.
    expect(lastCall().url).toBe(`${BASE_URL}/catalogue/products`);
  });

  it('encodes a search term so it cannot alter the URL structure', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getProducts({ search: 'shirt & tie? #1 50%' });

    // A raw concatenation would split this into extra params.
    expect(lastQuery()).toEqual({ search: 'shirt & tie? #1 50%' });
    expect(lastCall().url).toContain('search=shirt+%26+tie%3F+%231+50%25');
  });

  it('encodes a category slug containing characters that need it', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getProducts({ category: 'shirts & jeans/plus' });

    expect(lastQuery()).toEqual({ category: 'shirts & jeans/plus' });
  });

  it('reads one product by its slug', async () => {
    stubFetch(PRODUCT);

    await createApiClient(TOKEN).getProductBySlug('essential-oxford');

    expect(lastCall().url).toBe(`${BASE_URL}/catalogue/products/essential-oxford`);
    expect(lastCall().init?.method).toBe('GET');
  });

  it('encodes the slug as a single path segment', async () => {
    stubFetch(PRODUCT);

    await createApiClient(TOKEN).getProductBySlug('a b/c?d');

    // A raw concatenation would address a different route entirely.
    expect(lastCall().url).toBe(`${BASE_URL}/catalogue/products/a%20b%2Fc%3Fd`);
    expect(new URL(lastCall().url).pathname).toBe('/api/catalogue/products/a%20b%2Fc%3Fd');
  });

  it.each(['', '   '])(
    'rejects the empty slug %j rather than fetching the product list',
    async (slug) => {
      stubFetch([]);

      // `/catalogue/products/` would answer 200 with an array of every product.
      await expect(createApiClient(TOKEN).getProductBySlug(slug)).rejects.toBeInstanceOf(
        ApiError
      );
      expect(calls).toHaveLength(0);
    }
  );

  it('requests featured products without a limit by default', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getFeaturedProducts();

    // No client-side default: the server already defaults to 4.
    expect(lastCall().url).toBe(`${BASE_URL}/catalogue/products/featured`);
    expect(lastQuery()).toEqual({});
  });

  it('sends a supplied limit as a query parameter', async () => {
    stubFetch([]);

    await createApiClient(TOKEN).getFeaturedProducts(8);

    expect(lastCall().url).toBe(`${BASE_URL}/catalogue/products/featured?limit=8`);
  });

  it.each([1, 20])('accepts the boundary limit %i', async (limit) => {
    stubFetch([]);

    await createApiClient(TOKEN).getFeaturedProducts(limit);

    expect(lastQuery()).toEqual({ limit: String(limit) });
  });

  it.each([0, -1, 21, 2.5, Number.NaN])(
    'rejects the out-of-range limit %s without a request',
    async (limit) => {
      stubFetch([]);

      await expect(
        createApiClient(TOKEN).getFeaturedProducts(limit)
      ).rejects.toBeInstanceOf(ApiError);
      expect(calls).toHaveLength(0);
    }
  );
});

describe('catalogue — authentication is optional, and a token is still used', () => {
  it('reads the catalogue with no session at all', async () => {
    stubFetch([CATEGORY]);

    await expect(createApiClient(null).getCategories()).resolves.toEqual([CATEGORY]);
  });

  it('omits the Authorization header when there is no session', async () => {
    stubFetch([CATEGORY]);

    await createApiClient(null).getCategories();

    expect(lastCall().init?.headers).not.toHaveProperty('Authorization');
  });

  it('attaches the bearer token when a session exists', async () => {
    stubFetch([CATEGORY]);

    await createApiClient(TOKEN).getCategories();

    // A signed-in shopper is not downgraded to an anonymous reader.
    expect(lastCall().init?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it('never sends an empty bearer token', async () => {
    expect(() => createApiClient('  ')).toThrow(UnauthenticatedError);
  });
});

describe('catalogue — a valid response is the server data, verbatim', () => {
  it('returns categories exactly as sent', async () => {
    stubFetch([CATEGORY]);

    await expect(createApiClient(TOKEN).getCategories()).resolves.toEqual([CATEGORY]);
  });

  it('accepts an empty catalogue as a success, not a failure', async () => {
    stubFetch([]);

    await expect(createApiClient(TOKEN).getProducts()).resolves.toEqual([]);
  });

  it('returns a product list exactly as sent', async () => {
    stubFetch([PRODUCT]);

    await expect(createApiClient(TOKEN).getProducts()).resolves.toEqual([PRODUCT]);
  });

  it('returns a single product exactly as sent', async () => {
    stubFetch(PRODUCT);

    await expect(
      createApiClient(TOKEN).getProductBySlug('essential-oxford')
    ).resolves.toEqual(PRODUCT);
  });

  it('returns featured products exactly as sent', async () => {
    stubFetch([PRODUCT]);

    await expect(createApiClient(TOKEN).getFeaturedProducts(4)).resolves.toEqual([PRODUCT]);
  });

  it('accepts a category with no description, and a product with no sizes or images', async () => {
    stubFetch({
      ...PRODUCT,
      category: { ...CATEGORY, description: null },
      sizes: [],
      images: [],
    });

    await expect(createApiClient(TOKEN).getProductBySlug('x')).resolves.toMatchObject({
      category: { description: null },
      sizes: [],
      images: [],
    });
  });

  it('accepts an out-of-stock product, where stockQuantity is 0', async () => {
    stubFetch({ ...PRODUCT, stockQuantity: 0 });

    await expect(createApiClient(TOKEN).getProductBySlug('x')).resolves.toMatchObject({
      stockQuantity: 0,
    });
  });
});

describe('catalogue — a malformed success is a failure, never an empty shop', () => {
  const malformedCategories: [string, unknown][] = [
    ['a null body', null],
    ['an object rather than an array', { categories: [] }],
    ['a category missing its name', [{ ...CATEGORY, name: undefined }]],
    ['a category with an empty id', [{ ...CATEGORY, id: '' }]],
    ['a category missing its slug', [{ id: 'a', name: 'Shirts', description: null }]],
    ['a numeric category id', [{ ...CATEGORY, id: 7 }]],
    [
      'a description of the wrong type',
      [{ ...CATEGORY, description: 42 }],
    ],
    ['a null entry inside the array', [null]],
  ];

  for (const [label, body] of malformedCategories) {
    it(`rejects categories: ${label}`, async () => {
      stubFetch(body);

      await expect(createApiClient(TOKEN).getCategories()).rejects.toBeInstanceOf(
        InvalidResponseError
      );
    });
  }

  const malformedProducts: [string, unknown][] = [
    ['a null body', null],
    ['a single product rather than an array', PRODUCT],
    ['a product missing its price', [{ ...PRODUCT, price: undefined }]],
    ['a non-numeric price', [{ ...PRODUCT, price: 'free' }]],
    ['a negative price', [{ ...PRODUCT, price: -1 }]],
    ['a non-finite price', [{ ...PRODUCT, price: Number.POSITIVE_INFINITY }]],
    ['a negative stock quantity', [{ ...PRODUCT, stockQuantity: -3 }]],
    ['a fractional stock quantity', [{ ...PRODUCT, stockQuantity: 1.5 }]],
    ['a stock quantity sent as a string', [{ ...PRODUCT, stockQuantity: '24' }]],
    ['sizes as a string rather than an array', [{ ...PRODUCT, sizes: 'S,M,L' }]],
    ['images containing a non-string', [{ ...PRODUCT, images: ['ok', 3] }]],
    ['a non-boolean featured', [{ ...PRODUCT, featured: 'yes' }]],
    ['a missing description', [{ ...PRODUCT, description: undefined }]],
    ['a product with no category', [{ ...PRODUCT, category: undefined }]],
    ['a category nested as an array', [{ ...PRODUCT, category: [CATEGORY] }]],
  ];

  for (const [label, body] of malformedProducts) {
    it(`rejects products: ${label}`, async () => {
      stubFetch(body);

      await expect(createApiClient(TOKEN).getProducts()).rejects.toBeInstanceOf(
        InvalidResponseError
      );
    });
  }

  it.each([
    ['getProductBySlug', (c: ReturnType<typeof createApiClient>) => c.getProductBySlug('x')],
    ['getFeaturedProducts', (c: ReturnType<typeof createApiClient>) => c.getFeaturedProducts()],
  ])('rejects a malformed 200 from %s', async (_label, call) => {
    stubFetch({ products: [] });

    await expect(call(createApiClient(TOKEN))).rejects.toBeInstanceOf(
      InvalidResponseError
    );
  });

  it('rejects a 200 whose body is not JSON at all', async () => {
    stubNonJsonResponse(200);

    await expect(createApiClient(TOKEN).getProducts()).rejects.toBeInstanceOf(
      InvalidResponseError
    );
  });

  it('never substitutes an empty array for a malformed body', async () => {
    stubFetch({ nope: true });

    // The important assertion: this is not `[]`. An empty shop and a broken
    // contract must stay distinguishable.
    await expect(createApiClient(TOKEN).getProducts()).rejects.not.toBeInstanceOf(Array);
  });
});

describe('catalogue — server errors keep their status, code and message', () => {
  const cases: [string, number][] = [
    ['INVALID_REQUEST', 400],
    ['PRODUCT_NOT_FOUND', 404],
    ['CATEGORIES_NOT_FOUND', 404],
    ['CATALOGUE_FAILED', 500],
    ['METHOD_NOT_ALLOWED', 405],
    ['SOME_CODE_ADDED_LATER', 418],
  ];

  for (const [code, status] of cases) {
    it(`surfaces ${status} ${code} as an ApiError`, async () => {
      stubFetch({ error: { code, message: 'Server said so.' } }, status);

      const error = await createApiClient(TOKEN)
        .getProducts()
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status, code, message: 'Server said so.' });
    });
  }

  it('preserves 404 PRODUCT_NOT_FOUND from the product endpoint', async () => {
    stubFetch(
      { error: { code: 'PRODUCT_NOT_FOUND', message: 'That piece is no longer available.' } },
      404
    );

    const error = await createApiClient(TOKEN)
      .getProductBySlug('does-not-exist')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      code: 'PRODUCT_NOT_FOUND',
      message: 'That piece is no longer available.',
    });
  });

  it('reports a failure to reach the server as a NetworkError', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    const error = await createApiClient(TOKEN)
      .getCategories()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NetworkError);
    // The transport's own text must not reach the user.
    expect((error as Error).message).not.toContain('Failed to fetch');
  });

  it.each([400, 404, 500, 503])(
    'normalises a %i with no error envelope instead of leaking the body',
    async (status) => {
      stubNonJsonResponse(status);

      const error = await createApiClient(TOKEN)
        .getCategories()
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(status);
      expect((error as ApiError).message).not.toContain('gateway');
    }
  );

  it('falls back to CATALOGUE_FAILED when the envelope is malformed', async () => {
    stubFetch({ unexpected: true }, 500);

    const error = await createApiClient(TOKEN)
      .getCategories()
      .catch((caught: unknown) => caught);

    expect((error as ApiError).code).toBe('CATALOGUE_FAILED');
  });

  it('never leaks the raw payload when the envelope is missing a message', async () => {
    stubFetch({ error: { code: 'CATALOGUE_FAILED' } }, 500);

    const error = await createApiClient(TOKEN)
      .getCategories()
      .catch((caught: unknown) => caught);

    expect((error as ApiError).message).not.toContain('CATALOGUE_FAILED');
  });
});

describe('cart — unchanged by the shared request path', () => {
  const cart = { items: [], itemCount: 0, subtotal: 0 };

  it('still requires a session', async () => {
    stubFetch(cart);

    await expect(createApiClient(null).getCart()).rejects.toBeInstanceOf(
      UnauthenticatedError
    );
    expect(calls).toHaveLength(0);
  });

  it('still attaches the bearer token and reads the cart', async () => {
    stubFetch(cart);

    await createApiClient(TOKEN).getCart();

    expect(lastCall().url).toBe(`${BASE_URL}/cart`);
    expect(lastCall().init?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it('still surfaces a cart error with its own code', async () => {
    stubFetch({ error: { code: 'INSUFFICIENT_STOCK', message: 'Not enough stock.' } }, 409);

    const error = await createApiClient(TOKEN)
      .addItem({ productId: 'p', size: 'M', quantity: 1 })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 409, code: 'INSUFFICIENT_STOCK' });
  });

  it('still falls back to CART_FAILED when the envelope is missing', async () => {
    stubFetch({ unexpected: true }, 500);

    const error = await createApiClient(TOKEN)
      .getCart()
      .catch((caught: unknown) => caught);

    // Catalogue's fallback code must not leak into the cart API.
    expect((error as ApiError).code).toBe('CART_FAILED');
  });

  it('still rejects a malformed cart rather than returning an empty one', async () => {
    stubFetch({ items: 'none', itemCount: 0, subtotal: 0 });

    await expect(createApiClient(TOKEN).getCart()).rejects.toBeInstanceOf(
      InvalidResponseError
    );
  });
});