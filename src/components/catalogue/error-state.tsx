import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shown when a catalogue request failed.
 *
 * The message arrives already customer-safe: the screen passes
 * `toUserMessage(error)`, which prefers the server's own copy and falls back to
 * a status-appropriate generic line. Raw errors, URLs and server text never
 * reach this component, so there is nothing to strip here.
 *
 * Nothing is logged. A failed catalogue read is not an app fault to report, and
 * the message shown is the whole of the diagnosis a shopper needs.
 */
export function CatalogueErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={styles.container}
      // Announced when it appears, so a screen reader user is told the list
      // failed rather than being left on an apparently empty screen.
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={`Could not load the catalogue. ${message}`}>
      <SymbolView
        name={{ ios: 'wifi.exclamationmark', android: 'wifi_off', web: 'error' }}
        size={28}
        tintColor={theme.textSecondary}
      />

      <ThemedText type="smallBold" style={styles.centered}>
        Could not load the catalogue
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {message}
      </ThemedText>

      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading the catalogue"
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold">Try again</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centered: {
    textAlign: 'center',
  },
  action: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    marginTop: Spacing.one,
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});