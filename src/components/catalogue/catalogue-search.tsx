import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Catalogue search box.
 *
 * Typing updates local state only. The parent decides when the term is applied
 * (it debounces), so this component neither fetches nor knows about the API.
 * Submitting from the keyboard applies the term immediately, which is what a
 * shopper pressing "return" expects and which the debounce must not swallow.
 */
export function CatalogueSearch({
  value,
  appliedValue,
  onChange,
  onSubmit,
  onClear,
}: {
  value: string;
  /** The term the list is currently showing, used to label the clear control. */
  appliedValue: string | undefined;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.backgroundElement,
            // A visible focus ring, so keyboard users can see where they are.
            borderColor: focused ? theme.text : 'transparent',
          },
        ]}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={15}
          tintColor={theme.textSecondary}
        />

        <TextInput
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search the catalogue"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          accessibilityLabel="Search products"
          // The visible placeholder is not a substitute for a label on a text
          // input, so it carries both.
          style={[styles.input, { color: theme.text }]}
        />

        {value.length > 0 && (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => pressed && styles.pressed}>
            <SymbolView
              name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
              size={16}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        )}
      </View>

      {/* Announce the applied term so the state is not voice-only. */}
      {appliedValue !== undefined && (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          Showing results for “{appliedValue}”
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    // Without this the field collapses on Android when empty.
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});