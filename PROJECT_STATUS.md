# PROJECT_STATUS.md — NORTH & FORM Mobile

**Current as of:** 2025-10-04

## Current Phase

**Phase 3.2A — API client + cart foundation.** Authentication (Phase 3.1) is
complete and device-verified. The API client and cart state layers are
implemented and statically verified; the live authenticated round trip is still
pending.

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

**Phase 3.2A — API client + cart foundation (statically verified)**

- [x] Zod schemas and inferred types for `Cart` / `CartLine` (`src/lib/cart-schema.ts`)
- [x] React-free API client with bearer injection (`src/lib/api.ts`)
- [x] All five cart endpoints with exact server semantics
- [x] Error normalization: `ApiError`, `NetworkError`, `InvalidResponseError`,
      `UnauthenticatedError`
- [x] `useApi()` hook reading the token from the existing `AuthProvider`
- [x] `CartProvider` / `useCart()` — server-authoritative, no optimistic updates
- [x] `EXPO_PUBLIC_API_URL` configured; `.env.example` added

## Known Limitations

- **The full authenticated round trip is unverified.** Supabase returned
  `over_email_send_rate_limit` (429) on every attempt to obtain a test access
  token, and test accounts need email confirmation. Needs a signed-in device run.
- **The production origin does not yet serve the cart API.**
  `https://northform-livid.vercel.app/api/cart` returns `404` (HTML); its
  deployment predates the cart API commits. Redeploy the web app, or test against
  a LAN address.
- Runtime warning: `WebCrypto API is not supported. Code challenge method will
  default to use plain instead of sha256.` Observed during the successful device
  test; authentication completed normally. Do not assume S256 is in use.
- If the OS kills the app while the browser is open, the callback route returns the
  user to sign-in instead of completing authentication (intentional).

## Next (Not Yet Implemented)

- Verify the authenticated cart round trip on a physical device
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
| Auth callback URL | `northform://auth/callback` | Configured and allow-listed in Supabase |
| Callback route | `src/app/auth/callback.tsx` | Implemented |
| Supabase project | Shared with web app | Configured |
| `EXPO_PUBLIC_API_URL` | `https://northform-livid.vercel.app/api` | Configured in `.env.local`; **origin does not yet serve the cart API** |

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
| Authenticated `GET /api/cart` with a real token | ⏳ Blocked on Supabase signup rate limit |
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