# Phase 3.1 — Expo Foundation & Native Authentication

**Status:** Authentication complete and verified on a physical Android device
**Last updated:** 2025-10-04

---

## Objective

Deliver native Google authentication for the Expo mobile application, reusing the
existing Supabase authentication system that already backs the web app. The mobile
client must obtain a real Supabase session so it can call the existing Next.js API
with `Authorization: Bearer <access_token>`.

No separate mobile authentication backend is introduced.

---

## Architecture

```
Expo app
  → Supabase OAuth (signInWithOAuth, PKCE)
  → Google
  → northform://auth/callback?code=...
  → AuthProvider (WebBrowser.openAuthSessionAsync + exchangeCodeForSession)
  → persisted Supabase session (AsyncStorage)
  → Bearer token
  → existing web API
```

### Load-bearing decisions

These are intentional. Changing any of them breaks the verified flow.

| Decision | Value | Why |
|---|---|---|
| Auth source of truth | Supabase Auth | Same project/account as the web app |
| Client | `@supabase/supabase-js` | Framework-agnostic; works in React Native with AsyncStorage |
| Session persistence | AsyncStorage via `storage` | Survives app restart; also holds the PKCE code verifier |
| `detectSessionInUrl` | `false` | Native app — there is no browser URL bar for Supabase to parse |
| `flowType` | `'pkce'` (explicit) | SDK default is `implicit`; see Debugging History |
| Callback URL | `northform://auth/callback` | Must match the `scheme` in `app.json` and Supabase allow-list |
| Callback route | `src/app/auth/callback.tsx` | Gives Expo Router a route to match for the incoming deep link |
| Code exchange | Exactly one, in `AuthProvider` | Single ownership; no second exchange site |
| `expo-auth-session` | Not used | Supabase JS handles PKCE and the exchange directly |

---

## Implementation

### `src/lib/supabase.ts` — client configuration

Creates the single Supabase client used by the whole app. Notable points:

- Imports `react-native-url-polyfill/auto` before anything else. React Native has no
  WHATWG `URL`, and the auth client depends on it.
- Reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` from the
  environment, throwing at module load if either is missing. Only the public anon
  key is ever present in the client.
- Auth options: `storage: AsyncStorage`, `autoRefreshToken: true`,
  `persistSession: true`, `detectSessionInUrl: false`, `flowType: 'pkce'`.

`flowType: 'pkce'` is set explicitly and deliberately. It is not the library
default — see [Debugging History](#debugging-history).

### `src/context/auth.tsx` — AuthProvider

Owns the entire authentication lifecycle and exposes it through `useAuth()`:
`session`, `user`, `loading`, `status`, `error`, `clearError`,
`signInWithGoogle`, `signOut`.

Responsibilities:

- **Session restore.** On mount, read the persisted session once with
  `getSession()`, then subscribe to `onAuthStateChange`. Subscribing *after* the
  initial read prevents a slow `getSession()` from overwriting newer event-driven
  state. A failed read resolves to a signed-out state rather than leaving the app
  stuck loading.
- **`signInWithGoogle()`.** Uses the **fixed literal** `redirectTo` of
  `northform://auth/callback`, calls
  `signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })`,
  opens the system browser with `WebBrowser.openAuthSessionAsync()`, extracts the
  `code` query parameter, and performs the single
  `exchangeCodeForSession(code)` call.

  The literal is deliberate — do **not** "restore" `Linking.createURL()`. See
  [item 9 of the debugging history](#debugging-history).
- **Error handling.** Each failure stage maps to a distinct, safe, user-facing
  message. Nothing from the exchange is logged — no codes, tokens, callback URLs,
  OAuth URLs, or error messages.
- **`signOut()`.** Calls `supabase.auth.signOut()`.

On Android, `openAuthSessionAsync` has no native implementation and falls back to
a JS polyfill that resolves by racing a `Linking` redirect listener against an
`AppState` "returned to foreground" listener. Consequently `dismiss`/`cancel` are
treated as real failures and surfaced to the user rather than silently ignored.

### `src/app/auth/sign-in.tsx` — sign-in screen

Presents the "Continue with Google" button, a progress state while
`status === 'authenticating'`, and the current `error` message. It contains no
auth logic itself — it calls `signInWithGoogle()` from the provider.

### `src/app/auth/callback.tsx` — OAuth callback landing route

Existence is the point. Expo Router resolves every incoming deep link against the
route manifest; without this file, `northform://auth/callback` renders Expo
Router's built-in "Unmatched Route / Page could not be found" screen.

This route **does not exchange the authorization code**. `openAuthSessionAsync()`
already captured the callback through its own `Linking` listener, and
`signInWithGoogle()` owns the exchange. The route's only job is to wait for the
provider flow to settle (`loading === false` and `status !== 'authenticating'`)
and then navigate: to `/(tabs)` when a session exists, otherwise back to
`/auth/sign-in`.

### `src/app/auth/_layout.tsx` — auth route layout

Stack declaring the two `auth` routes (`sign-in`, `callback`) with headers hidden.

### `src/app/_layout.tsx` — root layout

Wraps the app in `AuthProvider` and redirects on session state: signed-out users
are sent to `/auth/sign-in`, authenticated users away from the `auth` group to
`/(tabs)`.

### `app.json` — app configuration

`"scheme": "northform"` is what makes `northform://auth/callback` resolve to this
app on Android. Changing it invalidates both the redirect URL and Supabase's
allow-list entry. `expo.splash-screen` and `expo-router` are configured as plugins.

### Environment variables

Set in `.env.local` (gitignored):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY` (public anon key only — never a service-role key)
- `EXPO_PUBLIC_API_URL` — base URL for the existing Next.js API, consumed by the
  upcoming API client

### API authentication relationship

The mobile app is a separate client of the existing backend. It reads
`session.access_token` and sends it as `Authorization: Bearer <token>`, which the
web API already accepts. Reusable mobile API-client work (bearer injection, error
envelope parsing, authenticated `GET /api/cart`) is **not** part of this phase.

---

## Debugging History

This section is retained deliberately. It explains why `flowType: 'pkce'` is set
explicitly, why the callback route exists, and why `redirectTo` is a hardcoded
literal — all three look redundant otherwise.

1. **Unmatched route on first physical login.** Google sign-in completed and
   Android returned to `northform://auth/callback`, but Expo Router displayed
   "Unmatched Route / Page could not be found." The scheme and intent filter were
   correct; the app simply had no route matching `/auth/callback`. Expo Router
   consumes the same `Linking` event that the OAuth flow does, independently.

2. **Added the callback landing route.** `src/app/auth/callback.tsx` fixed the
   routing error. The next physical test then returned from Google successfully
   and reported "Sign in failed."

3. **Auth data arrived in the fragment, not the query string.** Instrumenting the
   flow (booleans only) showed the callback URL had a fragment and no query
   parameters — so no `code` was ever present to exchange.

4. **Root cause: the Supabase client was in implicit flow.** Reading the installed
   `@supabase/auth-js` source showed `flowType` defaults to `'implicit'`. In that
   mode the client never sends a `code_challenge`, so GoTrue returns credentials
   in the URL fragment instead of an authorization code. The flow was not broken —
   it was running in the wrong mode. Worth noting: Supabase's own React Native
   deep-linking guide demonstrates the implicit flow (`setSession` with tokens from
   the callback URL), which is why this default is easy to land on.

5. **Explicit `flowType: 'pkce'` fixed the response shape.** The client now
   generates and persists a code verifier and sends `code_challenge`, so the
   authorization response carries a query-string `code`.

6. **AsyncStorage was already sufficient.** The auth client stores the PKCE
   verifier through the configured `storage` and reads it back during
   `exchangeCodeForSession`, so the verifier survives the browser round trip. No
   storage changes were required. No Supabase dashboard changes were required
   either: the experimental flow-id redirect option is off by default, so the
   callback URL remains exactly `northform://auth/callback?code=...`.

7. **Final physical-device test succeeded.** The code was exchanged, the session
   was established, and authenticated navigation reached `/(tabs)`.

8. **Persistence confirmed.** Relaunching the app preserved the authenticated
   session; sign-out and sign-in also behaved correctly.

9. **`Linking.createURL()` regression — the redirect silently became
   environment-dependent.** After the app had been working, a later device test
   found the browser redirecting to the Supabase **Site URL**
   (`https://northform-livid.vercel.app`) instead of `northform://auth/callback`.

   The cause was `Linking.createURL('auth/callback', { scheme: 'northform' })`.
   That helper interpolates `Constants.expoConfig.hostUri`, so its output depends
   on how the app was launched. Running the installed `expo-linking@57.0.11`
   against a stubbed `expo-constants` confirmed it:

   | Runtime state | `createURL(...)` result |
   |---|---|
   | Dev build + Metro attached | `northform://192.168.1.5:8081auth/callback` |
   | Release build / no `hostUri` | `northform://auth/callback` |

   Note the missing `/` before `auth` in the first row — `createURL.js` composes
   `${scheme}://${hostUri}${path}`. `Linking.parse()` on that string yields
   `scheme: null` and no query params, so the code was unreachable even if the
   callback had arrived.

   GoTrue **silently discards** a `redirect_to` that is not allow-listed and falls
   back to the Site URL — which is exactly the reported symptom, with no error
   from Supabase. Verified against the live project: an allow-listed
   `northform://auth/callback` is passed through to Google intact, a
   non-allow-listed one is dropped and the callback issues
   `303 → https://northform-livid.vercel.app`.

   **Fix:** hardcode the literal `northform://auth/callback`. It is now
   environment-independent, and it matches both the Supabase allow-list and the
   Android intent filter. Supabase's own React Native guide suggests
   `createURL()`, which is precisely what makes this trap easy to fall into.

10. **Rebuild required after `app.json` changes.** The `<data android:scheme="northform"/>`
    intent filter lives in the *generated* `android/` project, not in JS. Editing
    `app.json` (including the later name/slug/icon changes) has no effect on an
    already-installed APK — `npx expo run:android` is required. Development builds
    are mandatory here; Expo Go cannot receive a custom scheme at all.

All temporary stage/boolean diagnostic logging was removed after the root cause was
confirmed and verified.

---

## Verification

### Physical Android device (development build, `npx expo run:android`)

Confirmed on a real device:

- [x] Google account selection
- [x] Successful browser-based OAuth
- [x] Return to the custom `northform://` scheme
- [x] Callback route handling (no unmatched-route screen)
- [x] Authorization-code response in the query string
- [x] Successful PKCE exchange (`exchangeCodeForSession`)
- [x] Authenticated navigation to `/(tabs)`
- [x] Session persisted after app restart
- [x] Sign-out and sign-in behaviour

### Static checks

Run against the final tree:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Passes |
| `npx expo-doctor` | 21/21 checks pass |
| `npx expo lint` | 1 error, pre-existing and unrelated (`src/hooks/use-color-scheme.web.ts`, Expo scaffold `setState`-in-effect); no errors in auth code |

No automated test suite is configured in this project.

---

## Known Limitations

### WebCrypto warning

The following warning is emitted at runtime:

```
WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.
```

It was observed during the successful physical-device test and did **not** prevent
authentication from completing. Do not assume S256 is in use: with this warning
present, the code challenge method falls back to `plain`. This was left unchanged
on purpose; resolving it properly means providing a WebCrypto implementation for
React Native, which is out of scope for this phase.

### "State update on a component that hasn't mounted yet" warning

On a cold-start `northform://` callback, React Native reports:

```
Can't perform a React state update on a component that hasn't mounted yet...
expo-router/build/fork/useLinking.native.js:127
```

**This originates entirely inside Expo Router and is not caused by application
code.** Traced through the installed `expo-router@57.0.24`:

- `getLinkingConfig.js:60-88` returns `getInitialURL()`, and expo-linking's
  implementation is `async`, so it is always a Promise.
- That forces `useLinking.native.js:120-130` into the `typeof url !== 'string'`
  branch, whose `.then()` callback calls `onUnhandledLinking` at line 127.
- `onUnhandledLinking` **is** `setLastUnhandledLink`, passed in from
  `react-navigation/native/NavigationContainer.js:64-69`.
- `getInitialState` is consumed by `useThenable`, whose `fork/useThenable.js:42`
  does `React.useState(create)` — a lazy initializer, so it runs *during render*.
  The `.then()` fires after that render commits, updating a `NavigationContainer`
  that is still mounting.

All navigation in this app happens inside `useEffect` and behind guards; there is
no side effect in any render function. Only a cold-start deep link reaches the
path above — ordinary startup returns `null` from `getInitialURL()` and skips it
entirely.

**Development-only and harmless.** `lastUnhandledLink` is bookkeeping for
Expo Router's devtools; React emits this warning only under `__DEV__`, so it does
not appear in a release build. Authentication completes normally.

No fix applied — the correct fix is in Expo Router's internals, and nothing in
this app triggers it beyond the callback itself. A related (independent) tidy-up:
on the callback route both `callback.tsx` and `_layout.tsx` call
`router.replace()` for the same state change. Harmless and idempotent.

### Cold-start callback

If the OS completely kills the app while the external browser is open, the callback
route mounts with no in-flight exchange in the `AuthProvider` (nothing called
`signInWithGoogle()` in this process). The route therefore settles immediately and
returns the user to sign-in rather than completing authentication. This behaviour
is intentional and unchanged. Supporting it would require handling the code in the
route itself, which would introduce a second exchange site.

### Other notes

- Expo Go is not sufficient for this flow; the custom scheme requires a
  development build. `npx expo run:android` is required after any `app.json`
  change, since the intent filter lives in the generated `android/` project.
- On Android the `openAuthSessionAsync` polyfill races the redirect against an
  `AppState` transition. `onNewIntent` precedes `onResume`, so the redirect wins,
  and the verified device test confirms this. The `dismiss` path is handled
  defensively regardless.
- `APP_SCHEME` and `AUTH_CALLBACK_PATH` in `auth.tsx` are now unused after the
  `redirectTo` literal replaced `createURL()`; `npx expo lint` reports both as
  unused-var warnings. Safe to remove.

---

## Next Phase

Authenticated API integration and storefront functionality: mobile API client with
bearer injection, authenticated `GET /api/cart`, then catalogue and cart UI.