import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shown when a catalogue query succeeds but returns no products.
 *
 * This is deliberately **not** the error state — "nothing matched" and "we could
 * not load" are different facts, and collapsing them would tell a shopper the
 * shop is empty when it is actually unreachable. The caller passes `filtered` so
 * the copy can distinguish a filter that excluded everything from a catalogue
 * that has nothing in it yet.
 */
export function CatalogueEmptyState({
  filtered,
  onClearFilters,
}: {
  /** True when a category or search term is narrowing the results. */
  filtered: boolean;
  onClearFilters: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <SymbolView
        name={{
          ios: 'magnifyingglass',
          android: 'search',
          web: 'search',
        }}
        size={28}
        tintColor={theme.textSecondary}
      />

      <ThemedText type="smallBold" style={styles.centered}>
        {filtered ? 'No matching products' : 'No products yet'}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {filtered
          ? 'Nothing here matches your search and category. Try a different search, or clear the filters.'
          : 'Nothing has been published yet. Please check back shortly.'}
      </ThemedText>

      {filtered && (
        <Pressable
          onPress={onClearFilters}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold">Clear filters</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centered: {
    textAlign: 'center',
  },
  action: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    marginTop: Spacing.one,
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});