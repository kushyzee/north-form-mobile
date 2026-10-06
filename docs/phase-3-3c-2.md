# Phase 3.3C-2 — Product Detail + Size Selection + Add to Cart

**Status:** Implemented and **verified on a physical Android device** against the
live LAN API. Typecheck, lint, bundle and unit tests also pass.
**Last updated:** 2025-10-06

---

## Objective

Turn the 3.3C-1 placeholder route `/product/[slug]` into a real product-detail
screen: fetch one product, show its photography and details, let the shopper pick
a size and a quantity, and add it to the existing server-authoritative cart.

No new endpoints, no second cart, no AsyncStorage persistence, no optimistic
state.

---

## Files

| File | Role |
|---|---|
| `src/app/product/[slug].tsx` | **Rewritten.** Route: fetch, loading/error branches, selection state, cart mutation |
| `src/lib/product-detail.ts` | **New.** Pure helpers: ceilings, clamping, availability copy, `canAddToCart` |
| `src/lib/product-detail.test.ts` | **New.** 46 assertions over those helpers |
| `src/components/catalogue/product-detail.tsx` | **New.** Product layout + skeleton, error, not-found views |
| `src/components/catalogue/product-gallery.tsx` | **New.** Horizontal gallery, per-image failure handling |
| `src/components/catalogue/size-selector.tsx` | **New.** Single-select size chips |
| `src/components/catalogue/quantity-stepper.tsx` | **New.** `− n +` with clamped bounds |
| `src/components/catalogue/add-to-cart-panel.tsx` | **New.** Availability, size, quantity, add button |
| `src/components/toast.tsx` | **New.** Dependency-free toast provider + `useToast()` |
| `src/app/_layout.tsx` | **Modified** — mounts `ToastProvider` outside the navigator |

The screen was split into focused components because it is the first screen in
the app with more than one piece of independent state. The route owns data and
state; each component owns one visual concern. No shared abstraction was
introduced — the four components take plain props and know nothing about the API.

**No new dependency.** `expo-image`, `expo-symbols` and `react-native-reanimated`
were all already present.

---

## Cart semantics — the load-bearing decision

`addItem()` calls `POST /api/cart/items`, which **increments** an existing
`(productId, size)` line. Verified against the backend source, not assumed
(`supabase/migrations/20261003190000_add_cart_migration_id.sql:167-176`):

```sql
insert into public.cart_items (user_id, product_id, size, quantity, migration_id)
values (v_user_id, p_product_id, v_size, p_quantity, v_migration_id)
on conflict (user_id, product_id, size) do update
  set quantity = public.cart_items.quantity + excluded.quantity
```

So the quantity selected on the product page means **"how many more to add"**.
A shopper holding 2 × Medium who adds 3 ends up with 5 × Medium.

Three consequences, all handled:

1. **`setQuantity()` is never called here.** It sends an absolute number, so using
   it would silently turn "add 1" against a line of 4 into "set to 1" and discard
   3 units. There is no test for this in the cart suite because it is a property
   of the screen's choice, not of the client — the tests in
   `product-detail.test.ts` record it explicitly instead.

2. **The confirmation states the resulting total, not the quantity typed.**
   "Added 1" against a line of 2 is 3 units now; saying only "Added 1" would read
   as though the cart had been *set* to 1.

3. **A line already in the cart is stated in the UI** — "Adds to the 2 units of
   size M already in your cart."

---

## The ceiling is not the stock figure

This was the one place where following the brief literally would have shipped a
bug. The brief said to use `stockQuantity` as the client-side maximum. But the
server checks the **resulting** total, not the requested amount
(`…20261003190000….sql:139-152`):

```sql
v_total := coalesce(v_current, 0) + p_quantity;
if v_total > v_stock then raise exception 'INSUFFICIENT_STOCK';
```

Because adding increments, a shopper holding 2 of a product with 5 in stock has
**3** left. A stepper capped at 5 would offer a quantity that is *guaranteed* to
fail.

So the ceiling is:

```ts
availableToAdd(cart, productId, size, stockQuantity)
// = max(0, stockQuantity - quantityInCart(cart, productId, size))
```

with three deliberate properties:

- **Matched on `(productId, size)`**, because that is how a cart line is keyed
  (`unique (user_id, product_id, size)`). Counting a size-M line against a size-L
  selection would hide stock that is actually available.
- **Derived from the live `cart`, not held in state.** A successful mutation
  replaces `cart` with the server's version, so the ceiling tightens on its own.
  This screen computes no cart arithmetic of its own — which is the point of the
  server-authoritative cart.
