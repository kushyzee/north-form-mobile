import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatalogueEmptyState } from '@/components/catalogue/empty-state';
import { CatalogueErrorState } from '@/components/catalogue/error-state';
import { CatalogueSearch } from '@/components/catalogue/catalogue-search';
import { CategoryChips } from '@/components/catalogue/category-chips';
import { ProductGrid } from '@/components/catalogue/product-grid';
import { SortPicker } from '@/components/catalogue/sort-picker';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCatalogueApi } from '@/hooks/use-catalogue-api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api-error';
import type { Category, Product, ProductSort } from '@/lib/catalogue-schema';

/** How long typing settles before a search term is sent to the API. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * One completed products request: the results, and the query they belong to.
 *
 * The query key is stored alongside the data so the screen can tell "these
 * results are for what you are looking at now" from "these results are for the
 * filter you just changed". That is what lets the loading state be *derived*
 * rather than an imperative flag set inside the effect.
 */
type ProductsResult = {
  key: string;
  products: Product[];
  error: unknown;
};

/**
 * The catalogue listing.
 *
 * Categories and products are fetched independently so a failure of one does not
 * blank the other: the filter row and the grid are separate concerns, and the
 * categories call is a small, slow-changing read that need not gate the products
 * a shopper actually came for.
 *
 * **No caching and no optimistic updates.** Each filter change is a fresh request
 * and the list is only replaced by what the server returns. Results already on
 * screen stay put while a new filter loads, so changing the sort does not make
 * the page jump and lose the shopper's place.
 */
export default function ShopScreen() {
  const api = useCatalogueApi();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [result, setResult] = useState<ProductsResult | null>(null);

  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<ProductSort>('featured');

  /** What the shopper has typed, which may not be applied yet. */
  const [searchText, setSearchText] = useState('');
  /** The term the current results were fetched with. */
  const [search, setSearch] = useState<string | undefined>(undefined);

  /** Bumped by "try again" to re-run the request for the same query. */
  const [reloadToken, setReloadToken] = useState(0);

  const queryKey = `${reloadToken}|${category ?? ''}|${search ?? ''}|${sort}`;

  /**
   * Categories are read once per mount. They do not depend on the current filter.
   *
   * `null` means "not loaded yet", so the loading state is derived rather than
   * toggled. Nothing is written to state synchronously in the effect body.
   */
  useEffect(() => {
    let cancelled = false;

    api
      .getCategories()
      .then((next) => {
        if (cancelled) return;
        setCategories(next);
      })
      .catch(() => {
        // The filter row degrades to "All" rather than blocking the listing. A
        // shopper can still browse everything; they just cannot narrow it.
        if (cancelled) return;
        setCategories([]);
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  // Debounce the typed term into the applied one.
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchText.trim();
      setSearch(trimmed === '' ? undefined : trimmed);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchText]);

  // The products request.
  useEffect(() => {
    // Cleanup runs before the next request starts, so an in-flight response
    // that arrives after the filter changed is discarded rather than allowed to
    // overwrite the newer results.
    let cancelled = false;

    api
      .getProducts({ category: category ?? undefined, search, sort })
      .then((next) => {
        if (cancelled) return;
        setResult({ key: queryKey, products: next, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        // A failure clears the list: stale results must not be presented as if
        // they answered the current query.
        setResult({ key: queryKey, products: [], error: caught });
      });

    return () => {
      cancelled = true;
    };
  }, [api, category, search, sort, queryKey]);

  /** False while the displayed results belong to an older query. */
  const settled = result !== null && result.key === queryKey;
  const loading = !settled;
  const productError = settled ? result.error : null;
  // Deliberately *not* keyed to `queryKey`: the previous list stays visible
  // while the next one loads, which keeps the scroll position stable.
  const products = result?.products ?? [];

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const clearFilters = useCallback(() => {
    setCategory(null);
    setSearchText('');
    setSearch(undefined);
    setSort('featured');
  }, []);

  /** Applies a typed term immediately, bypassing the debounce. */
  const submitSearch = useCallback(() => {
    const trimmed = searchText.trim();
    setSearch(trimmed === '' ? undefined : trimmed);
  }, [searchText]);

  const hasFilters = category !== null || search !== undefined;
  const showEmpty = !loading && productError === null && products.length === 0;

  const countLabel = useMemo(() => {
    const count = products.length;
    return `${count} ${count === 1 ? 'product' : 'products'}`;
  }, [products.length]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.two,
            paddingBottom: BottomTabInset + Spacing.four,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading && products.length > 0}
            onRefresh={retry}
            tintColor={theme.textSecondary}
          />
        }>
        <View style={styles.inner}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Shop</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Shirts, denim, shoes and heavyweight cotton. Priced in Naira.
            </ThemedText>
          </View>

          <CatalogueSearch
            value={searchText}
            appliedValue={search}
            onChange={setSearchText}
            onSubmit={submitSearch}
            onClear={() => setSearchText('')}
          />

          <CategoryChips
            categories={categories ?? []}
            activeCategory={category}
            onSelect={setCategory}
          />

          <View style={styles.toolbar}>
            {/* Announced on change so the result count is not visual-only. */}
            <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
              {categories === null ? 'Loading…' : countLabel}
            </ThemedText>

            <SortPicker value={sort} onChange={setSort} />
          </View>

          {productError !== null ? (
            <CatalogueErrorState message={toUserMessage(productError)} onRetry={retry} />
          ) : showEmpty ? (
            <CatalogueEmptyState filtered={hasFilters} onClearFilters={clearFilters} />
          ) : (
            <ProductGrid products={products} loading={loading} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  header: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
  },
});