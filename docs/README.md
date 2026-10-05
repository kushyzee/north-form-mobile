# NORTH & FORM Mobile — Documentation Index

This directory contains phase-specific and operational documentation. `AGENTS.md` (in the project root) is always-loaded context; open files here only when their scope matches your task.

## Documents

| Document | Covers | Read it when |
|---|---|---|
| `phase-3-1.md` | **Phase 3.1 (complete):** native Google authentication — Supabase client, PKCE OAuth, AsyncStorage persistence, callback route, device verification, debugging history | Working on auth, or when you need to know why `flowType: 'pkce'` and the callback route exist |
| `phase-3-2a.md` | **Phase 3.2A (current):** mobile API client and cart foundation — bearer injection, cart API semantics, error normalization, Zod validation, `CartProvider`, verified round trip, observation technique | Working on the API client, cart state, or cart endpoints |
| `PROJECT_STATUS.md` (project root) | Current implementation state, verified facts, handoff guidance for new agents | Starting any task or switching agents |

## Phase Documents

| Phase | Status | Scope |
|---|---|---|
| Phase 3.1 | ✅ Complete and device-verified | Native Google authentication |
| Phase 3.2A | ✅ Transport + cart state verified end to end | API client + cart state foundation |
| Next | ⬜ Not started | Cart UI, catalogue, product detail |

## How to Use

1. Always read `AGENTS.md` first (always-loaded)
2. Read `PROJECT_STATUS.md` for current state
3. Read `docs/README.md` (this file) to find the relevant phase document
4. Read the phase document for detailed implementation context
5. Inspect git status and actual code before making changes