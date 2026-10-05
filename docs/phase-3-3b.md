# Phase 3.3B — Catalogue Data Layer

**Status:** Implemented; verified by unit tests. No device verification.
**Last updated:** 2025-10-05

---

## Objective

Let the mobile app read the existing NORTH & FORM catalogue over HTTP, with
server responses validated before they reach a component. Scope is the data
layer only — **no catalogue screens, no tabs, no provider.**

Phase 3.2A built the transport for authenticated cart endpoints. This phase
extends the same client to the four public catalogue endpoints and adds the
schemas that validate them.

---

## Why an API, not direct Supabase

The web app reads the catalogue from Supabase directly, in
`lib/catalogue/queries.ts` — server-only functions the mobile app cannot import.
Two options were available:

1. Read `products` / `categories` from Supabase in the mobile app.
2. Call the catalogue HTTP API the web app now exposes.

**Option 2 was chosen.** The web API already wraps those query functions, so the
mobile app gets filtering, search, sorting, runtime row validation and the
server's own row-shape narrowing without reimplementing any of it. Reading
Supabase directly would have meant duplicating the PostgREST filter syntax, the
`toProduct` narrowing and the sort orderings in a second place — a second
catalogue data source, which the project explicitly rules out.

Catalogue rows are world-readable under RLS (`anon` may `SELECT` from
`products` and `categories`), so neither option leaks anything. Option 2 was
chosen for maintainability, not for access control.

---

## Architecture

The Phase 3.2A client is extended, not duplicated:

```
createApiClient(accessToken)
  ├── requestCart(...)      requireAuth: true   → /cart, /cart/items
  └── requestCatalogue(...) requireAuth: false  → /catalogue/**
        │
        └── request({ method, path, body, requireAuth, schema, fallbackCode })
              fetch + Authorization (if a token exists)
              → error envelope  → ApiError
              → Zod schema      → typed data | InvalidResponseError
```