- **Returns the full stock when the size is not yet chosen**, so the controls are
  never disabled merely because the shopper has not tapped a chip yet.

**The server remains authoritative.** Client-side clamping is a courtesy that
avoids a guaranteed rejection; stock can change between the read and the
mutation. `INSUFFICIENT_STOCK` is still handled and surfaced.

Stock is per **product**, not per size — there is no per-size stock column in the
schema. No per-size availability is shown anywhere.

---

## Loading, retry and error handling

The loading state is **derived**, not toggled, exactly as in `shop.tsx`: each
completed request stores the `queryKey` it belongs to, and

```ts
const settled = result !== null && result.key === queryKey;
const loading = !settled;
```

`queryKey` carries the **reload token as well as the slug**. Comparing the slug
alone was a bug found while implementing this: a previous *successful* result
would report as settled the instant "try again" was tapped, so the retry would
never show its skeleton and would look like nothing happened.

| Condition | What is shown |
|---|---|
| First load | Skeleton shaped like the real screen, so nothing jumps |
| `PRODUCT_NOT_FOUND` | Not-found view + "Back to shop", **no retry** — the product is gone, so retrying cannot help |
| Empty/absent slug | Same not-found view (the request is never sent) |
| Network / 5xx / bad envelope | `CatalogueErrorState`-style view, `toUserMessage()`, "Try again" |
| `INSUFFICIENT_STOCK`, `INVALID_SIZE`, `INVALID_REQUEST` | Inline message above the button; the screen stays usable and the quantity is still adjustable |
| Signed out | The product still renders. `useApi()` returning `null` is irrelevant here — the endpoint is public and `useCatalogueApi()` never returns `null`. Only the add is unavailable |

Nothing is logged. No token, header, URL or raw error is ever printed.

### Not-found is matched on the code, not the status

`productError.code === 'PRODUCT_NOT_FOUND'` rather than `status === 404`. A 404
from a *proxy* is not the same fact as a deleted product, and treating a proxy's
404 as "this was deleted" would be a confident wrong answer.

---

## One error slot, one screen

`CartProvider` holds a **single shared `error`**. Rendering it unconditionally on
the product page would tell a shopper "adding this failed" before they had
pressed anything — including when the error came from the provider's own initial
`getCart()`.

A local `hasAttempted` boolean marks the error as ours without duplicating or
flattening it. The message is shown only when **all three** hold:

```ts
hasAttempted && !submitting && cartError !== null
```

Each condition rules out a specific wrong answer: a leftover load error, a stale
error flashing during the next press, and a message on a successful add.

---

## Images

Reuses the `expo-image` + `onError` approach from `ProductCard`, with one
necessary difference: failures are tracked **per index**, not in a shared boolean.

```ts
const [failed, setFailed] = useState<Record<number, boolean>>({});
```

A gallery has several independent images, and one broken URL must not blank the
rest — which a single shared flag would do. Indices are also used rather than
URLs, so a later `images` array does not keep stale failures applied to new URLs
at the same position.

