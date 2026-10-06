# PROJECT_STATUS.md — NORTH & FORM Mobile

**Current as of:** 2025-10-05

## Current Phase

**Phase 3.3C-1 — catalogue navigation + product listing.** Authentication
(3.1), the API client and cart foundation (3.2A) and the catalogue data layer
(3.3B) are complete. The **Shop** tab now browses, filters, searches and sorts
the live catalogue, and navigates to a product-detail route. Product detail
itself is Phase 3.3C-2.

## Completed

**Phase 3.1 — authentication (verified on physical Android device)**

- [x] Expo 57 project (`expo@~57.0.26`, `react-native@0.86.3`, `react@19.2.3`)
- [x] Expo Router with `src/app` as the route root and typed routes enabled
- [x] Supabase mobile client (`@supabase/supabase-js` + AsyncStorage adapter)
- [x] Explicit `flowType: 'pkce'`, `detectSessionInUrl: false`
- [x] Persisted sessions via AsyncStorage — survives app restart
- [x] Native Google OAuth via `expo-web-browser`, `northform://auth/callback`
- [x] Exactly one `exchangeCodeForSession()` call, owned by `AuthProvider`
- [x] `src/app/auth/callback.tsx` callback landing route
- [x] Session restore on cold start, plus sign-out / sign-in

**Phase 3.2A — API client + cart foundation**

- [x] Zod schemas and inferred types for `Cart` / `CartLine` (`src/lib/cart-schema.ts`)
- [x] React-free API client with bearer injection (`src/lib/api.ts`)
- [x] All five cart endpoints with exact server semantics
- [x] Error normalization: `ApiError`, `NetworkError`, `InvalidResponseError`,
      `UnauthenticatedError`
- [x] `useApi()` hook reading the token from the existing `AuthProvider`
- [x] `CartProvider` / `useCart()` — server-authoritative, no optimistic updates
- [x] `EXPO_PUBLIC_API_URL` configured; `.env.example` added
- [x] **Authenticated round trip verified**: real device session token → Bearer →
      local `GET /api/cart` → **200** with a valid `Cart`

**Phase 3.3B — catalogue data layer**

- [x] `Category` / `Product` / `ProductSort` Zod schemas (`src/lib/catalogue-schema.ts`),
      mirroring the server's `lib/catalogue/types.ts`
- [x] Four catalogue methods on the existing client: `getCategories()`,
      `getProducts({ category?, search?, sort? })`, `getProductBySlug(slug)`,
      `getFeaturedProducts(limit?)`
- [x] Single shared `request()` in `src/lib/api.ts`; `requireAuth` is the only
      difference between the cart and catalogue families — no second HTTP client
- [x] Public access: catalogue calls need no session, and the bearer token is
      still attached when one exists
- [x] `URLSearchParams` encoding for query values; `encodeURIComponent` for the
      slug path segment; absent options omitted rather than sent as placeholders
- [x] Guards for an empty slug (which would otherwise address the *product list*
      route) and an out-of-range `limit`
- [x] Malformed responses become `InvalidResponseError`; never an empty array
- [x] Per-family fallback codes (`CART_FAILED` / `CATALOGUE_FAILED`); server
      error codes, statuses and customer-safe messages preserved
- [x] Vitest suite: **85 assertions passing**, including cart regression tests
      over the shared request path
- [x] No UI, no provider, no state added

**Phase 3.3C-1 — catalogue navigation + product listing**

- [x] Explore tab replaced by a **Shop** tab (`(tabs)/shop.tsx` → `/shop`); the
      unused Expo template `explore.tsx` deleted
- [x] Two-column product grid: image, category, name, naira price, availability
- [x] Image placeholder for a missing `images` entry **and** for a URL that fails
      to load
- [x] Category filter (`getCategories()`) — "All" plus each category; changing it
      refetches through the API rather than filtering the loaded page
- [x] Search via the API's `search` param: 350 ms debounce plus immediate
      keyboard submit. No search library
- [x] Sort over the five server-supported orders, human-readable labels, modal
      picker. No invented sort values
