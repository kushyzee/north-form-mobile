import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ToastProvider } from '@/components/toast';
import { AuthProvider, useAuth } from '@/context/auth';
import { CartProvider } from '@/context/cart';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = (segments[0] as string) === 'auth';

    if (!session && !inAuthGroup) {
      router.replace('/auth/sign-in' as any);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)' as any);
    }
  }, [session, loading, segments, router]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      {/* Product detail sits outside the tabs group, so it is a pushed screen
          with its own header and back button rather than a tab destination. */}
      <Stack.Screen name="product/[slug]" options={{ title: 'Product' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <CartProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          {/* Outside the navigator so a toast raised from any screen — tab or
              pushed detail — overlays everything. Must be inside
              ThemeProvider, since it reads the theme for its own colours. */}
          <ToastProvider>
            <RootLayoutNav />
          </ToastProvider>
        </ThemeProvider>
      </CartProvider>
    </AuthProvider>
  );
}
