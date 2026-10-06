import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { canDecrement, canIncrement, clampQuantity } from '@/lib/product-detail';

/**
 * The quantity stepper: `−  quantity  +`.
 *
 * The bounds are enforced **here** rather than only at the button's disabled
 * state, because a disabled control still has to be told the truth: clamping in
 * the change handler means the value cannot go out of range even if the stepper
 * is driven by a screen reader's increment/decrement actions, which bypass a
 * pressed-style check entirely.
 *
 * `max` is how many more units may be added, which is **not** always the product
 * stock: when the shopper already holds some of this size in their cart, the
 * remaining room is less. See `availableToAdd()` in `src/lib/product-detail.ts`.
 *
 * The API does not expose stock per size, so no per-size ceiling is applied.
 */
export function QuantityStepper({
  quantity,
  max,
  onChange,
  disabled,
}: {
  quantity: number;
  /** The most that may be added — see `availableToAdd()`. */
  max: number;
  onChange: (next: number) => void;
  /** True when the whole control is unusable, e.g. a sold-out product. */
  disabled?: boolean;
}) {
  const decrementDisabled = disabled || !canDecrement(quantity);
  const incrementDisabled = disabled || !canIncrement(quantity, max);

  return (
    <View style={styles.row}>
      <StepButton
        symbol={{ ios: 'minus', android: 'remove', web: 'remove' }}
        label="Decrease quantity"
        disabled={decrementDisabled}
        onPress={() => onChange(clampQuantity(quantity - 1, max))}
      />

      {/* Announced on change, so the count is not visual-only. */}
      <ThemedText
        type="smallBold"
        style={styles.value}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Quantity ${quantity}`}>
        {quantity}
      </ThemedText>

      <StepButton
        symbol={{ ios: 'plus', android: 'add', web: 'add' }}
        label="Increase quantity"
        disabled={incrementDisabled}
        onPress={() => onChange(clampQuantity(quantity + 1, max))}
      />
    </View>
  );
}

function StepButton({
  symbol,
  label,
  disabled,
  onPress,
}: {
  symbol: ComponentProps<typeof SymbolView>['name'];
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      // `disabled` stops the press *and* is what a screen reader announces, so the
      // control is not merely styled as unavailable while still being pressable.
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      // 44pt is the smallest comfortable touch target.
      style={({ pressed }) => [
        styles.stepButton,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <SymbolView
        name={symbol}
        size={16}
        tintColor={disabled ? theme.textSecondary : theme.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: Spacing.five,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
