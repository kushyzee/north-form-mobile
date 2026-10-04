# PROJECT_STATUS.md — NORTH & FORM Mobile

**Current as of:** 2025-10-04 (initial documentation setup)

## Current Phase

**Phase 3.1 — Expo foundation and authentication**

The Expo scaffold is complete. Authentication implementation has **not started**.

## Completed (Verified)

- [x] Expo 57 project created (`expo@~57.0.26`)
- [x] Expo Router configured with typed routes experiment enabled
- [x] `src/app` is the route root with tab navigator (`_layout.tsx`)
- [x] Project starts successfully (`npx expo start`)
- [x] Expo Go successfully opened the starter app on a physical Android device
- [x] TypeScript configured (`typescript@~6.0.3`)
- [x] Lint script available (`npx expo lint`)
- [x] Core dependencies installed: `expo-router`, `expo-linking`, `expo-web-browser`, `react-native-reanimated`, `expo-symbols`, `expo-image`

## In Progress / Next (Not Yet Implemented)

The next implementation work for Phase 3.1:

- [ ] Supabase mobile client (`@supabase/supabase-js` with React Native AsyncStorage adapter)
- [ ] Persistent authentication session (AsyncStorage)
- [ ] Auth lifecycle (sign in, session restore, sign out, token refresh)
- [ ] Google OAuth via `expo-web-browser` / `expo-auth-session`
- [ ] Native deep linking (`northform://auth/callback`)
- [ ] Access token handling for API calls
- [ ] Reusable mobile API client (bearer token injection, error envelope parsing)
- [ ] Authenticated `GET /api/cart` verification against existing backend

## Backend Relationship

The mobile app consumes the existing **NORTH & FORM web/API backend** (parent `north-form` repository) and must use the **same Supabase project/account**.

The web backend now supports **bearer authentication** from commit `d1b4dfd` (parent repo). The mobile app will authenticate via Supabase, obtain an access token, and call the existing API with `Authorization: Bearer <access_token>`.

Do not duplicate the entire backend architecture here. For deeper API details, refer to the parent project's documentation.

## Important Known Configuration

| Setting | Current Value | Status |
|---|---|---|
| Expo scheme (`app.json`) | `northformmobile` | **Not yet changed** — pending Phase 3.1 |
| Planned auth callback URL | `northform://auth/callback` | **Not yet configured** — pending Phase 3.1 |
| Supabase project | Shared with web app | To be configured in Phase 3.1 |

**Action required:** Update `app.json` scheme from `northformmobile` to `northform` (or configure both) and add the deep link callback to Supabase OAuth redirect URLs.

## Verification State

| Check | Status |
|---|---|
| Project starts (`npx expo start`) | ✅ Verified |
| Expo Go on physical Android | ✅ Verified |
| Lint (`npx expo lint`) | ⏳ Not run in this session |
| Typecheck (`npx tsc --noEmit`) | ⏳ Not run in this session |
| Expo Doctor (`npx expo-doctor`) | ⏳ Not run in this session |
| Authentication flow | ❌ Not implemented |
| OAuth callback returns to app | ❌ Not implemented |
| Session persists across restarts | ❌ Not implemented |
| Sign out works | ❌ Not implemented |
| Access token available for API calls | ❌ Not implemented |
| Authenticated `GET /api/cart` succeeds | ❌ Not implemented |
| No secrets exposed | ✅ No secrets in repo |
| Parent web project unaffected | ✅ Separate directory |

## Handoff Guidance

A new agent starting on this project must:

1. **Read `AGENTS.md`** — always-loaded context, stack versions, invariants, commands
2. **Read `PROJECT_STATUS.md`** — this file, current state and what's done vs. pending
3. **Read `docs/README.md`** — documentation index to find relevant phase doc
4. **Read `docs/phase-3-1.md`** — detailed Phase 3.1 implementation context
5. **Inspect git status** — `git status && git log --oneline -5`
6. **Inspect actual implementation** — read `src/app/`, `app.json`, `package.json` before making changes

Do not assume any authentication or API code exists. Verify everything from the actual codebase.