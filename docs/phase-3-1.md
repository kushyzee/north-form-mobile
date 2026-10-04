# Phase 3.1 — Expo Foundation & Authentication

**Status:** Planning / Not Started  
**Target:** Prepare the Expo mobile application to authenticate against the same Supabase project as the web application and call the existing API using bearer authentication.

---

## Objective

Enable the NORTH & FORM mobile app to:

1. Authenticate users via Google OAuth (Supabase) using native browser flow
2. Persist the Supabase session across app restarts (AsyncStorage)
3. Obtain a valid access token for authenticated API calls
4. Call the existing web API (`GET /api/cart`) with bearer authentication and verify success

---

## Scope (Included)

Phase 3.1 is split into two implementation steps:

### 3.1a — Auth Foundation
- Expo-compatible dependencies
- Supabase client with React Native AsyncStorage adapter
- AsyncStorage session persistence (`persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: false`)
- `northform` custom URL scheme (change from `northformmobile`)
- Development build creation (`npx expo run:android` / `eas build --profile development`)
- Google OAuth via `supabase.auth.signInWithOAuth({ provider: "google", ... })`
- Native callback handling at `northform://auth/callback`
- PKCE code exchange via `supabase.auth.exchangeCodeForSession(code)`
- Session restoration on cold start
- Sign-out

Non-goal for 3.1a: no cart/API implementation yet.

### 3.1b — API Authentication
- Reusable mobile API client (base URL config, bearer injection, error envelope parsing)
- Retrieve current Supabase access token (`supabase.auth.getSession()`)
- Send `Authorization: Bearer <token>` header
- Parse existing API error shape (`{ error: { code, message } }`)
- Implement authenticated `GET /api/cart`
- Verify mobile can retrieve the same server cart as the web app

---

## Explicit Non-Goals (Not in Phase 3.1)

Do **not** implement yet:

- Catalogue / product listing UI
- Product detail UI
- Cart UI (display, quantity controls)
- Cart mutations (add, update, remove)
- Checkout flow
- Orders UI / history
- Realtime subscriptions
- Push notifications
- Unnecessary backend changes (the web API already supports bearer auth)

---

## Existing Backend Contract (Mobile-Relevant Only)

| Aspect | Detail |
|---|---|
| API base URL | Configured via environment variable (e.g., `EXPO_PUBLIC_API_URL`) |
| Authentication | `Authorization: Bearer <supab...en>` |
| `GET /api/cart` | Requires valid bearer token; returns existing `CartView` type |
| Error envelope | `{ error: { code: string, message: string } }` (same as web) |
| Supabase project | Shared with web app — same `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

> **Note:** For full API schema, `CartView` type, and other endpoints, refer to the parent web project's documentation. Do not duplicate it here.

---

## API URL Constraint

- Do not guess the production API base URL. Obtain it from the existing web deployment/configuration.
- When testing against a local server from a physical phone, `localhost` refers to the phone itself, not the development machine. Use the development machine's LAN IP (e.g., `http://192.168.x.x:3000/api`) or a tunnel (ngrok, localtunnel, Expo tunnel).
- The value will be provided via `EXPO_PUBLIC_API_URL` environment variable.

---

## Planned Authentication Flow

> **⚠️ PLANNED — NOT YET IMPLEMENTED**

```
1. User taps "Sign in with Google"
2. App initiates Supabase OAuth: supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "northform://auth/callback" } })
3. System browser opens to Supabase/Google sign-in
4. User completes Google sign-in in browser
5. Supabase redirects to northform://auth/callback?code=<auth_code>
6. App receives deep link via Expo Router (Linking)
7. App exchanges auth code for Supabase session: supabase.auth.exchangeCodeForSession(code)
8. Session persisted to AsyncStorage automatically (configured adapter)
9. Access token available via supabase.auth.getSession() → session.access_token
10. API client reads token and injects Authorization: Bearer ***
11. Authenticated GET /api/cart succeeds
```

**Confirmed architecture decisions:**

- Supabase Auth handles Google authentication via `supabase.auth.signInWithOAuth({ provider: "google", ... })`
- PKCE authorization-code flow is used
- Native callback handled at `northform://auth/callback`; code exchanged with `supabase.auth.exchangeCodeForSession(code)`
- AsyncStorage used for persisted Supabase sessions
- Supabase client configuration:
  - `persistSession: true`
  - `autoRefreshToken: true`
  - `detectSessionInUrl: false` (native app, not web)
