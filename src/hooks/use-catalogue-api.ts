import { useMemo } from 'react';

import { useAuth } from '@/context/auth';
import { createApiClient, type ApiClient } from '@/lib/api';

/**
 * API client for the **public** catalogue endpoints.
 *
 * `useApi()` returns `null` when signed out, which is correct for the cart but
 * wrong for the catalogue: those endpoints need no session, so gating on it
 * would render an empty shop instead of the catalogue to any signed-out
 * visitor.
 *
 * This reads the session from the same `AuthProvider` `useApi()` does and hands
 * the token to the same `createApiClient()`. That client already treats a
 * catalogue read as public — it attaches `Authorization` only when a token
 * exists — so a signed-in shopper is still recognised while a signed-out one is
 * not blocked. Authentication semantics are unchanged: no credential is
 * invented, and no session is required.
 *
 * It never returns `null`, which is what lets a catalogue screen simply render.
 */
export function useCatalogueApi(): ApiClient {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;

  return useMemo(() => createApiClient(accessToken), [accessToken]);
}