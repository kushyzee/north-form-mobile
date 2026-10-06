import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { QuantityStepper } from '@/components/catalogue/quantity-stepper';
import { SizeSelector } from '@/components/catalogue/size-selector';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { availabilitySummary, canAddToCart, MIN_QUANTITY } from '@/lib/product-detail';

/**
 * The buy panel: availability, size, quantity, and the Add to cart button.
 *
 * Kept separate from the route because all of it is controlled by four pieces of
 * state the route owns. It is presentational — it performs no fetching and knows
 * nothing about the cart beyond the callbacks it is given.
 */
export function AddToCartPanel({
  stockQuantity,
  sizes,
  selectedSize,
  onSelectSize,
  quantity,
  onChangeQuantity,
  onAddToCart,
  submitting,
  errorMessage,
  maxAddable,
  alreadyInCart,
}: {
  stockQuantity: number;
  sizes: string[];
  selectedSize: string | null;
  onSelectSize: (size: string) => void;
  quantity: number;
  onChangeQuantity: (next: number) => void;
  onAddToCart: () => void;
  submitting: boolean;
  /** Customer-safe message from a failed mutation, or `null`. */
  errorMessage: string | null;
  /** How many more units may be added for the selected size. */
  maxAddable: number;
  /** How many of the selected size the shopper already holds. */
  alreadyInCart: number;
}) {
  const theme = useTheme();

  const addEnabled = canAddToCart({
    stockQuantity,
    size: selectedSize,
    max: maxAddable,
    submitting,
  });

  /**
   * Why the button is unavailable, so a disabled control explains itself rather
   * than sitting inert. The server will re-check all of it regardless.
   */
  const disabledReason =
    stockQuantity <= 0
      ? 'Sold out'
      : selectedSize === null
        ? 'Select a size first'
        : maxAddable < MIN_QUANTITY
          ? 'All stock in your cart'
          : submitting
            ? 'Adding…'
            : null;

  return (
    <View style={styles.container}>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        accessibilityLiveRegion="polite">
        {availabilitySummary(stockQuantity)}
      </ThemedText>

      <SizeSelector
        sizes={sizes}
        selectedSize={selectedSize}
        onSelect={onSelectSize}
        // Sizes stay tappable while submitting so a shopper can adjust, but the
        // press cannot start a competing mutation: the button is already disabled.
        disabled={submitting}
      />

      {sizes.length > 0 && (
        <View style={styles.quantityRow}>
          <ThemedText type="smallBold">Quantity</ThemedText>
          <QuantityStepper
            quantity={quantity}
            max={maxAddable}
            onChange={onChangeQuantity}
            disabled={stockQuantity <= 0 || maxAddable < MIN_QUANTITY || submitting}
          />
        </View>
      )}

      {errorMessage !== null && (
        <View
          style={[styles.error, { backgroundColor: theme.backgroundElement }]}
          // Announced on appearance — a failed add must not be a silent no-op.
          accessibilityLiveRegion="assertive"
          accessible
          accessibilityLabel={`Could not add to cart. ${errorMessage}`}>
          <SymbolView
            name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
            size={15}
            tintColor={theme.text}
          />
          <ThemedText type="small" style={styles.errorText}>
            {errorMessage}
          </ThemedText>
        </View>
      )}

      <Pressable
        onPress={onAddToCart}
        disabled={!addEnabled}
        accessibilityRole="button"
        accessibilityLabel={
          selectedSize
            ? `Add ${quantity} ${quantity === 1 ? 'unit' : 'units'} of size ${selectedSize} to cart`
            : 'Add to cart. Select a size first.'
        }
        accessibilityState={{ disabled: !addEnabled, busy: submitting }}
        style={({ pressed }) => [
          styles.button,
          // The button is inverted against the background so it reads as the
          // primary action, matching the selected chips.
          { backgroundColor: theme.text },
          pressed && styles.pressed,
          !addEnabled && styles.buttonDisabled,
        ]}>
        {submitting ? (
          <ActivityIndicator color={theme.background} />
        ) : (
          <ThemedText type="default" themeColor="background">
            {disabledReason ?? 'Add to cart'}
          </ThemedText>
        )}
      </Pressable>

      {selectedSize !== null && !submitting && (
        // `POST /cart/items` increments an existing line rather than setting it,
        // so this control means "add this many more". Stating the running total
        // is what keeps a shopper who already owns 2 of this size from being
        // surprised to see 3 after tapping "Add 1".
        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          {alreadyInCart > 0
            ? `Adds to the ${alreadyInCart} ${alreadyInCart === 1 ? 'unit' : 'units'} of size ${selectedSize} already in your cart.`
            : `Adds ${quantity} ${quantity === 1 ? 'unit' : 'units'} to your cart.`}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  errorText: {
    flex: 1,
  },
  button: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
  footnote: {
    textAlign: 'center',
  },
});
