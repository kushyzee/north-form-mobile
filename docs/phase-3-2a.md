# Phase 3.2A — API Client & Cart Foundation

**Status:** Implemented; authenticated round trip verified end to end
**Last updated:** 2025-10-05

---

## Objective

Give the mobile app a reusable client for the existing NORTH & FORM API and a
minimal, server-authoritative cart state foundation. Scope is deliberately the
transport and state layers only — no cart screen, no catalogue, no checkout.

Phase 3.1 delivered authentication. This phase consumes it: the Supabase access
token becomes an `Authorization: Bearer` header on every request.

---

## Architecture

```
Supabase session (AuthProvider)
  → useApi() reads session.access_token
  → createApiClient(token)              [src/lib/api.ts, React-free]
  → fetch(`${EXPO_PUBLIC_API_URL}/cart…`, { Authorization: Bearer … })
  → existing Next.js API
  → response validated with Zod (src/lib/cart-schema.ts)
  → Cart | typed error
  → CartProvider replaces its cart      [src/context/cart.tsx]
```

Three layers, each with one job:

| Layer | File | Responsibility |
|---|---|---|
| Schemas & types | `src/lib/cart-schema.ts` | `Cart`, `CartLine`, error envelope, request inputs, Zod validation |
| Transport | `src/lib/api.ts` | Bearer injection, HTTP semantics, error normalization. No React |
| React integration | `src/hooks/use-api.ts` | Reads the token from `AuthProvider`, returns a client or `null` |
| State | `src/context/cart.tsx` | Holds the server-confirmed `Cart`, exposes mutations |

`src/lib/api.ts` imports nothing from React, Expo Router, or any provider. It can
be called from a test or a future Node script as-is.

---

## Implementation

### `src/lib/cart-schema.ts`

Zod schemas are the single source of truth; TypeScript types are inferred from
them, so the two cannot drift.

- `cartLineSchema` — requires `productId`, `productName` and `size` to be
  non-empty strings, and every number to be finite. This is what stops
  `₦undefined` and `undefined × quantity` reaching a screen.
- `cartSchema` — requires `items` to be an array and `itemCount`/`subtotal` to be
  numbers.
- `maxQuantity` is validated as a **non-negative** integer, not positive: the API
  sends `Math.max(stock_quantity, 0)`, so `0` is legitimate for an out-of-stock
  product and must not fail validation.
- `errorEnvelopeSchema` — the `{ error: { code, message } }` shape.
- `KNOWN_CART_ERROR_CODES` is a documented list, but the exported
  `ApiErrorCode` type is `KnownCartErrorCode | (string & {})`. An unknown code
  from the server is a normal outcome, not a crash.

### `src/lib/api-error.ts`

Four distinct failure modes, so a caller can tell "the server said no" from "the
network is down" from "the server sent something unexpected":

| Error | Meaning |
|---|---|
| `ApiError` | Non-2xx with a valid envelope. Keeps `status`, `code`, `message` |
| `NetworkError` | No HTTP response at all. Never presented as a server 500 |
| `InvalidResponseError` | 2xx whose body failed `Cart` validation |
| `UnauthenticatedError` | No session, so no request was made |

`toUserMessage()` maps any of these to a safe string. It prefers the server's
customer-safe text and otherwise falls back per class. Raw proxy bodies, HTML
error pages and JSON parse exceptions are never surfaced.

### `src/lib/api.ts`

`createApiClient(accessToken)` returns `getCart`, `addItem`, `setQuantity`,
`removeItem`, `clearCart`. Endpoint paths are appended to
`EXPO_PUBLIC_API_URL` (`/cart`, `/cart/items`) — the variable already includes
`/api`, and nothing re-appends it. No origin is hardcoded, so pointing at a LAN
address or tunnel is a one-line env change.

Request construction: `Authorization: Bearer <access_token>` always;
`Content-Type: application/json` only when there is a body.

Failure handling:

- A `fetch` throw becomes `NetworkError`.
- The body is read through a helper that swallows parse failures, so an HTML
  gateway page cannot escape as a `SyntaxError`.
- Non-2xx **with** a valid envelope → `ApiError` preserving status, code, message.
- Non-2xx **without** an envelope → `ApiError` with a generic per-status message.
  The raw body is discarded.
