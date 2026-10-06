# PROJECT_STATUS.md — NORTH & FORM Mobile

**Current as of:** 2025-10-05

## Current Phase

**Phase 3.3C-2 — product detail + add to cart (device-verified).** Authentication
(3.1), the API client and cart foundation (3.2A), the catalogue data layer (3.3B)
and the Shop listing (3.3C-1) are complete. `/product/[slug]` fetches a real
product, shows its gallery and details, takes a size and quantity, and adds it to
the server-authoritative cart.

This is the first phase where any screen has been seen rendering real data on a
device. Cart UI is next.

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

**Phase 3.3C-2 — product detail, size/quantity selection, add to cart**

- [x] `/product/[slug]` fetches through `getProductBySlug()` on the **public**
      client (`useCatalogueApi()`, never `useApi()`); the slug is passed through
      already-decoded
- [x] Horizontal image gallery, `expo-image` only — **no new dependency**. Empty
      array, empty entries and per-image load failures each fall back to the
      product-initial placeholder; failures are tracked **per index** so one bad
      URL cannot blank the gallery
- [x] Product info: category, name, `formatNaira` price, description, and
      availability distinguishing in stock / low stock / sold out via
      `getAvailability()` + `LOW_STOCK_THRESHOLD`. No per-size stock is claimed —
      the schema has no per-size stock column
- [x] Size selection as single-select radio chips; an empty `sizes` array renders
      no selector rather than a broken one
- [x] Quantity stepper, min 1, no negatives or zero, increment disabled at the
      ceiling and decrement disabled at 1 — enforced in the change handler, not
      only in the disabled style
- [x] Add to cart via `useCart().addItem()`. **No** direct `POST`, **no**
      `setQuantity()`, no local count increment, no optimistic state
- [x] Button disabled while submitting (prevents double-tap double-increment), on
      a sold-out product, with no size selected, and when nothing more can be
      added — each with copy explaining why
- [x] `PRODUCT_NOT_FOUND` gets its own not-found view + "Back to shop" and **no**
      retry; matched on the error **code**, not the status, so a proxy 404 is not
      mistaken for a deleted product
- [x] Network/server failure reuses the catalogue error pattern with
      `toUserMessage()` and a retry; `INSUFFICIENT_STOCK` / `INVALID_SIZE` render
      inline, leaving the screen usable and the quantity adjustable
- [x] One shared `CartProvider` error slot is guarded by a local `hasAttempted`
      flag, so an error from its initial load is never shown as a failed add
- [x] Success feedback via a **dependency-free toast** (`src/components/toast.tsx`,
      `ToastProvider` + `useToast()`), built on the existing
      `react-native-reanimated` rather than a new library. Non-modal, auto-dismiss,
      `pointerEvents="none"`, mounted outside the navigator so it overlays tabs
      and pushed screens alike. Replaced an initial `Alert`, which was modal and
      blocked the shopper until dismissed
- [x] Loading **derived** from a stored `queryKey` carrying the reload token, so
      a retry really does re-enter the loading state
- [x] Pure logic extracted to `src/lib/product-detail.ts` so it is directly
      testable; screen split into gallery / size selector / stepper / buy panel
- [x] Vitest: **148 passing** (96 carried over + 52 new). No existing test
      weakened or removed
- [x] Android Metro bundle builds; lint clean apart from the pre-existing error
- [x] **Catalogue schemas confirmed against a live server** — 12 real products
      validated, closing a limitation open since 3.3B
- [x] **Verified on a physical Android device** against the live LAN API as a
      signed-in shopper: product loads, gallery renders, `₦35,000` correct on
      Hermes, availability both variants, size selection exclusive, quantity
      1→4 with a hard floor at 1 (`enabled=false`), add-to-cart succeeds, and
      **the additive semantics confirmed live — 2 existing + 2 added = 4**
- [x] `PRODUCT_NOT_FOUND` view with no retry, and "Back to shop" → Shop tab
- [x] Shop tab (3.3C-1) confirmed rendering live catalogue data
- [x] Cart state restored to its original value after testing

## Known Limitations

- **`expo-doctor` reports 20/21 — upstream patch drift, not a code problem.**
  `expo`, `expo-router`, `expo-constants`, `expo-linking` and `@expo/ui` each
  published a newer patch while this phase was in progress. `package.json` and
  `pnpm-lock.yaml` are **unmodified** by this phase, and no dependency was added,
  so the mismatch is purely the registry moving. Upgrading is out of scope for
  3.3C-2; run `npx expo install --check` to review deliberately.
- **Low-stock and sold-out are unreachable on the live catalogue.** All 12
  products report `in_stock`, so those two branches are covered by unit tests but
  have never been rendered. Reaching them means editing catalogue data.
- **The network-failure / retry path was not triggered on device** — it needs the
  API stopped or unreachable, which would disrupt the running server. It is the
  same `reloadToken` bump `shop.tsx` uses.
- **The `INSUFFICIENT_STOCK` inline message was never seen rendered.** The
  server's `409` was confirmed live, but the client-side ceiling prevents
  requesting a quantity that would be rejected. Seeing it needs stock to shrink
  between the product read and the press.
- **`Intl.NumberFormat` is now confirmed on Hermes** — `₦35,000` rendered
  correctly on device, closing the concern carried since 3.3C-1.
- **Dev-client gotcha:** a USB device needs `adb reverse tcp:8081 tcp:8081`, or
  the app fails with `Unable to load script` — which looks like a bundling
  problem but is only a missing tunnel. Metro must also be started detached.
- **`INVALID_QUANTITY` is unreachable through the HTTP add endpoint** — the
  server's Zod layer answers `400 INVALID_REQUEST` for a bad quantity first. Do
  not branch UI on that code for the add path.