An empty `images` array, an empty-string entry, and every entry failing all fall
back to the same placeholder (the product's initial), matching the card.

**This is not hypothetical.** The live catalogue currently contains a product
whose second image is a Supabase **dashboard** URL rather than a public storage
one:

```
studio-hoodie → images[1] = https://supabase.com/dashboard/project/…/…?preview=studio2.jpeg
curl → status=200, content-type=text/html
```

It returns HTTP 200 with an HTML page, so it fails at image *decode*, not at
fetch. This is a live example of the case the per-index handling exists for.

---

## Success feedback

A **toast**, not `Alert`. The first cut used `Alert.alert`, and it was replaced:
`Alert` is modal, so the shopper cannot keep browsing, scroll, or press "add
again" until they dismiss it, and dismissing is an extra tap between wanting
something and having it. For a confirmation of an action that has already
completed, non-blocking is the right weight.

### No toast library

`src/components/toast.tsx` is a self-contained provider — a state machine, a
timer and two keyframes — using `react-native-reanimated`, which is **already a
direct dependency** used for exactly this kind of enter/exit
(`AnimatedSplashOverlay`, `Collapsible`). Adding a maintained toast library would
have been more code to audit than code to write, and would have brought its own
theming that had to be reconciled with `src/constants/theme.ts`.

| Decision | Choice | Why |
|---|---|---|
| Delivery | `ToastProvider` + `useToast()` | Mounted once in `_layout.tsx`, **outside** the navigator, so any screen can raise one and it always overlays tabs *and* pushed stack screens |
| Animation | `FadeInDown` / `FadeOutDown` | Reanimated, matching project convention. No manual `Animated.Value` bookkeeping |
| Interaction | `pointerEvents="none"`, auto-dismiss 2.6 s | A toast must not swallow a tap meant for the page, and must not need dismissing |
| Placement | `insets.bottom + BottomTabInset + Spacing.three` | Clears the tab bar on tab screens; sits slightly higher on a pushed screen. A clipped toast would be worse |
| Timer | One per raise, keyed to the toast | A second add restarts the countdown instead of inheriting the remainder, so a rapid second toast cannot vanish unread |
| Repeated message | Monotonic id as `key` | An identical repeat still replays the animation |
| Accessibility | `accessibilityLiveRegion="polite"` + composed label | Announced without stealing focus mid-sentence |
| Colour | `theme.text` background, `theme.background` text | Inverts with the scheme automatically, matching the inverted chips and Add button |

The message text is not inline in the screen — it is
`cartAddConfirmation()` in `product-detail.ts`, because that string is the only
place the resulting total is stated as fact, and a wording regression there would
misdescribe what happened to the shopper's cart.

---

## Accessibility

- Size chips: `accessibilityRole="radio"` with `accessibilityState.selected`
  and `checked` — the exclusive-choice semantics, not `aria-pressed`
- Quantity buttons: real `disabled` (stops the press **and** is announced), plus
  `accessibilityState.disabled`; ≥44pt targets
- Quantity value is a `polite` live region, so the count is not visual-only
- The add button exposes `busy` while submitting and announces *why* it is
  disabled ("Sold out", "Select a size first", "All stock in your cart") rather
  than sitting inert
- Errors are `assertive`; loading and availability are `polite`
- Availability is always **text**, never colour alone

---

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Passes |
| `npx vitest run` | ✅ **148/148** (96 carried over + 52 new) |
| `npx expo lint` | ⚠️ 1 **pre-existing** error, `src/hooks/use-color-scheme.web.ts:11`. **0 warnings.** |
| `npx expo-doctor` | ⚠️ **20/21** — upstream patch drift (see note) |
| `npx expo export --platform android` | ✅ Bundles (5.1 MB `.hbc`) |
| Live catalogue contract | ✅ **12 real products validated** — see below |
| **Physical Android device** | ✅ **Verified — see above** |

### The catalogue is now confirmed against a live server

This closes a limitation carried since Phase 3.3B: **the catalogue had never been
called over the wire.** A `next dev` server was found running on the host, so the
app's own `productSchema` was run against the real response:

| Fact | Result |
|---|---|
| `GET /catalogue/products` | 200, 12 products |
| All 12 parsed by `productSchema` | ✅ valid |
| `sizes` per product | 5–7, **none empty** |
| `images` per product | 2, **none empty** |
| `stockQuantity` range | 10–40 |
| Availability spread | `in_stock: 12` — **no low-stock or sold-out product exists in the live data** |
| `getProductBySlug('studio-hoodie')` | ✅ resolved |
| Unknown slug | ✅ `404 PRODUCT_NOT_FOUND` surfaced as `ApiError` |
| Empty slug | ✅ `400 INVALID_REQUEST`, no request sent |

A throwaway test file was used and deleted; the permanent suite is unchanged.

### New tests

`src/lib/product-detail.test.ts`, 46 assertions: `maxQuantityFor` at every
boundary including negative and fractional; `quantityInCart` matching on both
product and size, and returning 0 for an unloaded cart; `availableToAdd`
subtracting the matching size line only, never going negative, and leaving other
sizes fully available; `clampQuantity` across a grid of quantities × ceilings with
a property assertion that the result is always a whole number in range;
`canIncrement`/`canDecrement` at their boundaries plus a full round trip down to
1 and back to the ceiling; availability copy for all three states; `canAddToCart`
for every blocking condition; and the additive-vs-absolute cart semantics.

The screen itself is not covered — it is React Native and the project has no
renderer (no jsdom, no testing-library), and adding one was out of scope. Its
logic is in `product-detail.ts` precisely so it could be asserted directly.

One test initially asserted that `clampQuantity(Infinity, 24)` would clamp down to
the ceiling. It failed: the helper returns the floor for *any* non-finite value.
The implementation was kept and the test corrected, because the floor is the value
that cannot send an invalid request and the case is unreachable from the stepper.

A second test caught a real gap while adding the toast: `cartAddConfirmation`
rendered `"2.9 units"` for a fractional `added`, despite its own comment claiming
to guard against exactly that. The helper now floors. Worth noting the guard was
redundant with `clampQuantity` upstream — but this string is the one place the
figure is stated as fact to the shopper, so the guarantee belongs next to it.

---

## Physical-device verification

**Verified on a real Android device** (Xiaomi/Redmi `23106RN0DA`, Android, 720×1600)
against the live LAN API. This is the first phase where any screen has been seen
rendering real data.

Setup notes, because two are non-obvious and cost time:

- The dev build looks for Metro at **`localhost:8081` on the device**. With a USB
  device that means `adb reverse tcp:8081 tcp:8081` — the failure mode is
  `Unable to load script`, which reads like a bundling problem but is not one.
- Metro must be started **detached** (`setsid nohup …`), or it dies with the
  parent shell and the app silently falls back to a stale bundle.
- Navigation was driven by deep link (`am start -a android.intent.action.VIEW -d
  northform://product/<slug>`), and state was read with `uiautomator dump`, which
  reports the real `enabled`/`selected`/`checked` attributes rather than pixels.

The device had a live Supabase session, so the cart paths were exercised as a
**signed-in shopper**.

| Requirement | Result |
|---|---|
| Product details load from the live API | ✅ `Studio Hoodie`, `Essential Oxford`, `Baggy Jeans` |
| Images render | ✅ real Supabase storage photos |
| Broken image handled | ✅ see [Broken image](#broken-image-real-case) |
| Name / description / price render | ✅ all three |
| **Naira formatting on Hermes** | ✅ **`₦35,000`, `₦28,000`, `₦55,000`** — resolves the 3.3C-1 concern |
| Availability renders | ✅ `"In stock and ready to ship."` (28) and `"In stock — 18 available."` (18) |
| Size selection works | ✅ mutually exclusive; `selected=true`/`checked=true` on the chosen chip only |
| No size selected | ✅ button reads **"Select a size first"**, `enabled=false` |
| Quantity control works | ✅ 1 → 2 → 4 via `+` |
| **Cannot go below 1** | ✅ 4 → 3 → 2 → 1, then **two further taps changed nothing** |
| Decrement disabled at floor | ✅ platform reports **`enabled=false`** |
| Increment enabled below ceiling | ✅ `enabled=true` |
| **Add to cart succeeds** | ✅ `POST` accepted; server returned the line at qty 2 |
| **Success feedback** | ✅ **toast** — *"✓ 3 units of Studio Hoodie (XL) in your cart."*, non-modal, auto-dismissed; see [Success feedback](#success-feedback) |
| **Cart reflects the server response** | ✅ see [Server-authoritative](#server-authoritative-cart-confirmed-on-device) |
| **Increment, not set** | ✅ **2 existing + 2 added = 4** — see below |
| `PRODUCT_NOT_FOUND` | ✅ dedicated view, slug shown, **no "Try again"** |
| Not-found → back to Shop | ✅ navigated to the Shop tab, "12 products" |
| `INSUFFICIENT_STOCK` | ✅ server returns `409` + customer-safe copy, cart untouched |
| Catalog card navigation | ✅ card → correct detail page |
| Shop tab (3.3C-1) renders live data | ✅ grid, chips, search, sort |
| No React warnings from app code | ✅ only "Cannot connect to Expo CLI" from pre-`adb reverse` attempts |

### The increment, observed rather than assumed

This is the claim the whole screen hangs on, so it was tested directly.

Cart before: `Plain T-Shirt XXL ×1`, no Studio Hoodie line.

1. Selected **XL**, quantity **2**, tapped *Add to cart*.
   Confirmation: **"Added to cart — 2 units of Studio Hoodie (XL) in your cart."**
   Server: `Studio Hoodie XL qty=2 max=28`.
2. Tapped *Add to cart* again, still quantity **2**.
   Confirmation: **"4 units of Studio Hoodie (XL) in your cart."**
   Server: **`Studio Hoodie XL qty=4`**, `itemCount=5`, `subtotal=162000`.

**2 + 2 = 4, not 2.** Had the screen used `setQuantity()`, the second add would
have left the line at 2. The increment semantics are therefore confirmed on a
device and against the live database.

This round ran with the modal `Alert`; the same flow was repeated afterwards
against the toast, which reported **"3 units"** for 2 already held plus 1 added.

### Server-authoritative cart, confirmed on device

Immediately after the first add, the panel's own footnote changed from
*"Adds 2 units to your cart."* to **"Adds to the 2 units of size XL already in
your cart."**

That text is derived from `useCart().cart`, which only changes when
`CartProvider` replaces it with the server's response. The screen therefore
displayed a quantity it had not computed itself — direct evidence that no local
count was incremented and no fake cart was constructed.

### Toast, observed on device

Captured mid-flight on the physical device:

> ✓ **3 units of Studio Hoodie (XL) in your cart.**

No dimming of the page behind it, and the panel underneath stayed readable — the
defining difference from the `Alert` it replaced. The running total is correct
again (2 already held + 1 added). It dismissed itself on schedule, and the toast
was confirmed absent from the accessibility tree afterwards.

The submitting state was also caught on camera: the button shows a spinner while
the mutation is in flight, so a double tap cannot start two increments.

### Broken image: a real case

`Studio Hoodie` ships a second image URL that is a Supabase **dashboard** link,
not a public storage object:

```
curl → status=200, content-type=text/html
```

It answers `200` with an HTML page, so it fails at image **decode**, not at fetch.

On device the gallery reported **"Studio Hoodie, 1 photograph"** and rendered the
single valid photo — the broken entry was dropped per-index while its sibling
survived. `Essential Oxford` correctly reported **"2 photographs"**, so the count
is driven by the usable images rather than the raw array length.

A single shared failure boolean (as `ProductCard` uses) would have blanked this
entire gallery. That is why the handling is per-index.

### Cart state was restored

The test added a `Studio Hoodie XL ×4` line to the real test account. It was
removed afterwards with `DELETE /api/cart/items`, and the cart was confirmed back
at `Plain T-Shirt XXL ×1`, `itemCount=1`, `subtotal=22000` — its original state.

---

## Not verified

- **Low-stock and sold-out rendering is still unexercised.** All 12 live
  products report `in_stock`, so neither branch can be reached without changing
  catalogue data — out of scope. Both are covered by unit tests on
  `getAvailability` and the label helpers.
- **The network-failure / retry path was not triggered.** Reaching it means
  stopping `next dev` or dropping the API address, which would disrupt the running
  server. The retry mechanism is the same `reloadToken` bump `shop.tsx` uses.
- **The `INSUFFICIENT_STOCK` inline message was not seen rendered.** The server's
  409 was confirmed live, and it is very hard to reach through the UI by design —
  the ceiling blocks a quantity that would be rejected. Getting it on screen would
  need stock to shrink between the read and the press.
- **The "All stock in your cart" button state was not reached.** It requires the
  cart to already hold every unit for that size.
- **iOS bundle not built.** Android only.

---

## Known limitations

- **`expo-doctor` fell from 21/21 to 20/21 during this phase**, because
  `expo`, `expo-router`, `expo-constants`, `expo-linking` and `@expo/ui` each
  published a newer patch. `package.json` and `pnpm-lock.yaml` are unmodified and
  this phase added no dependency, so this is the registry moving, not a code
  problem. Upgrading is out of scope here; review with
  `npx expo install --check`.
- **Out-of-stock and low-stock cannot be reached on the live catalogue** until a
  product with `stock_quantity <= 5` exists. Both render correctly by test, but
  neither has been seen.
- **`INVALID_QUANTITY` is not reachable through the HTTP add endpoint.** The
  server's Zod layer rejects `quantity: 0` with a generic `400 INVALID_REQUEST`
  before the `INVALID_QUANTITY` business error can apply
  (`lib/cart/handle-cart.ts:156-160`). Do not branch UI on that code for the add
  path. The stepper makes 0 unreachable anyway.
- **The toast carries one tone.** Success only. Failure stays inline above the
  button, which is better there anyway: it is adjacent to the control that caused
  it and stays on screen until the shopper has reacted. A second tone was not
  built because nothing needs it yet.
- **The toast is not swipe-to-dismiss and has no action button.** Both would be
  reasonable additions; neither was built because nothing needs them yet. If the
  cart screen later wants a "View cart" action, the provider is the place to add
  it.
- **The toast cannot outlive a navigation transition**, since it is mounted above
  the navigator rather than inside any screen. That is the intended behaviour —
  a confirmation about a screen the shopper has left is noise.

---

## Deviations from the brief

1. **The quantity ceiling is `availableToAdd`, not `stockQuantity`.** The brief
   specified `stockQuantity`. That would let a shopper pick a quantity the server
   is certain to reject, because the server validates the *resulting* total. The
   ceiling reduces to exactly `stockQuantity` whenever the line is not already in
   the cart, so the specified behaviour is preserved in the common case and
   corrected in the case that would otherwise fail. Rationale is above.

2. **The button reads "All stock in your cart"** when the cart already holds every
   unit for that size, rather than being disabled silently.

---

## Next

- Cart UI — line list, quantity stepper capped at the line's `maxQuantity`,
  remove, clear, subtotal. `setQuantity()` and `removeItem()` are already built
  and unused by any screen.
- Checkout and orders.
- Related products — still requires a new endpoint on the **web** side first.
