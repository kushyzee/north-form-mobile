import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/context/auth';
import { useApi } from '@/hooks/use-api';
import type { AddItemInput, Cart, CartItemRef, SetQuantityInput } from '@/lib/cart-schema';

/**
 * Server-authoritative cart state.
 *
 * Every successful mutation replaces `cart` with the complete `Cart` the server
 * returned. Quantities are never computed locally and no follow-up GET is
 * issued after a mutation. No optimistic updates — those can be added later if
 * the UI needs them.
 *
 * State is tagged with the user it owns and read back through a derivation, so
 * signing out or switching accounts drops the previous cart without an effect
 * writing to state.
 */

type Owned<T> = { userId: string; value: T };

type CartContextValue = {
  cart: Cart | null;
  /** True while the initial load or a mutation is in flight. */
  loading: boolean;
  error: unknown;
  fetchCart: () => Promise<void>;
  addItem: (input: AddItemInput) => Promise<void>;
  setQuantity: (input: SetQuantityInput) => Promise<void>;
  removeItem: (input: CartItemRef) => Promise<void>;
  clearCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const api = useApi();

  const userId = session?.user?.id ?? null;

  const [ownedCart, setOwnedCart] = useState<Owned<Cart> | null>(null);
  const [ownedError, setOwnedError] = useState<Owned<unknown> | null>(null);
  const [mutating, setMutating] = useState(false);

  // Signed-out, or signed-in as someone else: expose nothing rather than
  // another account's cart.
  const cart = ownedCart && ownedCart.userId === userId ? ownedCart.value : null;
  const error = ownedError && ownedError.userId === userId ? ownedError.value : null;

  /** True until this user's cart has either loaded or failed to. */
  const initialLoadPending = userId !== null && cart === null && error === null;

  // Initial load. State is only written from the promise callbacks, so this does
  // not cascade a render.
  useEffect(() => {
    if (authLoading || !api || !userId) return;

    let cancelled = false;

    api
      .getCart()
      .then((next) => {
        if (cancelled) return;
        setOwnedCart({ userId, value: next });
        setOwnedError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setOwnedError({ userId, value: caught });
      });

    return () => {
      cancelled = true;
    };
  }, [api, authLoading, userId]);

  const fetchCart = useCallback(async () => {
    if (!api || !userId) return;

    try {
      const next = await api.getCart();
      setOwnedCart({ userId, value: next });
      setOwnedError(null);
    } catch (caught) {
      setOwnedError({ userId, value: caught });
    }
  }, [api, userId]);

  /** Runs a mutation and adopts the server's authoritative cart on success. */
  const runMutation = useCallback(
    async (operation: (client: NonNullable<typeof api>) => Promise<Cart>) => {
      if (!api || !userId) return;

      setMutating(true);

      try {
        const next = await operation(api);
        setOwnedCart({ userId, value: next });
        setOwnedError(null);
      } catch (caught) {
        setOwnedError({ userId, value: caught });
      } finally {
        setMutating(false);
      }
    },
    [api, userId]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading: mutating || initialLoadPending,
      error,
      fetchCart,
      addItem: (input) => runMutation((client) => client.addItem(input)),
      setQuantity: (input) => runMutation((client) => client.setQuantity(input)),
      removeItem: (input) => runMutation((client) => client.removeItem(input)),
      clearCart: () => runMutation((client) => client.clearCart()),
    }),
    [cart, mutating, initialLoadPending, error, fetchCart, runMutation]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}