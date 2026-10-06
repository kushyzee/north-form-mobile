import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ProductDetail,
  ProductDetailError,
  ProductDetailSkeleton,
  ProductNotFound,
} from '@/components/catalogue/product-detail';
import { useToast } from '@/components/toast';
import { MaxContentWidth } from '@/constants/theme';
import { useCart } from '@/context/cart';
import { useCatalogueApi } from '@/hooks/use-catalogue-api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, toUserMessage } from '@/lib/api-error';
import type { Product } from '@/lib/catalogue-schema';
import {
  availableToAdd,
  cartAddConfirmation,
  clampQuantity,
  MIN_QUANTITY,
  quantityInCart,
} from '@/lib/product-detail';

/**
 * `/product/[slug]` — the product-detail screen.
 *
 * Fetches one product over the **public** catalogue API and adds it to the
 * server-authoritative cart.
 *
 * ## Why `useCatalogueApi()` and not `useApi()`
 *
 * `useApi()` returns `null` when signed out. That is correct for the cart, but
 * this endpoint is public, so gating on it would render an error to any signed-out
 * visitor instead of a product. `useCatalogueApi()` never returns `null` and
 * still attaches the bearer token when a session exists.
 *
 * ## Cart semantics
 *
 * `addItem()` issues `POST /api/cart/items`, which **increments** an existing
 * `(productId, size)` line rather than setting it. So the quantity selected here
 * is "how many more to add": a shopper who already has 2 × Medium and adds 3 ends
 * up with 5 × Medium. This is the API's contract, not a choice made here, and it
 * is why `setQuantity()` is deliberately never called from this screen — that
 * would silently turn "add" into "set".
 *
 * The server is authoritative throughout. `CartProvider` replaces its state with
 * the complete `Cart` the mutation returned; no quantity is computed locally and
 * no follow-up GET is issued.
 *
 * Success is acknowledged with the shared `useToast()` — non-blocking, so the
 * shopper can keep browsing or add again immediately.
 */
