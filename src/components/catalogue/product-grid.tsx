import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ProductCard } from "@/components/catalogue/product-card";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { Product } from "@/lib/catalogue-schema";

/**
 * The product grid.
 *
 * Occupied space while a refresh is in flight rather than collapsing, so
 * changing the filter does not make the page jump and lose the shopper's place.
 * A skeleton row stands in for the first screen of results: it is the same
 * shape as a real card, so nothing reflows when the data lands.
 */
export function ProductGrid({
  products,
  loading,
  loadingSkeletonCount,
}: {
  products: Product[];
  /** True while replacing the current results. */
  loading: boolean;
  /** How many placeholder cards to draw, for the first load. */
  loadingSkeletonCount?: number;
}) {
  const theme = useTheme();

  // First load with nothing to show yet: draw placeholders rather than an
  // empty page, so the screen is never blank while the catalogue arrives.
  const showSkeleton = loading && products.length === 0;

  if (showSkeleton) {
    const count = loadingSkeletonCount ?? 4;
    return (
      <View
        style={styles.grid}
        accessibilityLabel="Loading products"
        accessibilityLiveRegion="polite"
      >
        {Array.from({ length: count }, (_, index) => (
          <View key={index} style={styles.cell}>
            <SkeletonTile color={theme.backgroundElement} ratio={3 / 4} />
            <SkeletonTile
              color={theme.backgroundElement}
              height={12}
              width="60%"
            />
            <SkeletonTile
              color={theme.backgroundElement}
              height={14}
              width="85%"
            />
            <SkeletonTile
              color={theme.backgroundElement}
              height={14}
              width="40%"
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {products.map((product) => (
        <View key={product.id} style={styles.cell}>
          <ProductCard product={product} />
        </View>
      ))}

      {loading && products.length > 0 && (
        // A refresh over results already on screen: mark the change without
        // hiding what is already there.
        <View style={styles.refreshing} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            Updating…
          </ThemedText>
        </View>
      )}
    </View>
  );
}

function SkeletonTile({
  color,
  ratio,
  height,
  width,
}: {
  color: string;
  ratio?: number;
  height?: number;
  width?: `${number}%`;
}) {
  return (
    <View
      style={[
        styles.skeleton,
        { backgroundColor: color, aspectRatio: ratio, height, width },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.four,
    columnGap: Spacing.two,
    rowGap: Spacing.three,
  },
  cell: {
    // Two per row, with the gap taken out of the width so the row always fits
    // exactly two columns regardless of screen width.
    width: "48.5%",
    gap: Spacing.one,
  },
  skeleton: {
    width: "100%",
    borderRadius: Spacing.one,
  },
  refreshing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
});