- [x] Loading / empty / error states distinguished; error uses `toUserMessage()`
      with retry; nothing logged; empty state separates "no matches" from
      "catalogue empty"
- [x] `useCatalogueApi()` — public reads with an optional bearer token; never
      returns `null`. No authentication semantics changed
- [x] `/product/[slug]` route established as the 3.3C-2 contract (outside the
      tabs group, slug as a router param, already URL-decoded). Detail UI deferred
- [x] Loading state **derived** from a stored query key, so no `setState` in an
      effect body and overlapping requests cannot overwrite newer results
- [x] `getAvailability()` added to `catalogue-schema.ts`, matching the web
      threshold; `formatNaira()` mirrors the web `en-NG`/NGN formatter
- [x] Native SF Symbol / Material tab icon — **no new dependency**
- [x] Accessibility: card labels, chip/sort roles and selected state, input label,
      live regions, 44pt targets
- [x] Vitest: **96 passing** (85 carried over + 11 for the new pure helpers)
- [x] Android Metro bundle builds; web tab variant kept in sync

## Known Limitations

- **The catalogue has still never been called over the wire.** Phases 3.3B and
  3.3C-1 are unit-tested against a stubbed `fetch`. No request has been made to a
  running `next dev`, so the schemas were never confirmed against a real
  deployment — they were written from the server's source.
- **`Intl.NumberFormat` on Hermes is unconfirmed.** `formatNaira` is verified
  under Node in the test suite. Hermes ships a reduced `Intl`, so `₦28,000` should
  be re-checked on a device — it is the most likely thing to differ between a
  passing test and the running app.
- **The catalogue screen has not run on a device.** Blocked by the known DNS
  problem. No screen has been seen rendering real data.
- **`npx expo export --platform web` fails** with `ReferenceError: window is not
  defined` inside `@expo/router-server`. Confirmed **pre-existing**: it fails
  identically with a clean tree at HEAD. The Android bundle, which is what ships,
  builds fine. Left alone as an unrelated issue.
- **The production origin does not yet serve the cart API.**
  `https://northform-livid.vercel.app/api/cart` returns `404` (HTML); its
  deployment predates the cart API commits. Redeploy the web app, or test against
  a LAN address (already the `.env.local` default).
- The app's *own* automatic `getCart()` has not yet been observed on device: the
  test device had no working DNS, so `getSession()` never resolved and the app
  stayed on the splash screen. Not a code issue — restore connectivity and relaunch.
- Runtime warning: `WebCrypto API is not supported. Code challenge method will
  default to use plain instead of sha256.` Observed during the successful device
  test; authentication completed normally. Do not assume S256 is in use.
- Dev-only warning on cold-start deep links: "Can't perform a React state update
  on a component that hasn't mounted yet" from `expo-router`'s
  `useLinking.native.js:127`. Internal to Expo Router, not caused by app code; see
  `docs/phase-3-1.md`. Does not appear in release builds.
- If the OS kills the app while the browser is open, the callback route returns the
  user to sign-in instead of completing authentication (intentional).
- The `APP_SCHEME` / `AUTH_CALLBACK_PATH` constants left unused by the
  `createURL()` removal have been deleted; the redirect is a single named
  constant, `AUTH_REDIRECT_URL`.

## Next (Not Yet Implemented)

- **Phase 3.3C-2 — product detail**: `/product/[slug]` exists as a contract but
  renders a placeholder. It needs `getProductBySlug(slug)`, the gallery,
  description, size selection, availability, and add-to-cart via `CartProvider`
- Cart UI (line list, quantity stepper, remove, clear, subtotal)
- Checkout and orders
- Related products — requires a new endpoint on the **web** side first

For 3.3C-2: `useLocalSearchParams<{ slug: string }>()` returns an already-decoded
slug, so pass it straight to `getProductBySlug()` with no extra decoding.
`getAvailability(product.stockQuantity)` is already available. Do not gate the
detail screen on `useApi()` returning non-null — catalogue endpoints are public;
use `useCatalogueApi()`. See `docs/phase-3-3c-1.md`.

