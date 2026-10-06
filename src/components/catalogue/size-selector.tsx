import { ScrollView, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Size selection.
 *
 * A horizontal row of chips rather than a picker sheet: apparel sizes are short,
 * glanceable labels, and a shopper comparing "M" against "L" against the size they
 * already own wants them side by side. The sheet pattern is better suited to the
 * long sort labels in `SortPicker`.
 *
 * Exactly one size is selected at a time because a cart line is keyed by
 * `(productId, size)` on the server — two selected sizes would be two lines, and
 * the shopper chose one product, not two.
 */
export function SizeSelector({
  sizes,
  selectedSize,
  onSelect,
  disabled,
}: {
  /** `product.sizes`, exactly as the API sent it. */
  sizes: string[];
  selectedSize: string | null;
  onSelect: (size: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  /**
   * A product with no sizes is a real row shape, not a broken one. There is
   * nothing to choose and nothing to gate on, so the selector is simply absent
   * rather than rendering an empty, unpressable strip that looks broken.
   */
  if (sizes.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <ThemedText type="smallBold">Size</ThemedText>
        {selectedSize === null && (
          <ThemedText type="small" themeColor="textSecondary">
            Select a size
          </ThemedText>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        {sizes.map((size) => {
          const active = size === selectedSize;

          return (
            <Pressable
              key={size}
              onPress={() => onSelect(size)}
              disabled={disabled}
              accessibilityRole="radio"
              // `accessibilityState.selected` is what a screen reader announces
              // for an exclusive choice; there is no `aria-pressed` equivalent.
              accessibilityState={{ selected: active, checked: active, disabled: !!disabled }}
              accessibilityLabel={`Size ${size}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? theme.text : theme.backgroundElement,
                  borderColor: active ? theme.text : 'transparent',
                },
                pressed && styles.pressed,
                disabled && styles.disabled,
              ]}>
              <ThemedText type="small" themeColor={active ? 'background' : 'text'}>
                {size}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  content: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  chip: {
    // 44pt minimum touch target.
    minWidth: 52,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
