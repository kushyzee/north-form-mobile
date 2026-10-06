import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * `/product/[slug]` — the product-detail route.
 *
 * **This is the route contract only.** Phase 3.3C-2 builds the screen; this
 * phase establishes the destination so the listing can navigate to something that
 * exists, rather than to a path that would 404 or, worse, silently resolve to the
 * product *list* if the slug segment were ever empty.
 *
 * What this phase fixes, and 3.3C-2 should keep:
 *
 * - the route lives at `/product/[slug]`, outside the `(tabs)` group, so the tab
 *   bar is not shown over a detail view;
 * - the slug arrives as a **path parameter**, already URL-decoded by Expo Router,
 *   so `getProductBySlug(slug)` receives it directly rather than re-encoded;
 * - `getProductBySlug()` is already implemented and Zod-validated in
 *   `src/lib/api.ts` — this phase deliberately does not call it.
 *
 * The back button is provided by the stack header rather than a hand-rolled
 * control, so the platform's expected gesture works.
 */
export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Product' }} />

      <View
        style={[
          styles.inner,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: BottomTabInset + Spacing.four,
          },
        ]}>
        <ThemedText type="small" themeColor="textSecondary">
          Product detail
        </ThemedText>

        <ThemedText type="smallBold" style={styles.slug}>
          {slug}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          This screen is implemented in Phase 3.3C-2. The route and slug contract are in place, so
          the catalogue already navigates here correctly.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  slug: {
    fontFamily: undefined,
  },
  centered: {
    textAlign: 'left',
  },
});