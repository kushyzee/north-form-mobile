import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getAvailability, type Product } from '@/lib/catalogue-schema';
import { formatNaira } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

/**
 * A single catalogue product, as a card in the listing grid.
 *
 * The whole card is one pressable target — on touch there is no hover, so
 * splitting it into separate links the way the web card does for keyboard users
 * would only add accidental taps. The accessible name is composed explicitly
 * (`accessibilityLabel`) so it reads as one sentence rather than four unrelated
 * fragments.
 */
export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const theme = useTheme();

  // A catalogue row may carry an empty `images` array, and a populated one can
  // still point at a URL that 404s. Both are handled by the same placeholder, so
  // a broken image never leaves a hole in the grid.
  const [imageFailed, setImageFailed] = useState(false);
  const firstImage = product.images[0];
  const showImage = firstImage !== undefined && firstImage !== '' && !imageFailed;

  const availability = getAvailability(product.stockQuantity);
  const availabilityLabel =
    availability === 'out_of_stock'
      ? 'Sold out'
      : availability === 'low_stock'
        ? `Low stock — ${product.stockQuantity} left`
        : null;

  return (
    <Pressable
      // The object form hands the slug to Expo Router as a *parameter*, so the
      // router owns the encoding. Pre-encoding it here would be encoded twice.
      onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.category.name}, ${formatNaira(product.price)}${
        availabilityLabel ? `, ${availabilityLabel}` : ''
      }`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.imageFrame, { backgroundColor: theme.backgroundElement }]}>
        {showImage ? (
          <Image
            source={firstImage}
            style={styles.image}
            contentFit="cover"
            transition={150}
            // A failed load swaps to the placeholder rather than an empty frame.
            onError={() => setImageFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          // No product imagery: the name's initial stands in, so the card still
          // reads as a distinct item rather than an empty tile.
          <ThemedText type="subtitle" themeColor="textSecondary">
            {product.name.slice(0, 1).toUpperCase()}
          </ThemedText>
        )}

        {availabilityLabel && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  availability === 'out_of_stock' ? theme.text : theme.background,
              },
            ]}>
            <ThemedText
              type="code"
              themeColor={availability === 'out_of_stock' ? 'background' : 'text'}>
              {availability === 'out_of_stock' ? 'Sold out' : 'Low stock'}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.details}>
        <ThemedText type="code" themeColor="textSecondary" numberOfLines={1}>
          {product.category.name}
        </ThemedText>

        <ThemedText type="smallBold" numberOfLines={2}>
          {product.name}
        </ThemedText>

        <ThemedText
          type="small"
          themeColor={availability === 'out_of_stock' ? 'textSecondary' : 'text'}>
          {formatNaira(product.price)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  imageFrame: {
    aspectRatio: 3 / 4,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.one,
  },
  details: {
    gap: Spacing.one,
  },
});