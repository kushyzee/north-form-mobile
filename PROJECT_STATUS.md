# PROJECT_STATUS.md — NORTH & FORM Mobile

**Current as of:** 2025-10-04

## Current Phase

**Phase 3.1 — complete.** Native Google authentication is implemented and verified
on a physical Android device.

## Completed (Verified on physical device)

- [x] Expo 57 project (`expo@~57.0.26`, `react-native@0.86.3`, `react@19.2.3`)
- [x] Expo Router with `src/app` as the route root and typed routes enabled
- [x] Supabase mobile client (`@supabase/supabase-js` + AsyncStorage adapter)
- [x] Explicit `flowType: 'pkce'`, `detectSessionInUrl: false`
- [x] Persisted sessions via AsyncStorage — survives app restart
- [x] Native Google OAuth via `expo-web-browser`, `northform://auth/callback`
- [x] Exactly one `exchangeCodeForSession()` call, owned by `AuthProvider`
- [x] `src/app/auth/callback.tsx` callback landing route
- [x] Session restore on cold start, plus sign-out / sign-in

See `docs/phase-3-1.md` for architecture, implementation detail, and debugging
history.

## Known Limitations

- Runtime warning: `WebCrypto API is not supported. Code challenge method will
  default to use plain instead of sha256.` Observed during the successful device
  test; authentication completed normally. Do not assume S256 is in use.
- If the OS kills the app while the browser is open, the callback route returns the
  user to sign-in instead of completing authentication (intentional).

## Next (Not Yet Implemented)

- Reusable mobile API client (base URL, bearer injection, error envelope parsing)
- Retrieve the Supabase access token for API calls
- Authenticated `GET /api/cart` against the existing backend
- Catalogue, product detail, and cart UI

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
| `EXPO_PUBLIC_API_URL` | Provided via `.env.local` | Consumed by the upcoming API client |

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
| Authenticated `GET /api/cart` | ❌ Not implemented |
| No secrets exposed | ✅ Only public anon key in client |
| Parent web project unaffected | ✅ Separate directory |

## Handoff Guidance

1. Read `AGENTS.md` — always-loaded context, stack versions, invariants, commands
2. Read `PROJECT_STATUS.md` — current state, what's done vs. pending
3. Read `docs/README.md` — documentation index
4. Read `docs/phase-3-1.md` — authentication architecture, verification, debugging history
5. Inspect `git status` — Phase 3.1 auth work is currently uncommitted
6. Inspect the actual implementation before making changes

Verify everything from the codebase rather than assuming.