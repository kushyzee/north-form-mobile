import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Product } from '@/lib/catalogue-schema';

/**
 * A horizontal gallery of the product's images.
 *
 * A `ScrollView` rather than a paged carousel: `expo-image` already handles
 * decoding and caching, and paging gestures would be re-implementing what the
 * platform scroll view does natively. The instruction for this phase was
 * explicitly a simple horizontal gallery.
 *
 * **The failure handling is inherited from `ProductCard`** — a failed URL is
 * tracked per-index, not in one shared boolean, because a gallery has several
 * independent images and one broken URL must not blank the others. That is the
 * only real difference from the card, and it is why this is a separate component
 * rather than a reused one.
 */
export function ProductGallery({ product }: { product: Product }) {
  const theme = useTheme();

  /**
   * Which image indices have failed to load, by index rather than by URL. A
   * product whose `images` array is later refreshed would otherwise keep stale
   * failures applied to new URLs at the same position.
   */
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  const placeholder = (
    <View
      style={[styles.frame, styles.placeholder, { backgroundColor: theme.backgroundElement }]}
      accessibilityLabel={`${product.name} has no photograph`}>
      {/* The name's initial stands in, matching the card, so the frame reads as a
          product rather than as a loading hole. */}
      <ThemedText type="title" themeColor="textSecondary">
        {product.name.slice(0, 1).toUpperCase()}
      </ThemedText>
    </View>
  );

  /**
   * Indices that can actually be rendered: a non-empty URL that has not failed.
   *
   * Built from `map`+filter over indices rather than
   * `images.filter((uri) => !failed[images.indexOf(uri)])` — `indexOf` returns
   * the *first* match, so a catalogue row listing the same photograph twice would
   * have its second copy marked failed when only the first one was.
   */
  const usableIndices = product.images
    .map((uri, index) => ({ uri, index }))
    .filter(({ uri, index }) => uri.trim() !== '' && failed[index] !== true);

  if (usableIndices.length === 0) {
    return <View style={styles.container}>{placeholder}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      // Announced so the number of photographs is available without swiping.
      accessibilityLabel={`${product.name}, ${usableIndices.length} ${
        usableIndices.length === 1 ? 'photograph' : 'photographs'
      }`}>
      {usableIndices.map(({ uri, index }) => (
        <View
          key={`${uri}#${index}`}
          style={[styles.frame, { backgroundColor: theme.backgroundElement }]}>
          <Image
            source={uri}
            style={styles.image}
            contentFit="cover"
            transition={150}
            // Swaps this frame to the placeholder rather than leaving a hole.
            onError={() => setFailed((current) => ({ ...current, [index]: true }))}
            accessibilityIgnoresInvertColors
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  frame: {
    // Same 3:4 ratio the cards use, so the listing and the detail page agree on
    // how a product's photography is framed.
    width: 280,
    aspectRatio: 3 / 4,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
