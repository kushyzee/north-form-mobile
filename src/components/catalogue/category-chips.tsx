import { ScrollView, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/lib/catalogue-schema';
import { useTheme } from '@/hooks/use-theme';

/**
 * Category filter, as a horizontally scrolling row of chips.
 *
 * "All" is the absence of a filter rather than a category of its own, so it is
 * selected by `activeCategory === null`. Choosing a chip changes the query and
 * the list reloads from the API — filtering the page already in memory would
 * silently mean something different once the catalogue outgrows one response.
 */
export function CategoryChips({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: Category[];
  /** The selected category's slug, or `null` for "All". */
  activeCategory: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      <Chip
        label="All"
        active={activeCategory === null}
        onPress={() => onSelect(null)}
        theme={theme}
      />
      {categories.map((category) => (
        <Chip
          key={category.id}
          label={category.name}
          active={activeCategory === category.slug}
          onPress={() => onSelect(category.slug)}
          theme={theme}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // `accessibilityState.selected` is what a screen reader announces for a
      // filter chip; `aria-pressed` has no React Native equivalent.
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Show ${label}`}
      // 44pt is the smallest comfortable touch target; the visual chip is
      // smaller, so the hit slop is widened rather than the chip padded.
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? theme.text : theme.backgroundElement,
          borderColor: active ? theme.text : 'transparent',
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText
        type="small"
        themeColor={active ? 'background' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});