- 2xx that fails `cartSchema` → `InvalidResponseError`. There is deliberately no
  fallback to `{ items: [], itemCount: 0, subtotal: 0 }`; that would mask a
  backend contract break as an empty cart.

HTTP semantics, matching the backend exactly:

| Method | Call | Semantics |
|---|---|---|
| `GET /cart` | `getCart()` | No body |
| `POST /cart/items` | `addItem()` | **Increments.** Body `{ productId, size, quantity }` |
| `PATCH /cart/items` | `setQuantity()` | **Sets absolute.** Same body |
| `DELETE /cart/items` | `removeItem()` | JSON body `{ productId, size }` — this endpoint intentionally takes one |
| `DELETE /cart` | `clearCart()` | No body |

Guards: `quantity` must be a positive integer on both POST and PATCH. PATCH with
`0` is rejected client-side because the API answers `400 INVALID_QUANTITY`;
removal is a DELETE. `lineId` and `migrationId` are never sent — `lineId` is a
derived display key, `migrationId` belongs to the web anonymous-cart migration.

### `src/hooks/use-api.ts`

`useApi()` reads `session.access_token` via the existing `useAuth()` and returns a
memoized client, or `null` when signed out. No second session store, no manually
persisted token. `createApiClient` throws `UnauthenticatedError` for a `null` or
whitespace-only token, so `Authorization: Bearer undefined` is not reachable.

### `src/context/cart.tsx`

`CartProvider` is mounted inside `AuthProvider` in `src/app/_layout.tsx`.

State is tagged with the user id it belongs to (`{ userId, value }`) and read
back through a derivation, so `cart` and `error` are `null` unless they belong to
the *current* user. Signing out or switching accounts therefore drops the previous
cart as a consequence of rendering, rather than an effect writing to state.

- Loads once when auth has settled and a session exists. Not while `authLoading`,
  not when signed out. The effect writes state only from promise callbacks, and
  cancels on cleanup so a slow response cannot land after unmount.
- `loading` is `true` while the initial load is outstanding or a mutation is in
  flight.
- Mutations replace `cart` with the server's response. No local quantity
  arithmetic, no follow-up GET.
- `error` is the raw typed error. The context does not flatten errors into display
  strings; UI decides that. Use `toUserMessage()` from `src/lib/api-error.ts`.

---

## Verification

### Confirmed by inspection of the backend

Read from `../north-form` — the mobile client was written against these:

- `app/api/cart/route.ts` exports GET, DELETE, and 405s POST/PUT/PATCH.
- `app/api/cart/items/route.ts` exports POST, PATCH, DELETE, and 405s GET/PUT.
  Its comment confirms lines are addressed by `productId` + `size`, and that every
  success returns the whole cart.
- `lib/cart/queries.ts` defines `Cart`/`CartLine` exactly as validated here,
  including `lineId` as `${productId}::${size}` and
  `maxQuantity: Math.max(stock_quantity, 0)`.
- `lib/cart/schema.ts` uses `strictObject`, so an unexpected key is rejected — a
  reason the client must not send `lineId` or `migrationId`.
- `lib/auth/session.ts` verifies the bearer token with Supabase and derives the
  user from the JWT.

### Confirmed by live requests against a running backend

`next dev` on the parent repo, real Supabase project:

| Request | Result |
|---|---|
| `GET /api/cart` no auth | `401 UNAUTHENTICATED` |
| `GET /api/cart` `Bearer <forged JWT>` | `401 UNAUTHENTICATED` |
| `GET /api/cart` `Bearer undefined` | `401 UNAUTHENTICATED` |
| `GET /api/cart` `Bearer ` (empty) | `401 UNAUTHENTICATED` |
| `POST /api/cart` | `405` |
| `GET /api/cart/items` | `405` |
| `DELETE /api/cart`, `POST`/`DELETE /api/cart/items` | `401` |

Method and route behaviour matches what the client sends.

### Client behaviour

Exercised against a stub server reproducing the documented responses (26
assertions, all passing):

- Correct method, path, `Authorization` and body for all five operations.
  `Content-Type` is present only when a body is sent; `DELETE /cart` sends none;
  `DELETE /cart/items` sends exactly `{ productId, size }`.
- POST increments (2 → 5 after `quantity: 3`).
- 409 / 404 / 400 map to `ApiError` with status, code and message preserved.
- An unknown server code (`SOMETHING_NEW`) is accepted without crashing.
- HTML 500 and HTML 502 bodies become `ApiError` with a safe message, and the
  raw markup does not appear in `message`.
