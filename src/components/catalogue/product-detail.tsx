import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AddToCartPanel } from '@/components/catalogue/add-to-cart-panel';
import { ProductGallery } from '@/components/catalogue/product-gallery';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Product } from '@/lib/catalogue-schema';
import { formatNaira } from '@/lib/format';

/**
 * The product-detail screen.
 *
 * Presentational: it receives a `Product` and renders it. All fetching, loading
 * and error decisions belong to the route (`src/app/product/[slug].tsx`), which
 * is the only place that knows about the API and the cart.
 */
export function ProductDetail({
  product,
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
  product: Product;
  selectedSize: string | null;
  onSelectSize: (size: string) => void;
  quantity: number;
  onChangeQuantity: (next: number) => void;
  onAddToCart: () => void;
  submitting: boolean;
  errorMessage: string | null;
  /** How many more units may be added for the selected size. */
  maxAddable: number;
  /** How many of the selected size the shopper already holds. */
  alreadyInCart: number;
}) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: BottomTabInset + Spacing.four },
      ]}>
      <View style={styles.inner}>
        <ProductGallery product={product} />

        <View style={styles.details}>
          <ThemedText type="code" themeColor="textSecondary" numberOfLines={1}>
            {product.category.name}
          </ThemedText>

          <ThemedText type="subtitle">{product.name}</ThemedText>

          <ThemedText type="title" themeColor={product.stockQuantity <= 0 ? 'textSecondary' : 'text'}>
            {formatNaira(product.price)}
          </ThemedText>

          {/* `productSchema` requires a non-empty description, so this is always
              real copy — no "no description available" branch is needed. */}
          <ThemedText type="default" themeColor="textSecondary">
            {product.description}
          </ThemedText>

          <AddToCartPanel
            stockQuantity={product.stockQuantity}
            sizes={product.sizes}
            selectedSize={selectedSize}
            onSelectSize={onSelectSize}
            quantity={quantity}
            onChangeQuantity={onChangeQuantity}
            onAddToCart={onAddToCart}
            submitting={submitting}
            errorMessage={errorMessage}
            maxAddable={maxAddable}
            alreadyInCart={alreadyInCart}
          />
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * Shown while the first product request is outstanding.
 *
 * Skeletons rather than a spinner, matching the loading pattern already
 * established in `ProductGrid`: the placeholder occupies the same shape as the
 * real screen, so nothing jumps when the data lands.
 */
export function ProductDetailSkeleton() {
  const theme = useTheme();
  const tile = theme.backgroundElement;

  return (
    <View
      style={styles.skeleton}
      accessibilityLabel="Loading product"
      accessibilityLiveRegion="polite">
      <View style={[styles.skeletonImage, { backgroundColor: tile }]} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { backgroundColor: tile, width: '35%' }]} />
        <View style={[styles.skeletonLine, { backgroundColor: tile, width: '80%', height: 28 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: tile, width: '45%', height: 24 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: tile, width: '100%', height: 64 }]} />
      </View>
    </View>
  );
}

/**
 * Shown when the product request failed for a reason other than "it does not
 * exist" — a network problem or a server error.
 *
 * Reuses the same customer-safe message contract as `CatalogueErrorState`: the
 * caller passes `toUserMessage(error)`, so no raw error or URL reaches this view.
 */
export function ProductDetailError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useTheme();

  return (
    <View
      style={styles.centered}
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={`Could not load this product. ${message}`}>
      <SymbolView
        name={{ ios: 'wifi.exclamationmark', android: 'wifi_off', web: 'error' }}
        size={28}
        tintColor={theme.textSecondary}
      />

      <ThemedText type="smallBold" style={styles.centerText}>
        Could not load this product
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {message}
      </ThemedText>

      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading this product"
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold">Try again</ThemedText>
      </Pressable>

      <BackToShop />
    </View>
  );
}

/**
 * Shown when the API answers `PRODUCT_NOT_FOUND`.
 *
 * This is a **different fact** from a failure, so it gets its own view rather
 * than being folded into the error state: the product is genuinely gone (an
 * unpublish, or a stale deep link), and retrying cannot help. Offering "Try
 * again" here would invite a shopper to press it forever.
 */
export function ProductNotFound({ slug }: { slug: string }) {
  const theme = useTheme();

  return (
    <View
      style={styles.centered}
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel="Product not found">
      <SymbolView
        name={{ ios: 'questionmark.circle', android: 'help', web: 'help' }}
        size={28}
        tintColor={theme.textSecondary}
      />

      <ThemedText type="smallBold" style={styles.centerText}>
        Product not found
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        This piece is no longer available. It may have been removed from the shop.
      </ThemedText>

      {/* Shown so a shopper who arrived by deep link can tell *which* address
          failed, which is otherwise indistinguishable from the shop being empty. */}
      {slug.trim() !== '' && (
        <ThemedText type="code" themeColor="textSecondary" numberOfLines={1} style={styles.slug}>
          {slug}
        </ThemedText>
      )}

      <BackToShop />
    </View>
  );
}

/**
 * Returns the shopper to the Shop tab.
 *
 * `replace` rather than `back`, and this matters: the shopper may have arrived by
 * deep link, with nothing to go back to. `router.back()` would either do nothing
 * or, after a cold start, exit the app. Shop is the one destination that is
 * always reachable.
 */
function BackToShop() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.replace('/(tabs)/shop')}
      accessibilityRole="button"
      accessibilityLabel="Back to shop"
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold">Back to shop</ThemedText>
    </Pressable>
  );
}

/** Loading indicator for a retry over an already-visible product. */
export function ProductDetailRefreshing() {
  const theme = useTheme();

  return (
    <View style={styles.refreshing} accessibilityLiveRegion="polite">
      <ActivityIndicator color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        Updating…
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  details: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  skeleton: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Spacing.three,
    marginHorizontal: Spacing.four,
  },
  skeletonBody: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  skeletonLine: {
    height: 14,
    borderRadius: Spacing.one,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  slug: {
    textAlign: 'center',
  },
  action: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  refreshing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
});
