import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const { signInWithGoogle, status, error, clearError } = useAuth();
  const theme = useTheme();

  const isAuthenticating = status === 'authenticating';

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>NORTH & FORM</ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>Sign In</ThemedText>

        <Pressable
          onPress={() => {
            clearError();
            void signInWithGoogle();
          }}
          disabled={isAuthenticating}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            isAuthenticating && styles.disabled,
            { backgroundColor: theme.text },
          ]}>
          {isAuthenticating ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText style={{ color: theme.background, fontWeight: '600' }}>
              Continue with Google
            </ThemedText>
          )}
        </Pressable>

        {isAuthenticating && (
          <ThemedText type="small">Waiting for Google…</ThemedText>
        )}

        {error && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.error}>
            {error}
          </ThemedText>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: Spacing.four,
  },
  title: {
    marginBottom: Spacing.two,
  },
  subtitle: {
    marginBottom: Spacing.six,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    borderRadius: Spacing.three,
    width: '100%',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    textAlign: 'center',
  },
});