- A 2xx body that fails `Cart` validation becomes `InvalidResponseError`, with no
  empty-cart fallback.
- Unreachable host → `NetworkError`, not a 500.
- `quantity: 0` and negative quantity rejected before any request.
- `null` and whitespace-only tokens rejected without sending a request.

### Static checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Passes |
| `npx expo-doctor` | 21/21 checks pass |
| `npx expo lint` | 1 error, pre-existing and unrelated (`src/hooks/use-color-scheme.web.ts`) |

---

### Authenticated round trip — VERIFIED

The previously-unproven chain is now established:

```
real device Supabase access token
  → Authorization: Bearer <token>
  → local Next.js GET /api/cart
  → 200 with a valid Cart
```

Supabase signups remained unusable (`over_email_send_rate_limit`, 429, plus email
confirmation), so the credential used was the **real session already persisted on
the attached device**. It was read via `adb shell run-as
com.anonymous.northformmobile cat .../databases/RKStorage` and sent to the local
`next dev` server.

Result: **HTTP 200** with a populated cart — one line, `Plain T-Shirt`, size
`XXL`, quantity 1, `unitPrice: 22000`, `subtotal: 22000`, `maxQuantity: 40`.

The token was independently confirmed live and authentic: `iss`
`…supabase.co/auth/v1`, `aud`/`role` `authenticated`, unexpired, and `sub`
matching the persisted session's user id.

Negative controls, so the 200 is not passing by accident:

| Credential | Result |
|---|---|
| No `Authorization` header | `401 UNAUTHENTICATED` |
| Tampered JWT signature | `401` |
| `Bearer undefined` | `401` |

The response body was then run through this project's **own** `cartSchema.safeParse`
(copied verbatim from `src/lib/cart-schema.ts`): **PASS**, with a negative control
correctly rejecting a malformed line. So the payload satisfies the exact validation
`CartProvider` applies.

### Observation technique (no permanent debug code)

The request was observed with a throwaway logging reverse proxy rather than any
change to `src/`:

```
device app → proxy :4000 (logs, forwards verbatim) → next dev :3000
EXPO_PUBLIC_API_URL=http://<lan-ip>:4000/api
```

The proxy logs method, path, status, timing, request/response bodies, and a
**redacted** `Authorization`: presence, scheme, a sha256 fingerprint, and
non-sensitive claims (`iss`, `aud`, `role`, truncated `sub`, `exp`). No token value
is ever printed. This is reusable for the cart mutations in the next phase, which
it forwards verbatim.

### Not yet observed

The app's **own** automatic `getCart()` (from `CartProvider`'s mount effect) did
not fire during the test. Cause: the device had no working DNS
(`UnknownHostException` in logcat), so `AuthProvider`'s `getSession()` never
resolves, the app stays on the splash screen, and no effect runs. Metro (`:8081`)
and the proxy (`:4000`) were both reachable over raw IP — only name resolution
was broken. Restore DNS/Wi-Fi and relaunch to observe the in-app request; no
further instrumentation is needed.

### Production origin

`https://northform-livid.vercel.app/api/cart` still returns `404` with an HTML
body, while `/api/orders` returns a proper `401` JSON envelope. That deployment
predates commit `27783f3` (the cart API). Redeploy the web app before pointing a
device at production; for local testing use the LAN address.

---

## Notes for the next phase

- Cart UI should read `cart`, `loading` and `error` from `useCart()` and render
  with `toUserMessage(error)`.
- `lineId` is stable per `productId::size`, which suits list keys, but it must not
  be sent back to the API.
- A stepper should cap at `maxQuantity` (which may be `0` for sold-out products)
  and use `DELETE` for removal rather than PATCH with `0`.
- If mutations need retry, the 401 path is the one to handle: the access token may
  have expired, and Supabase's auto-refresh runs independently of the request.

---

## Environment

`EXPO_PUBLIC_API_URL` is the API root **including** `/api`. See `.env.example`.

```text
Production: https://northform-livid.vercel.app/api   (currently missing the cart API)
Local:      http://192.168.x.x:3000/api              (LAN IP — localhost is the device)
```

---

## Next Phase

Cart UI (line list, quantity stepper, remove, clear, subtotal), then catalogue
and product detail.