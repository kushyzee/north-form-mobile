import { useMemo } from 'react';

import { useAuth } from '@/context/auth';
import { createApiClient, type ApiClient } from '@/lib/api';

/**
 * Authenticated API client for the current Supabase session.
 *
 * Reads the access token from the existing `AuthProvider` rather than keeping a
 * second copy of session state. Returns `null` when signed out so callers can
 * render an unauthenticated view instead of firing requests.
 */
export function useApi(): ApiClient | null {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;

  return useMemo(() => (accessToken ? createApiClient(accessToken) : null), [accessToken]);
}