See `docs/phase-3-1.md` for authentication, `docs/phase-3-2a.md` for the API
client and cart foundation, `docs/phase-3-3b.md` for the catalogue data layer,
and `docs/phase-3-3c-1.md` for the catalogue UI and the detail-route contract.

## Backend Relationship

The mobile app consumes the existing **NORTH & FORM web/API backend** (parent
`north-form` repository) and uses the **same Supabase project/account**. It sends
the Supabase access token as `Authorization: Bearer <access_token>`, which the web
API already supports.

Do not duplicate the backend architecture here.

## Important Configuration

| Setting | Value | Status |
|---|---|---|
| Expo scheme (`app.json`) | `northform` | Configured |
| Auth callback URL | `northform://auth/callback` | **Hardcoded literal** in `auth.tsx`; allow-listed in Supabase |
| Android intent filter | `<data android:scheme="northform"/>` | In generated `android/`; requires `npx expo run:android` |
| Callback route | `src/app/auth/callback.tsx` | Implemented |
| Shop tab | `src/app/(tabs)/shop.tsx` → `/shop` | Implemented, not device-verified |
| Product detail route | `src/app/product/[slug].tsx` → `/product/[slug]` | Contract only; UI in 3.3C-2 |
| Supabase project | Shared with web app | Configured |
| `EXPO_PUBLIC_API_URL` | `http://192.168.0.12:3000/api` (local) | `.env.local`; production Vercel origin still 404s on `/api/cart` |

## Verification State

| Check | Status |
|---|---|
| Project starts (`npx expo start`) | ✅ Verified |
| `npx tsc --noEmit` | ✅ Passes |
| `npx expo-doctor` | ✅ 21/21 checks pass |
| `npx expo lint` | ⚠️ 1 pre-existing unrelated error in `src/hooks/use-color-scheme.web.ts` |
| Google OAuth on physical Android | ✅ Verified end to end |
| OAuth callback returns to app | ✅ Verified |
| PKCE code exchange | ✅ Verified |
| Session persists across restarts | ✅ Verified |
| Sign out / sign in | ✅ Verified |
| Cart API method/route behaviour vs live backend | ✅ Verified against `next dev` |
| API client request shapes and error handling | ✅ 26 assertions against a stub |
| **Authenticated `GET /api/cart` with a real token** | ✅ **200 + valid Cart** (device session → local `next dev`) |
| Response validated by app's own Zod schema | ✅ Passes |
| Catalogue client request shapes, encoding and validation | ✅ 85 assertions against a stub |
| Cart behaviour after the request path was shared | ✅ Regression-tested in the same suite |
| `getAvailability` / `formatNaira` boundaries | ✅ 11 assertions |
| Full vitest suite | ✅ 96/96 |
| Android Metro bundle | ✅ Builds (5.1 MB `.hbc`) |
| Web Metro bundle | ⚠️ **Pre-existing failure** — fails identically at clean HEAD |
| **Catalogue endpoints against a live server** | ⏳ **Not done** — stub only, no live request |
| Catalogue screen rendering real data | ⏳ **Not done** — never run on a device |
| `Intl` Naira formatting on Hermes | ⏳ **Not done** — verified under Node only |
| Product detail screen | ⏳ Contract only; UI deferred to 3.3C-2 |
| In-app automatic `getCart()` observed on device | ⏳ Blocked by device DNS |
| No secrets exposed | ✅ Only public anon key in client |
| Parent web project unaffected | ✅ Separate directory |

## Handoff Guidance

1. Read `AGENTS.md` — always-loaded context, stack versions, invariants, commands
2. Read `PROJECT_STATUS.md` — current state, what's done vs. pending
3. Read `docs/README.md` — documentation index
4. Read `docs/phase-3-1.md` — authentication architecture, verification, debugging history
5. Read `docs/phase-3-2a.md` — API client and cart foundation
6. Read `docs/phase-3-3b.md` — catalogue data layer
7. Read `docs/phase-3-3c-1.md` — catalogue UI and the product-detail contract
8. Inspect the actual implementation before making changes

Verify everything from the codebase rather than assuming.