One `request()` serves both families. `requireAuth` is the only difference
between them, which is why the cart's existing behaviour is unchanged — see
[Cart regression tests](#cart-regression-tests).

| Layer | File | Responsibility |
|---|---|---|
| Schemas & types | `src/lib/catalogue-schema.ts` | `Category`, `Product`, `ProductSort`, response schemas |
| Transport | `src/lib/api.ts` | The four catalogue methods; shared `request()` |
| Tests | `src/lib/catalogue-api.test.ts` | 85 assertions against a stubbed `fetch` |

**No new provider.** Nothing in this phase holds state. The client is
stateless; a later phase decides how catalogue data is cached or shared.

---

## Implementation

### `src/lib/catalogue-schema.ts`

Schemas mirroring `lib/catalogue/types.ts` on the server. That module is
`server-only`, so the shapes are restated here as the mobile half of one
contract — not a second definition of it. **Keep the two in step.**

```typescript
categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),   // nullable in the database
})

productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  price: z.number().finite().nonnegative(),      // numeric(12,2), naira
  stockQuantity: z.number().int().nonnegative(), // 0 is valid: out of stock
  sizes: z.array(z.string()),
  images: z.array(z.string()),
  featured: z.boolean(),
  category: categorySchema,
})

productSortSchema = z.enum(['featured','newest','price-asc','price-desc','name-asc'])
```

Two deliberate choices:

- **Ids are non-empty strings, not strict UUIDs.** They are `uuid` columns today.
  Validating the shape rather than the format means a future id scheme does not
  silently break the catalogue, while `null`/`undefined`/`""` are still rejected.
- **`stockQuantity` accepts `0`.** The column has `check (stock_quantity >= 0)`,
  so 0 is a real value meaning out of stock, not a malformed row.

### `src/lib/api.ts`

Four methods added to `ApiClient`:

| Method | Request |
|---|---|
| `getCategories()` | `GET /catalogue/categories` |
| `getProducts({ category?, search?, sort? })` | `GET /catalogue/products` + supplied params only |
| `getProductBySlug(slug)` | `GET /catalogue/products/{encodeURIComponent(slug)}` |
| `getFeaturedProducts(limit?)` | `GET /catalogue/products/featured` + `limit` only if supplied |

**Query construction.** `URLSearchParams` does the encoding, so a search term
containing `&`, `#` or `%` cannot escape into the URL's structure. Absent
options are **omitted**, not sent as `undefined` or an empty placeholder — the
server distinguishes "not supplied" from a value.

This is not theoretical. Naive concatenation of `search=shirt & tie? #1 50%`
parses back as `{ search: "shirt ", " tie? ": "" }` — the term truncated and a
second parameter invented.

**No client-side default for `limit`.** The server already defaults to 4.
Sending one would freeze that default into the client, so a later server-side
change would not reach the app.

**`getProductBySlug` guards an empty slug.** `/catalogue/products/` with an
empty segment addresses the *list* route, which answers `200` with an array of
every product where the caller expects one product. Empty and whitespace-only
slugs are rejected client-side instead.

**`getFeaturedProducts` validates the limit** against the server's documented
1–20 range, so an impossible request fails with the same `ApiError` shape the
server would use, without the round trip.

**Both guarded methods are `async`.** A synchronous throw would escape before a
promise exists and slip past a caller's `.catch()` at the call site.

### Authentication

Catalogue endpoints are public, so `requireAuth: false`. The `Authorization`
header is **still attached when a session exists** — a signed-in shopper is not
downgraded to an anonymous reader. There is no separate unauthenticated client:
one client, one code path.

The empty-token guard from 3.2A is unchanged: `createApiClient('  ')` still
throws `UnauthenticatedError`, so `Authorization: Bearer ` can never be sent.

### Errors

Reuses the Phase 3.2A error types unchanged. No catalogue-specific classes.

| Situation | Result |
|---|---|
| Non-2xx with `{ error: { code, message } }` | `ApiError` preserving status, code and the server's customer-safe message |
| Non-2xx without the envelope (proxy, HTML) | `ApiError` with status-appropriate generic text |
| 2xx whose body fails the schema | `InvalidResponseError` |
| Transport failure | `NetworkError` |
| Missing session on a **cart** call | `UnauthenticatedError` |
| Missing session on a **catalogue** call | not an error |

Fallback codes differ per family so a proxy failure is attributable:
`CART_FAILED` for cart, `CATALOGUE_FAILED` for catalogue. An unknown future
code from the server passes through unchanged — `ApiErrorCode` is a
known-union with a string fallback.

**A malformed response is never converted into an empty array.** Returning `[]`
would make a contract break indistinguishable from a genuinely empty catalogue.

---

## Verification

### Static checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Passes |
| `npx expo lint` | ⚠️ 1 pre-existing unrelated error in `src/hooks/use-color-scheme.web.ts`. 0 warnings. |
| `npx expo-doctor` | ✅ 21/21 checks pass |
| `npx vitest run` | ✅ 85/85 pass |

### Test suite

`src/lib/catalogue-api.test.ts`, 85 assertions against a stubbed `fetch` in a
Node environment. No jsdom, no Metro transform, no React renderer — the client
is plain TypeScript.

Covered: request method and path for all four endpoints; every sort value;
multiple parameters combined; query-parameter omission for absent options; URL
encoding for both a query value and a path segment; valid responses returned
verbatim; empty results accepted as success; ~25 malformed bodies rejected per
endpoint; 400/404/405/500/418 error envelopes preserving status, code and
message; unknown future codes; HTML/non-JSON bodies on both 2xx and non-2xx;
network failure; and authentication with and without a session.

### Cart regression tests

The last describe block pins the behaviour that already existed, because
`request()` is now shared between both families: a cart call still requires a
session, still sends the bearer token, still surfaces `INSUFFICIENT_STOCK` with
its own code, still falls back to `CART_FAILED` (not `CATALOGUE_FAILED`), and
still rejects a malformed cart rather than returning an empty one.

---

## Not verified

- **No device verification.** The test device has known DNS/internet problems.
  Nothing in this phase has been observed running in the app.
- **No live request against a running `next dev`.** Unlike Phase 3.2A, the
  catalogue endpoints have not been exercised over the wire from this machine.
  The schemas are written against the server's source
  (`lib/catalogue/types.ts`, `app/api/catalogue/**/route.ts`), not against a
  captured response.
- **No catalogue UI exists**, so nothing consumes these methods yet. Typecheck
  and lint confirm the client compiles; they cannot confirm the shapes match a
  real deployment.

---

## Notes for the next phase

- `useApi()` returns `null` when signed out, so **a catalogue screen must not
  gate on it.** The endpoints are public. Either widen the hook or construct the
  client directly with `createApiClient(null)` for catalogue-only screens.
- `Product` carries `stockQuantity` but not a derived availability flag. The
  server's `getAvailability()` (`out_of_stock` / `low_stock` / `in_stock`,
  threshold 5) has no mobile equivalent yet — decide whether to add one in
  `src/lib/catalogue-schema.ts` or compute it where it is used.
- `price` is a number in naira. Formatting is `en-NG` + `NGN` and is not part of
  this phase; the web app has `lib/format.ts` (`formatNaira`) to mirror.
- Related products are deliberately **not** implemented. The web app has
  `getRelatedProducts()` but exposes no endpoint for it; adding one is a web
  change and out of this phase's scope.

---

## Environment

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | API root including `/api`; endpoints resolve relative to it |
| `EXPO_PUBLIC_SUPABASE_URL` | Auth only — the catalogue does not use Supabase directly |
| `EXPO_PUBLIC_SUPABASE_KEY` | Auth only |

---

## Next Phase

Catalogue UI — product listing with category filter, search and sort; product
detail with size selection; and wiring into the existing tabs.