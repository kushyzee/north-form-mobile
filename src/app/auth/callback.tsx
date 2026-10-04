import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';

/**
 * Landing route for the `northform://auth/callback` OAuth redirect.
 *
 * `WebBrowser.openAuthSessionAsync()` captures the PKCE code on its own (via
 * `Linking`) and `signInWithGoogle()` performs the single
 * `exchangeCodeForSession()` call, so this route must not exchange anything.
 *
 * This screen only exists so Expo Router can match the incoming deep link
 * instead of rendering its "Unmatched Route" screen. It waits for the exchange
 * owned by `AuthProvider` to settle, then hands navigation back to the root
 * layout: a session moves the user to the authenticated tabs, otherwise they
 * return to sign-in.
 */
export default function AuthCallbackScreen() {
  const { session, loading, status } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  const authFlowSettling = loading || status === 'authenticating';

  useEffect(() => {
    if (authFlowSettling) return;
    router.replace(session ? '/(tabs)' : '/auth/sign-in');
  }, [authFlowSettling, session, router]);

  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.text} />
    </ThemedView>
  );
}