- Custom URL scheme: `northform://auth/callback` (current generated scheme is `northformmobile`; changing to `northform` is an implementation step)
- Expo Router remains the navigation/deep-linking mechanism; no separate React Navigation linking configuration

---

## Expo Constraints (from AGENTS.md / Expo 57 Docs)

- **Expo 57** — consult `https://docs.expo.dev/versions/v57.0.0/` before using any Expo/EAS/RN API
- **Continuous Native Generation** — no manual `ios/`/`android/` edits; configure via `app.json` + config plugins
- **Expo Go verification** — Expo Go was successfully verified for the initial scaffold (app starts, UI renders)
- **Expo Go is not sufficient for native OAuth/deep-link flow** — the custom `northform://` scheme and PKCE callback require a development build. Phase 3.1 OAuth verification therefore requires `npx expo run:android|ios` or `eas build --profile development`
- **No development build exists yet** — creating one is part of Phase 3.1a implementation
- **Deep linking** — configure `scheme` in `app.json` (`northform`) and use Expo Router for deep link handling
- **AsyncStorage** — use `@react-native-async-storage/async-storage` for Supabase session persistence
- **Browser behavior** — Expo's OAuth flow uses the system browser appropriately. Existing Google browser authentication may affect the sign-in experience (user may not be prompted to choose an account if already signed in)
- **Auth Session** — `expo-auth-session` / `expo-web-browser` may be used for the OAuth browser flow; the native redirect is provided through the application's custom `scheme`. Do not add a speculative `expo-auth-session` plugin configuration unless current Expo 57 documentation requires it

---

## Acceptance Criteria

Phase 3.1 is complete when **all** of the following are true:

| # | Criterion | Verification |
|---|---|---|
| 1 | Mobile project starts (`npx expo start`) | Manual / CI |
| 2 | Authentication can be initiated (Google OAuth button works) | Device test (dev build) |
| 3 | OAuth callback returns to app (`northform://auth/callback` handled) | Device test (dev build) |
| 4 | Supabase session persists across app restarts | Kill/restart app, verify `getSession()` returns session |
| 5 | Sign out works (clears session, returns to unauthenticated state) | Device test (dev build) |
| 6 | Access token is available after sign in (`session.access_token` non-empty) | Log / debug |
| 7 | Authenticated `GET /api/cart` returns successfully (200 + valid `CartView`) | Device test (dev build) + network log |
| 8 | No secrets exposed in repo (`.env` gitignored, only public anon key in client) | `git status`, repo scan |
| 9 | Existing web project remains unaffected | No changes outside `north-form-mobile/` |
| 10 | Lint passes (`npx expo lint`) | CI / local |
| 11 | Typecheck passes (`npx tsc --noEmit`) | CI / local |
| 12 | Expo Doctor passes (`npx expo-doctor`) | CI / local |
| 13 | Works on physical Android device (development build) | Device test |

> **Note:** Items 2, 3, 5, 7, and 13 require a development build (Expo Go is not sufficient for custom scheme OAuth/deep-link flow).

---

## Verification Plan

### Automated Verification (CI / Local)

- `npx expo lint` — no errors
- `npx tsc --noEmit` — no errors
- `npx expo-doctor` — no warnings/errors
- Unit tests (if added) — `npm test` (not yet configured)

### Emulator / Device Verification (Development Build Required)

- `npx expo run:android` → open development build on physical Android
- Cold start → verify session restore (if previously signed in)
- Sign in flow → Google OAuth → callback → session established
- Sign out → session cleared → signed out UI shown
- Network inspector: verify `Authorization: Bearer ***` header on `GET /api/cart`

### Manual OAuth Verification

- Supabase dashboard: Google provider enabled, redirect URL `northform://auth/callback` registered
- `app.json` scheme supports `northform://`
- Deep link opens app (not browser) on Android
- PKCE code exchange succeeds (no `invalid_grant`)

### API Verification

- Backend server running (web project)
- `EXPO_PUBLIC_API_URL` points to correct base (LAN IP or tunnel for local dev, deployed URL for production)
- `GET /api/cart` with valid token returns 200 + `CartView`
- `GET /api/cart` without token returns 401 + error envelope
- Expired token → automatic refresh → retry succeeds

