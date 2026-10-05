# NORTH & FORM Mobile Application

Expo/React Native mobile app consuming the NORTH & FORM web/API backend. Independent Expo project inside the parent `north-form` repository.

## Documentation Map

| Document | Covers | Read it when |
|---|---|---|
| `docs/README.md` | Documentation index and routing | Starting any task; need to find relevant docs |
| `PROJECT_STATUS.md` | Current implementation state and handoff | Starting any task or switching agents |
| `docs/phase-3-1.md` | Authentication architecture and verification: Supabase client, PKCE OAuth, callback route, device verification, debugging history | Working on auth |
| `docs/phase-3-2a.md` | API client and cart foundation: bearer injection, cart endpoint semantics, error normalization, `CartProvider` | Working on the API client or cart state |

## Current High-Level Status

- Expo 57 scaffold complete
- Expo Router configured with `src/app` as route root
- Native Google OAuth complete, verified on a physical Android device
- Session persistence via AsyncStorage verified
- API client + cart state foundation implemented; authenticated round trip still pending
- Catalogue / product / cart UI: **not started**

## Stack / Version Traps

- **Expo 57** (`expo@~57.0.26`, `react-native@0.86.3`, `react@19.2.3`)
- Before using Expo/EAS/React Native APIs, consult the matching Expo 57 docs: `https://docs.expo.dev/versions/v57.0.0/`
- For anything else, fetch `https://docs.expo.dev/llms.txt` — index of all Expo docs with corrections to common LLM misconceptions
- Never answer from memory; Expo ships breaking changes every SDK release

## Source Structure

```
src/
├── app/              # Expo Router routes (file-based routing)
│   ├── _layout.tsx   # Root layout; AuthProvider + session redirects
│   ├── (tabs)/       # Authenticated screens
│   └── auth/         # Sign-in + OAuth callback routes
├── components/       # Reusable UI components
│   ├── ui/           # Primitives (Collapsible, etc.)
│   ├── *.tsx         # Feature components
├── context/          # AuthProvider / useAuth
├── lib/              # Supabase client
├── hooks/            # Custom React hooks
├── constants/        # Theme, spacing, design tokens
└── global.css        # Global styles (CSS-in-JS via Expo)
```

Non-route code (components, hooks, utils) lives outside `src/app/`.

Environment variables use the `EXPO_PUBLIC_` prefix and live in `.env.local`
(gitignored). `.env.example` documents them.

## Non-Negotiable Project Invariants

- Use **Expo Router** for all navigation; routes live in `src/app/`
- **Do not manually create/edit `ios/` or `android/`** — Continuous Native Generation handles this; configure native behavior in `app.json` and config plugins
- **Do not expose server secrets** — client only holds public/anonymized keys
- **Do not modify the parent web app** (`../north-form`) when working on mobile
- Use `npx expo install <package>` for dependencies — resolves SDK-compatible versions
- Preserve cross-platform compatibility (Android, iOS, web)
- Run lint and typecheck before declaring any task done

## Conventions

- Inspect existing patterns before introducing dependencies
- Prefer simple, maintainable solutions over unnecessary abstraction
- Avoid adding libraries when the existing stack can reasonably solve the problem
- Agents must verify their changes (lint, typecheck, device test where applicable)

## Verification Commands

```bash
npx expo lint           # lint
npx tsc --noEmit        # typecheck
npx expo-doctor         # diagnose dependency/config issues
npx expo start          # start dev server (test on device via Expo Go)
npx expo run:android    # development build on Android (after native deps added)
npx expo run:ios        # development build on iOS
```

Use `bunx` instead of `npx` if `bun.lock` is present (project uses pnpm).