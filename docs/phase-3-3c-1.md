# Phase 3.3C-1 — Catalogue Navigation + Product Listing

**Status:** Implemented; typecheck, lint, bundle and unit tests pass.
**No device verification** — see [Not verified](#not-verified).
**Last updated:** 2025-10-05

---

## Objective

Turn the catalogue area into a working mobile shopping surface on top of the
Phase 3.3B data layer: browse, filter by category, search, sort, and navigate to
a product.

Scope is discovery only. No product-detail UI, no cart, no checkout.

---

## Route and navigation decisions

| Decision | Choice | Why |
|---|---|---|
| Catalogue entry point | The existing **Explore** tab, renamed **Shop** | The prompt asked not to redesign navigation. Explore was an unused Expo template screen, so replacing it changes no existing behaviour. |
| Explore screen file | `src/app/(tabs)/explore.tsx` **deleted** | It was template boilerplate, not product work. Nothing referenced it. |
| Listing route | `src/app/(tabs)/shop.tsx` → `/shop` | Inside `(tabs)`, so it renders under the tab bar like every other tab. |
| Detail route | `src/app/product/[slug].tsx` → `/product/[slug]` | **Outside** `(tabs)`, so it is a pushed stack screen with a header and back button rather than a tab destination. |
| Slug parameter | Expo Router params object | See [Slug encoding](#slug-encoding). |
| Tab icon | Native SF Symbol / Material glyph | See [Tab icon](#tab-icon). |

The `(tabs)` group contributes no path segment, so the Shop tab is also reachable
at `/shop` — which is what the web tab variant links to.

### Product detail is a contract, not a screen

`product/[slug].tsx` exists so the listing navigates somewhere real. It renders
the slug and states that 3.3C-2 replaces it. It deliberately does **not** call
`getProductBySlug()`: the phase boundary is the UI, and the data layer is already
done and tested.

Two contract details 3.3C-2 should not re-decide:

- the route is `/product/[slug]`, **not** inside `(tabs)`;
- `useLocalSearchParams<{ slug: string }>()` returns an **already-decoded**
  slug, so it goes straight into `getProductBySlug()` with no further decoding.

### Slug encoding

Navigation uses the params object:

```tsx
router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })
```

not a template string with a manual `encodeURIComponent`. Expo Router encodes
path parameters itself, so pre-encoding would encode twice and produce a slug the
API could not match. This is why `tsc` first failed here — typed routes made the
double-encoding visible.

Note the two ends differ deliberately: `getProductBySlug()` still uses
`encodeURIComponent` because it builds a URL by hand, which is a different job.

### Tab icon

`NativeTabs.Trigger.Icon` accepts `sf` (SF Symbols, iOS) and `md` (Material
Design, Android) props directly, so the Shop tab uses:

```tsx
<NativeTabs.Trigger.Icon
  sf={{ default: 'bag', selected: 'bag.fill' }}
  md={{ default: 'shopping_bag', selected: 'shopping_bag' }}
/>
```

**This avoided adding `lucide-react`.** The instructions permitted installing it,
but inspection showed the platform icons are already supported by the existing
`expo-router` and `expo-symbols` dependencies. The Android bundle confirms
`@expo-google-fonts/material-symbols` resolves through `expo-symbols`, which
`expo-router` already depends on — so the icon costs nothing, tints itself to the
theme, and stays sharp at any size, which the old PNG could not. The prompt's
"avoid adding libraries when the existing stack can reasonably solve the problem"
rule decides it. See [Deviations](#deviations).

---

## Public access, and why `useApi()` was not used

Catalogue endpoints are public. `useApi()` returns `null` when signed out, which
is correct for the cart but would render an empty shop to any signed-out visitor.

`useCatalogueApi()` reads the same `AuthProvider` and calls the same
`createApiClient()`:

```ts
const accessToken = session?.access_token ?? null;
return useMemo(() => createApiClient(accessToken), [accessToken]);
```

`createApiClient` already treats a catalogue read as public — it attaches
`Authorization` only when a token exists — so a signed-in shopper is still
recognised and a signed-out one is not blocked. It never returns `null`, which is
what lets the screen simply render.

**No authentication semantics changed.** No credential is invented, no session is
required, and there is no second HTTP client.

---

## Data and state handling

No Redux, Zustand, TanStack Query, provider, cache or pagination. Local
`useState` + two effects, mirroring how `CartProvider` is deliberately small.

### Loading is derived, not toggled

The React Compiler lint (`react-hooks/set-state-in-effect`) correctly rejects
`setLoading(true)` in an effect body. Instead, each completed request stores the
query key it belongs to:

```ts
type ProductsResult = { key: string; products: Product[]; error: unknown };
const settled = result !== null && result.key === queryKey;
const loading = !settled;
const error = settled ? result.error : null;
```

Three things fall out of that:

- **No imperative loading flags.** Nothing is written to state synchronously in an
  effect body.
- **Overlapping requests are safe** for free. Effect cleanup sets `cancelled`
  before the next request starts, so a slow earlier response is discarded rather
  than overwriting newer results. A `requestId` ref would have been redundant.
- **Retry is just a key change.** `reloadToken` is part of `queryKey`, so
  `setReloadToken(t => t + 1)` re-runs the same query with no separate path.

Categories use `Category[] | null`, where `null` means "not loaded yet" — the
same derivation, and it lets the toolbar say "Loading…" honestly.

### Results stay put during a refresh

`products` is read from `result` regardless of key, so the previous list stays on
screen while the next one loads and the page does not jump. An error clears the
list (`products: []`) so stale results are never presented as answering the
current query.

### Categories degrade, products do not

A failed `getCategories()` falls back to `[]` — the filter row shows "All" only
and browsing still works. A failed products request shows the error state with a
retry. An empty result is neither: it renders the empty state, which distinguishes
a filter that matched nothing from an unreachable catalogue.

### Search

350 ms debounce, plus immediate submit from the keyboard
(`onSubmitEditing`), because a shopper pressing return does not expect to wait.
No search library.

---

## Files

| File | Role |
|---|---|
| `src/app/(tabs)/shop.tsx` | The listing screen; owns query + fetch state |
| `src/app/product/[slug].tsx` | Detail route contract for 3.3C-2 |
| `src/components/catalogue/product-card.tsx` | Card: image, category, name, price, availability |
| `src/components/catalogue/product-grid.tsx` | Two-column grid, skeletons, "Updating…" |
| `src/components/catalogue/category-chips.tsx` | Horizontal category filter |
| `src/components/catalogue/catalogue-search.tsx` | Search field |
| `src/components/catalogue/sort-picker.tsx` | Sort sheet over the five supported orders |
| `src/components/catalogue/empty-state.tsx` | No results, filter-aware |
| `src/components/catalogue/error-state.tsx` | Failure + retry, customer-safe copy |
| `src/hooks/use-catalogue-api.ts` | Client for public endpoints |
| `src/lib/format.ts` | `formatNaira` / `formatItemCount` |
| `src/lib/catalogue-schema.ts` | **Modified** — added `getAvailability` |
| `src/app/_layout.tsx` | **Modified** — registered `product/[slug]` |
| `src/components/app-tabs.tsx`, `.web.tsx` | **Modified** — Shop label + icon |

`getAvailability` was added to `catalogue-schema.ts` rather than a new file
because the web app keeps it in `lib/catalogue/types.ts` beside `Product`, and it
is derived from `stockQuantity`. It is **derived, not transmitted** — the API
sends only `stockQuantity`, so nothing there validates a response.

---

## Behaviour

| State | What is shown |
|---|---|
| First load | Skeleton cards, "Loading…" count, no blank screen |
| Refiltering | Previous results stay, "Updating…" spinner, pull-to-refresh |
| No matches | Empty state; says filters excluded everything, offers "Clear filters" |
| Empty catalogue | Empty state with different copy, no clear-filters button |
| Failure | `toUserMessage(error)` + "Try again"; no raw error, no logging |
| Categories fail | Filter row degrades to "All"; listing unaffected |

Availability is conveyed by **text** ("Sold out" / "Low stock"), never colour
alone, mirroring the web cards.

### Accessibility

Each card is one pressable with `accessibilityRole="button"` and a composed
`accessibilityLabel` reading as a sentence (name, category, price, availability).
Category chips use `accessibilityState.selected`; sort options use `radio` +
`checked`. The search field has a real `accessibilityLabel` (a placeholder is not
a substitute). Result count and the applied search term are
`accessibilityLiveRegion="polite"`. Interactive controls have ≥44pt targets or
`hitSlop`.

---

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Passes |
| `npx expo lint` | ⚠️ 1 **pre-existing** error, `src/hooks/use-color-scheme.web.ts:11`. 0 warnings. |
| `npx expo-doctor` | ✅ 21/21 |
| `npx vitest run` | ✅ 96/96 (85 carried over + 11 new) |
| `npx expo export --platform android` | ✅ Bundles (5.1 MB `.hbc`) |
| `npx expo export --platform web` | ⚠️ **Pre-existing failure** — see below |

### New tests

`src/lib/catalogue-format.test.ts` covers the pure helpers where a mistake would
be silent: `getAvailability` at both stock boundaries and 0, and `formatNaira`
(whole naira, separators, fraction dropping).

The screen itself is **not** covered. It is React Native and the project has no
renderer — no jsdom, no testing-library — and adding one for this phase was out of
scope. Its logic is therefore verified by typecheck and bundling, not by tests.

One test initially asserted `formatNaira(NaN)` would not render `NaN`. It failed:
`Intl` renders `₦NaN`. Rather than add a redundant guard, the assertion was
replaced with one on the actual guarantee — `productSchema` rejects non-finite
prices — and the precondition was documented on the formatter. The project's
convention is to validate at the boundary, not to re-check downstream.

### The web export failure is pre-existing

`npx expo export --platform web` fails with `ReferenceError: window is not defined`
inside `@expo/router-server`. This was confirmed **not** caused by this phase by
stashing all changes and re-running at HEAD: it fails identically with the tree
clean. Left alone per the instruction not to fix unrelated issues. The Android
bundle, which is what ships, succeeds.

---

## Not verified

- **No device verification.** The test device has known DNS/internet problems.
  Nothing here has been observed running in the app, and no screen has been seen
  rendering real data.
- **No live API request.** The catalogue was never exercised against a running
  `next dev` in this phase either. Combined with 3.3B, the endpoints have still
  never been called over the wire — so the schemas remain unconfirmed against a
  real deployment.
- **`Intl` on Hermes is unconfirmed.** `formatNaira` uses `Intl.NumberFormat`,
  verified under Node in the test suite. Hermes ships a reduced `Intl`, so
  `₦28,000` should be re-checked on a real device. It is the one thing most likely
  to differ between the passing test and the running app.
- **iOS bundle not built.** Android only; the `sf` icon path was typechecked
  against the generated types but not exercised on an Apple target.

---

## Remaining for Phase 3.3C-2

- Product detail: call `getProductBySlug(slug)` from `product/[slug].tsx`, render
  gallery, description, sizes, availability, price.
- Add-to-cart via `CartProvider` (`addItem`), plus size selection.
- Availability is already available — `getAvailability(product.stockQuantity)`.
- Related products remain unimplemented; the web app has no endpoint for them, so
  that is a web-side change first.
- Re-check `formatNaira` rendering on a device.

---

## Deviations

1. **`lucide-react` was not installed.** Native SF Symbol / Material icon props
   on `NativeTabs.Trigger.Icon` deliver the same result through dependencies the
   project already has, tint to the theme, and stay sharp at any size. Installing a
   ~1 MB icon library for one tab icon would have violated the project's rule
   against unnecessary dependencies. Say the word and it is a two-line change.

2. **The Explore tab was renamed and its file deleted** rather than a new tab
   added, per the instruction to use the existing entry point rather than
   introducing another top-level navigation system.

3. **Pull-to-refresh was added** although not explicitly requested. It is a
   platform convention for a product list and reuses the existing retry path
   (one `reloadToken` bump), so it added no new mechanism.

4. **The web variant of the tab bar was updated** (`app-tabs.web.tsx`) to match.
   Not requested, but leaving it pointing at the deleted `/explore` route would
   have broken the web build.