export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const api = useCatalogueApi();
  const theme = useTheme();
  const { cart, addItem, error: cartError } = useCart();
  const toast = useToast();

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const [submitting, setSubmitting] = useState(false);
  /**
   * Whether an add has been attempted from **this screen**.
   *
   * Needed because `CartProvider` holds one shared `error` slot that may already
   * contain a failure from its own initial `getCart()`. Rendering that here would
   * tell the shopper "adding this failed" before they had pressed anything. A
   * boolean marks the error as ours without duplicating or flattening the
   * provider's error — the raw typed error is still what gets displayed.
   */
  const [hasAttempted, setHasAttempted] = useState(false);

  /**
   * One completed product request, tagged with the slug it belongs to.
   *
   * The tag is what lets the loading state be *derived* rather than an imperative
   * flag set inside the effect — the pattern established in `shop.tsx`. It also
   * means a slow response for a slug the shopper has already navigated away from
   * is discarded rather than rendered.
   */
  const [result, setResult] = useState<{
    key: string;
    product: Product | null;
    error: unknown;
  } | null>(null);

  /** Bumped by "try again" to re-run the request for the same slug. */
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Expo Router hands over an **already-decoded** slug, so it goes to
   * `getProductBySlug()` unchanged. Re-encoding here would produce a slug the API
   * could not match — and `getProductBySlug()` encodes its own path segment
   * internally, which is a different job.
   *
   * A slug can also arrive as `string | string[]` from a malformed deep link;
   * only the first value is meaningful and the rest is dropped.
   */
  const productSlug = useMemo(() => (Array.isArray(slug) ? slug[0] : slug) ?? '', [slug]);

  const queryKey = `${reloadToken}|${productSlug}`;

  useEffect(() => {
    // Nothing to look up. An empty slug would otherwise collapse the request to
    // the *product list* endpoint, which answers 200 with an array.
    if (productSlug.trim() === '') return;

    let cancelled = false;

    api
      .getProductBySlug(productSlug)
      .then((product) => {
        if (cancelled) return;
        setResult({ key: queryKey, product, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setResult({ key: queryKey, product: null, error: caught });
      });

    return () => {
      cancelled = true;
    };
  }, [api, productSlug, queryKey]);

  /**
   * False while the displayed result belongs to an older request.
   *
   * The comparison is against `queryKey`, which carries the reload token as well
   * as the slug. Comparing the slug alone would report a previous *successful*
   * result as settled the instant "try again" was tapped, so the retry would
   * never show its skeleton — it would look like nothing happened.
   */
  const settled = result !== null && result.key === queryKey;
  const loading = !settled;
  const productError = settled ? result.error : null;
  const product = settled ? result.product : null;

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  /**
   * How much room is left to add, and how much of this size is already held.
   *
   * Derived from the live `cart` rather than held in state, so a successful
   * mutation — which replaces `cart` with the server's version — immediately
   * tightens the ceiling without this screen recomputing anything itself. That is
   * the whole point of the server-authoritative cart: no local arithmetic.
   *
   * Before a product or size is known this is `null`, which the panel treats as
   * "unconstrained" so the controls are never disabled purely for being unknown.
   */
  const maxAddable =
    product === null ? null : availableToAdd(cart, product.id, selectedSize, product.stockQuantity);

  const alreadyInCart =
    product === null || selectedSize === null ? 0 : quantityInCart(cart, product.id, selectedSize);

  /**
   * A fresh size invalidates the previous size's choices.
   *
   * Written in the click handler rather than an effect: re-clamping when the
   * selection changes would mean a `setState` in an effect body, which the React
   * Compiler lint correctly rejects. The stepper clamps on every press too, so
   * this is about honest UI rather than safety.
   */
  const selectSize = useCallback(
    (size: string) => {
      setSelectedSize(size);

      // Re-clamp against the ceiling for the *new* size, which may be tighter.
      setQuantity((current) =>
        product === null
          ? current
          : clampQuantity(current, availableToAdd(cart, product.id, size, product.stockQuantity))
      );
    },
    [cart, product]
  );

  const changeQuantity = useCallback(
    (next: number) => {
      if (product === null) return;
      setQuantity(clampQuantity(next, availableToAdd(cart, product.id, selectedSize, product.stockQuantity)));
    },
    [cart, product, selectedSize]
  );

  /**
   * Adds the chosen quantity to the cart.
   *
   * `addItem()` resolves to `void` — `CartProvider` has already adopted the
   * server's cart by the time it does — so success is the absence of a thrown
   * error, and the feedback below is what the shopper is told. There is no local
   * count to increment and no fake cart to build.
   */
  const handleAddToCart = useCallback(async () => {
    if (!product || selectedSize === null || submitting) return;

    setSubmitting(true);
    setHasAttempted(true);

    try {
      await addItem({
        productId: product.id,
        size: selectedSize,
        quantity,
      });

      /**
       * The toast states the **resulting** total, not the quantity that was
       * typed. Because the server increments, "added 1" against a line of 2
       * means the shopper now has 3; saying only "added 1" would read as though
       * their cart had been *set* to 1, which is precisely the misunderstanding
       * this screen has to avoid.
       *
       * `alreadyInCart` is read from the cart `CartProvider` has just replaced
       * with the server's response, so this is the server's own figure rather
       * than anything computed here.
       */
      toast.show(
        cartAddConfirmation({
          productName: product.name,
          size: selectedSize,
          alreadyInCart,
          added: quantity,
        })
      );
    } catch {
      // `CartProvider` swallows the failure into its own `error`; it is read
      // below and rendered inline, so nothing is re-thrown or duplicated here.
    } finally {
      setSubmitting(false);
    }
  }, [addItem, alreadyInCart, product, quantity, selectedSize, submitting, toast]);

  /**
   * The customer-safe message for a failed add, or `null`.
   *
   * `CartProvider` keeps the raw typed error rather than flattening it to a
   * string, so presentation happens here with `toUserMessage()` — the same
   * contract the catalogue listing uses.
   *
   * Three conditions must all hold, and each one rules out a specific wrong
   * answer:
   *
   * - `hasAttempted` — otherwise an error left over from the provider's own
   *   initial load would be shown as if adding *this* product had failed;
   * - `!submitting` — otherwise the previous failure would flash on screen for
   *   the duration of the next press, before its own outcome was known;
   * - `cartError !== null` — `CartProvider` clears its error on success, so a
   *   successful add shows no message.
   */
  const mutationMessage =
    hasAttempted && !submitting && cartError !== null ? toUserMessage(cartError) : null;

  /**
   * A `PRODUCT_NOT_FOUND` is not a failure to retry — the product is gone, so a
   * "Try again" button would invite a shopper to press it forever.
   *
   * Matched on the **code** rather than the status: any other 404 from this
   * endpoint would still be a missing product, but a 404 from a proxy would not,
   * and treating a proxy's 404 as "this product was deleted" would be a confident
   * wrong answer. The code is the server stating the fact deliberately.
   */
  const notFound = productError instanceof ApiError && productError.code === 'PRODUCT_NOT_FOUND';

  /**
   * An empty or absent slug never reaches the API, so there is no response to
   * interpret — it is a bad deep link, and the same not-found view is the honest
   * thing to show for it.
   */
  const badRequest = productSlug.trim() === '';

  // The not-found view covers both "the API says this product is gone" and "the
  // deep link carried no usable slug" — neither is worth a retry button.
  const showNotFound = notFound || badRequest;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        // The product's own name becomes the header title once it is known, which
        // is why `loading` is read here rather than discarded.
        options={{
          title: showNotFound
            ? 'Product'
            : product === null && loading
              ? 'Loading…'
              : (product?.name ?? 'Product'),
        }}
      />

      <View style={styles.container}>
        {showNotFound ? (
          <ProductNotFound slug={badRequest ? '' : productSlug} />
        ) : productError !== null ? (
          <ProductDetailError message={toUserMessage(productError)} onRetry={retry} />
        ) : product === null ? (
          <ProductDetailSkeleton />
        ) : (
          <ProductDetail
            product={product}
            selectedSize={selectedSize}
            onSelectSize={selectSize}
            quantity={quantity}
            onChangeQuantity={changeQuantity}
            onAddToCart={handleAddToCart}
            submitting={submitting}
            errorMessage={mutationMessage}
            // Non-null whenever the panel renders — the product is known by then.
            maxAddable={maxAddable ?? MIN_QUANTITY}
            alreadyInCart={alreadyInCart}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
});
