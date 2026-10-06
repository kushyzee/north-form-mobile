import { SymbolView } from 'expo-symbols';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * A lightweight, non-blocking toast.
 *
 * ## Why not `Alert`
 *
 * The first cut of the product screen used `Alert.alert` for the add-to-cart
 * confirmation. It works, but it is **modal**: the shopper cannot keep browsing,
 * scroll, or press "add again" until they dismiss it, and a dismissal is an
 * extra tap between wanting something and having it. For a confirmation that
 * merely acknowledges an action already completed, a toast is the right weight.
 *
 * ## Why no toast library
 *
 * The project's rule is to avoid a dependency when the existing stack can do the
 * job, and `react-native-reanimated` is already a direct dependency used for
 * exactly this kind of enter/exit work (`AnimatedSplashOverlay`, `Collapsible`).
 * The whole thing is a provider, a timer and two keyframes — adding a library for
 * that would be more code to audit than code to write.
 *
 * Mounted once in `src/app/_layout.tsx`, **outside** the navigator, so a single
 * toast can be raised from any screen and always overlays both the tabs and
 * pushed stack screens.
 */

/** How long the toast stays up before dismissing itself. */
const TOAST_DURATION_MS = 2600;

const ENTER = FadeInDown.duration(220);
const EXIT = FadeOutDown.duration(180);

type Toast = {
  /** Monotonic id, so an identical repeated message still replays. */
  id: number;
  message: string;
};

type ToastContextValue = {
  /** Shows `message` and schedules its own dismissal. */
  show: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string) => {
    nextId.current += 1;
    setToast({ id: nextId.current, message });
  }, []);

  /**
   * One timer per raised toast.
   *
   * `toast` is the dependency rather than a bare flag, so raising a second
   * message while the first is still up restarts the countdown instead of
   * inheriting the remaining time — otherwise a rapid second add could vanish
   * before it was read.
   */
  useEffect(() => {
    if (toast === null) return;

    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Rendered last so it paints above the navigator. */}
      {toast !== null && <ToastBody key={toast.id} message={toast.message} />}
    </ToastContext.Provider>
  );
}

function ToastBody({ message }: { message: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      // The toast sits above every screen and is never interactive: it must not
      // swallow a tap meant for the page underneath, and a shopper should not
      // have to dismiss it to keep shopping.
      pointerEvents="none"
      style={[
        styles.layer,
        // `BottomTabInset` is applied unconditionally so the toast clears the
        // tab bar on tab screens and merely sits a little higher on a pushed
        // screen. A toast clipped by the screen edge would be worse.
        { paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
      ]}>
      <Animated.View
        entering={ENTER}
        exiting={EXIT}
        // Announced without stealing focus, so a screen reader user learns the
        // item was added but is not interrupted mid-sentence elsewhere.
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={message}
        style={[styles.toast, { backgroundColor: theme.text }]}>
        <SymbolView
          name={{
            ios: 'checkmark.circle.fill',
            android: 'check_circle',
            web: 'check_circle',
          }}
          size={17}
          // Inverted against the toast's own background, so it stays legible in
          // both colour schemes without hardcoding a colour.
          tintColor={theme.background}
        />

        <ThemedText type="small" themeColor="background" style={styles.message}>
          {message}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    // Above the navigator's own stacking; nothing in the app is higher.
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  message: {
    flexShrink: 1,
  },
});