---

## Dependencies to Add (Planned)

| Package | Purpose | Required |
|---|---|---|
| `@supabase/supabase-js` | Supabase client | ✅ Yes |
| `@react-native-async-storage/async-storage` | Session persistence adapter | ✅ Yes |
| `expo-web-browser` | System browser for OAuth | ✅ Yes |
| `expo-auth-session` | OAuth PKCE flow helper (optional — only if Expo 57 docs require it for the browser flow) | ⚠️ Optional/Verify |
| `expo-linking` / `Linking` | Deep link parsing (already in deps) | ✅ Already installed |
| `expo-constants` / `expo-config-plugins` | Runtime config / native config (already in deps) | ✅ Already installed |

> Install with `npx expo install <package>` to guarantee SDK compatibility.
> `expo-auth-session` is listed as optional — the Supabase JS client handles PKCE and code exchange directly. Add only if Expo 57 documentation indicates it's needed for the browser-based OAuth flow.

---

## Configuration Changes Required (Planned)

### `app.json`

```json
{
  "expo": {
    "scheme": "northform",
    "plugins": [
      "expo-router",
      ["expo-splash-screen", { ... }]
    ]
  }
}
```

> **Note:** The `expo-auth-session` plugin configuration with `redirectUrl` has been removed from the required config. The native redirect is handled via the custom `scheme` and Expo Router deep linking. Add plugin config only if Expo 57 documentation requires it.

### Environment (`.env` — gitignored)

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
EXPO_PUBLIC_API_URL=http://localhost:3000/api   # or deployed URL
```

### Supabase Dashboard

- Authentication → Providers → Google: **Enabled**
- Authentication → URL Configuration → Redirect URLs: add `northform://auth/callback`
- Authentication → URL Configuration → Site URL: (optional for mobile)

---

## File Structure Impact (Planned)

```
src/
├── lib/
│   ├── supabase.ts          # Supabase client + AsyncStorage adapter
│   └── api.ts               # Mobile API client (bearer injection, error handling)
├── hooks/
│   └── useAuth.ts           # Auth state, signIn, signOut, session restore
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx      # Auth stack layout
│   │   └── sign-in.tsx      # Sign in screen
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Authenticated tab layout
│   │   ├── index.tsx        # Home (shows cart)
│   │   └── cart.tsx         # Cart screen (Phase 3.1 verifies GET /api/cart here)
│   └── _layout.tsx          # Root: switches between (auth) and (tabs) based on session
└── components/
    └── auth/                # Auth-related UI components
```

> This structure is a **proposal**. Final structure may differ based on implementation decisions.

---

## Risks & Open Questions

| Risk / Question | Status | Mitigation / Decision Needed |
|---|---|---|
| Deep link handling on Android (intent filters) | **Open** | Verify on device that `northform://auth/callback` opens the app correctly; Expo Router should handle via scheme config |
| Token refresh race conditions | **Open** | Supabase client handles auto-refresh; API client should retry once on 401 |
| Local API development (localhost from device) | **Open** | Use development machine's LAN IP or tunnel (ngrok/localtunnel/Expo tunnel) for `EXPO_PUBLIC_API_URL` |
| Web support (Expo Router web) | **Open** | OAuth flow differs on web; may need separate Supabase auth config for web platform |

> **Resolved (no longer open questions):**
> - **Expo Go vs. dev build**: Dev build is required for custom scheme OAuth; Expo Go is only sufficient for initial scaffold verification.
> - **`exchangeCodeForSession()` method**: Confirmed as the correct PKCE exchange method.
> - **Supabase JS Expo session config**: Confirmed `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: false`.
> - **Custom scheme mechanism**: Confirmed as the intended mechanism (`northform://auth/callback`).
> - **`expo-auth-session` plugin config**: Not required unless Expo 57 docs specify otherwise; native redirect handled via scheme + Expo Router.

---

## Next Phase (Phase 3.2 — Catalogue & Cart UI)

After Phase 3.1 acceptance criteria are met:

- Product catalogue screen (list/grid)
- Product detail screen
- Cart screen (using authenticated `GET /api/cart` data)
- Cart mutations (add/update/remove via API)
- Optimistic UI updates

**Do not start Phase 3.2 until all Phase 3.1 criteria are verified.**