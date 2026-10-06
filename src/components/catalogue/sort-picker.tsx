import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PRODUCT_SORTS, type ProductSort } from '@/lib/catalogue-schema';
import { useTheme } from '@/hooks/use-theme';

/**
 * Human-readable labels for the sort options.
 *
 * Mirrors the web app's `SORT_LABELS` so a shopper who uses both surfaces sees
 * the same wording. The keys are the only values the API accepts — no option is
 * invented here, and `PRODUCT_SORTS` is the authority on what is legal.
 */
const SORT_LABELS: Record<ProductSort, string> = {
  featured: 'Featured',
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'name-asc': 'Name: A–Z',
};

/**
 * Sort control. A button that opens a sheet of the five supported orders.
 *
 * A modal rather than an inline list because the labels are long ("Price: high
 * to low") and would otherwise push the product grid off the first screen.
 */
export function SortPicker({
  value,
  onChange,
}: {
  value: ProductSort;
  onChange: (next: ProductSort) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  function choose(next: ProductSort) {
    onChange(next);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Sort products, currently ${SORT_LABELS[value]}`}
        style={({ pressed }) => [
          styles.trigger,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="small" themeColor="textSecondary">
          Sort
        </ThemedText>
        <ThemedText type="smallBold">{SORT_LABELS[value]}</ThemedText>
        <SymbolView
          name={{ ios: 'chevron.up.chevron.down', android: 'unfold_more', web: 'unfold_more' }}
          size={11}
          tintColor={theme.textSecondary}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable
          // Tapping the scrim dismisses; the sheet itself stops propagation.
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close sort options"
          style={styles.scrim}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.sheet, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold" style={styles.sheetTitle}>
              Sort by
            </ThemedText>

            {PRODUCT_SORTS.map((sort) => {
              const active = sort === value;
              return (
                <Pressable
                  key={sort}
                  onPress={() => choose(sort)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, checked: active }}
                  accessibilityLabel={SORT_LABELS[sort]}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    type="small"
                    themeColor={active ? 'text' : 'textSecondary'}
                    // Weight, not colour alone, marks the current option.
                    style={active ? styles.optionActive : undefined}>
                    {SORT_LABELS[sort]}
                  </ThemedText>

                  {active && (
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      size={14}
                      tintColor={theme.text}
                    />
                  )}
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    minHeight: 44,
  },
  pressed: {
    opacity: 0.7,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.one,
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
  },
  sheetTitle: {
    marginBottom: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // 44pt touch target.
    paddingVertical: Spacing.three,
  },
  optionActive: {
    fontWeight: '700',
  },
  cancel: {
    alignItems: 'center',
    paddingTop: Spacing.three,
    marginTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.35)',
  },
});