- **The production origin does not yet serve the cart API.**
  `https://northform-livid.vercel.app/api/cart` returns `404` (HTML); its
  deployment predates the cart API commits. Redeploy the web app, or test against
  a LAN address (already the `.env.local` default).
- **`npx expo export --platform web` fails** with `ReferenceError: window is not
  defined` inside `@expo/router-server`. Confirmed **pre-existing**: it fails
  identically with a clean tree at HEAD. The Android bundle, which is what ships,
  builds fine. Left alone as an unrelated issue.
- Runtime warning: `WebCrypto API is not supported. Code challenge method will
  default to use plain instead of sha256.` Observed during the successful device
  test; authentication completed normally. Do not assume S256 is in use.
- Dev-only warning on cold-start deep links: "Can't perform a React state update
  on a component that hasn't mounted yet" from `expo-router`'s
  `useLinking.native.js:127`. Internal to Expo Router, not caused by app code; see
  `docs/phase-3-1.md`. Does not appear in release builds.
- If the OS kills the app while the browser is open, the callback route returns the
  user to sign-in instead of completing authentication (intentional).

## Next (Not Yet Implemented)

- **Cart UI** — line list, quantity stepper capped at each line's `maxQuantity`,
  remove, clear, subtotal. `setQuantity()` and `removeItem()` are built and
  currently used by no screen
- Checkout and orders
- Related products — requires a new endpoint on the **web** side first
- Physical-device verification, which needs a device attached over adb and the
  local `next dev` reachable over LAN

For the cart UI: read `cart`, `loading` and `error` from `useCart()` and render
with `toUserMessage(error)`. A line's `maxQuantity` is **total product stock**,
not per-size, and the server checks the resulting total — so use
`availableToAdd()` from `src/lib/product-detail.ts` rather than a raw ceiling.
See `docs/phase-3-3c-2.md`.

See `docs/phase-3-1.md` for authentication, `docs/phase-3-2a.md` for the API
client and cart foundation, `docs/phase-3-3b.md` for the catalogue data layer,
`docs/phase-3-3c-1.md` for the catalogue UI, and `docs/phase-3-3c-2.md` for
product detail and the additive cart semantics.

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
| Product detail route | `src/app/product/[slug].tsx` → `/product/[slug]` | Implemented, not device-verified |
| Supabase project | Shared with web app | Configured |
| `EXPO_PUBLIC_API_URL` | `http://192.168.0.12:3000/api` (local) | `.env.local`; a `next dev` was reachable on the host at `127.0.0.1:3000` during 3.3C-2 |

## Verification State

| Check | Status |
|---|---|
| Project starts (`npx expo start`) | ✅ Verified |
| `npx tsc --noEmit` | ✅ Passes |
| `npx expo-doctor` | ⚠️ **20/21** — see [expo-doctor patch drift](#expo-doctor-patch-drift); was 21/21 earlier in this phase |
| `npx expo lint` | ⚠️ 1 pre-existing unrelated error in `src/hooks/use-color-scheme.web.ts`; **0 warnings** |
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
| **Catalogue endpoints against a live server** | ✅ **12 real products validated by `productSchema`** (3.3C-2) |
| **Live 404 / empty-slug behaviour** | ✅ `PRODUCT_NOT_FOUND` and `INVALID_REQUEST` confirmed live |
| Product-detail quantity/ceiling logic | ✅ 52 assertions |
| Full vitest suite | ✅ **148/148** |
| Android Metro bundle | ✅ Builds (5.1 MB `.hbc`) |
| Web Metro bundle | ⚠️ **Pre-existing failure** — fails identically at clean HEAD |
| **Product detail screen rendering real data** | ✅ **Verified on physical Android** — see `docs/phase-3-3c-2.md` |
| **Add to cart against a live API** | ✅ **Verified** — 201, and the increment confirmed: 2 existing + 2 added = **4** |
| **Broken product image dropped per-index** | ✅ **Verified** — live `text/html` dashboard URL, gallery kept its sibling |
| **Quantity floor at 1 / decrement `enabled=false`** | ✅ **Verified** via `uiautomator` attributes |
| **Success toast** | ✅ **Verified on device** — non-modal, auto-dismiss, correct running total |
| **Not-found view + Back to shop** | ✅ **Verified** |
| Shop screen rendering real data | ✅ **Verified** — 12 live products, grid/filters/sort |
| Low-stock / sold-out rendering | ⏳ Not reachable — all 12 live products are `in_stock` |
| `INSUFFICIENT_STOCK` inline message | ⏳ Server `409` confirmed live; UI path blocked by the client ceiling |
| Network-failure retry path | ⏳ Not triggered — would require stopping the API |
| `Intl` Naira formatting on Hermes | ✅ **Verified** — `₦35,000`, `₦28,000`, `₦55,000` |
| iOS bundle | ⏳ Not built |
| No secrets exposed | ✅ Only public anon key in client |
| Parent web project unaffected | ✅ Separate directory; read-only access |

## Handoff Guidance

1. Read `AGENTS.md` — always-loaded context, stack versions, invariants, commands
2. Read `PROJECT_STATUS.md` — current state, what's done vs. pending
3. Read `docs/README.md` — documentation index
4. Read `docs/phase-3-1.md` — authentication architecture, verification, debugging history
5. Read `docs/phase-3-2a.md` — API client and cart foundation
6. Read `docs/phase-3-3b.md` — catalogue data layer
7. Read `docs/phase-3-3c-1.md` — catalogue UI and the product-detail contract
8. Read `docs/phase-3-3c-2.md` — product detail, additive cart semantics, live verification
9. Inspect the actual implementation before making changes

Verify everything from the codebase rather than assuming.