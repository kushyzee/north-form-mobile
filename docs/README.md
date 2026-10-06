# NORTH & FORM Mobile — Documentation Index

This directory contains phase-specific and operational documentation. `AGENTS.md` (in the project root) is always-loaded context; open files here only when their scope matches your task.

## Documents

| Document | Covers | Read it when |
|---|---|---|
| `phase-3-1.md` | **Phase 3.1 (complete):** native Google authentication — Supabase client, PKCE OAuth, AsyncStorage persistence, callback route, device verification, debugging history | Working on auth, or when you need to know why `flowType: 'pkce'` and the callback route exist |
| `phase-3-2a.md` | **Phase 3.2A:** mobile API client and cart foundation — bearer injection, cart API semantics, error normalization, Zod validation, `CartProvider`, verified round trip, observation technique | Working on the API client, cart state, or cart endpoints |
| `phase-3-3b.md` | **Phase 3.3B:** catalogue data layer — the four public catalogue endpoints, `Category`/`Product` schemas, query-parameter encoding, public-vs-authenticated access on one shared client | Working on the catalogue, product data, or the API client's request/validation rules |
| `phase-3-3c-1.md` | **Phase 3.3C-1:** catalogue UI — the Shop tab, product grid, category/search/sort controls, loading-empty-error states, the `/product/[slug]` contract, and the native tab-icon decision | Working on the catalogue screens or navigation |
| `phase-3-3c-2.md` | **Phase 3.3C-2 (current):** product detail — the gallery, size and quantity selection, add-to-cart, the **additive** cart semantics and why the quantity ceiling is not the stock figure, physical-device verification | Working on the product-detail screen or add-to-cart |
| `PROJECT_STATUS.md` (project root) | Current implementation state, verified facts, handoff guidance for new agents | Starting any task or switching agents |

## Phase Documents

| Phase | Status | Scope |
|---|---|---|
| Phase 3.1 | ✅ Complete and device-verified | Native Google authentication |
| Phase 3.2A | ✅ Transport + cart state verified end to end | API client + cart state foundation |
| Phase 3.3B | ✅ Data layer unit-tested; schemas confirmed live | Catalogue data layer (no UI) |
| Phase 3.3C-1 | ✅ Typecheck, lint, bundle, tests pass; **device-verified in 3.3C-2** | Catalogue navigation + product listing |
| Phase 3.3C-2 | ✅ **Device-verified** on physical Android against the live API | Product detail, size/quantity selection, add to cart |
| Next | ⬜ Not started | Cart UI, checkout, orders |

## How to Use

1. Always read `AGENTS.md` first (always-loaded)
2. Read `PROJECT_STATUS.md` for current state
3. Read `docs/README.md` (this file) to find the relevant phase document
4. Read the phase document for detailed implementation context
5. Inspect git status and actual code before making changes