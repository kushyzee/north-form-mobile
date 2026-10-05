# PROJECT_STATUS.md — NORTH & FORM Mobile

**Current as of:** 2025-10-05

## Current Phase

**Phase 3.2A — API client + cart foundation.** Authentication (Phase 3.1) is
complete and device-verified. The API client and cart state layers are
implemented, and the authenticated round trip has been verified end to end.
Cart UI is next.

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

## Known Limitations

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
- `APP_SCHEME` / `AUTH_CALLBACK_PATH` in `auth.tsx` are unused since `redirectTo`
  became a literal; lint warns. Safe to remove.

## Next (Not Yet Implemented)

- Cart UI (line list, quantity stepper, remove, clear, subtotal)
- Catalogue and product detail
- Checkout and orders

See `docs/phase-3-1.md` for authentication and `docs/phase-3-2a.md` for the API
client and cart foundation.

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
| In-app automatic `getCart()` observed on device | ⏳ Blocked by device DNS |
| No secrets exposed | ✅ Only public anon key in client |
| Parent web project unaffected | ✅ Separate directory |

## Handoff Guidance

1. Read `AGENTS.md` — always-loaded context, stack versions, invariants, commands
2. Read `PROJECT_STATUS.md` — current state, what's done vs. pending
3. Read `docs/README.md` — documentation index
4. Read `docs/phase-3-1.md` — authentication architecture, verification, debugging history
5. Read `docs/phase-3-2a.md` — API client and cart foundation
6. Inspect the actual implementation before making changes

Verify everything from the codebase rather than assuming.