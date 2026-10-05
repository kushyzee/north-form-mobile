import { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

/**
 * OAuth redirect target. Fixed, not derived from `Linking.createURL()`.
 *
 * Must match `expo.scheme` in app.json, the `<data android:scheme>` intent
 * filter in the generated Android project, and the Supabase redirect allow-list.
 * `createURL()` interpolates `Constants.expoConfig.hostUri`, so with Metro
 * attached it yields a hostUri-prefixed URL that GoTrue silently discards —
 * falling back to the Site URL. See docs/phase-3-1.md.
 */
const AUTH_REDIRECT_URL = "northform://auth/callback";

const GENERIC_ERROR_MESSAGE = "Sign-in failed. Please try again.";

/**
 * Stages of the Google OAuth flow. Each has its own safe, user-facing message
 * so a failure is identifiable on device. These are only ever displayed — no
 * part of the OAuth exchange (codes, tokens, URLs) is logged.
 */
type AuthStage =
  | "authorize"
  | "auth-session"
  | "callback"
  | "exchange"
  | "abandoned";

const STAGE_MESSAGES: Record<AuthStage, string> = {
  authorize: "Could not start Google sign-in. Please try again.",
  "auth-session": "Google sign-in did not finish. Please try again.",
  callback: "Google sign-in did not return a valid response. Please try again.",
  exchange: "Could not complete Google sign-in. Please try again.",
  abandoned: "Google sign-in closed before finishing. Please try again.",
};

/** `Linking.parse` types query params as `string | string[] | undefined`. */
function readParam(
  params: Record<string, string | string[] | undefined> | null,
  key: string,
) {
  const value = params?.[key];
  return typeof value === "string" ? value : undefined;
}

type AuthStatus = "idle" | "authenticating";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  status: AuthStatus;
  error: string | null;
  clearError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    // Read the persisted session once, then subscribe to auth events. Subscribing
    // after the initial read means a slow `getSession()` resolution can never
    // overwrite newer event-driven state.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        // Never leave the app stuck loading if the stored session is unreadable.
        if (cancelled) return;
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
        });
        unsubscribe = () => subscription.unsubscribe();
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (status === "authenticating") return;

    setStatus("authenticating");
    setError(null);

    try {
      const redirectTo = AUTH_REDIRECT_URL;

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError || !data.url) throw new Error(STAGE_MESSAGES.authorize);

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      // The Android polyfill also resolves `dismiss`/`cancel` when the browser
      // closes without the redirect matching, so this is a real failure to
      // report rather than a silent no-op.
      if (result.type === "cancel" || result.type === "dismiss") {
        throw new Error(STAGE_MESSAGES.abandoned);
      }

      if (result.type !== "success")
        throw new Error(STAGE_MESSAGES["auth-session"]);

      const queryParams = Linking.parse(result.url).queryParams;

      // The provider can redirect back with an error instead of a code.
      const providerError = readParam(queryParams, "error");
      if (providerError) {
        throw new Error(
          readParam(queryParams, "error_description") ||
            "Google sign-in was not completed.",
        );
      }

      // PKCE delivers the authorization code in the query string.
      const code = readParam(queryParams, "code");
      if (!code) throw new Error(STAGE_MESSAGES.callback);

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw new Error(STAGE_MESSAGES.exchange);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : GENERIC_ERROR_MESSAGE,
      );
    } finally {
      setStatus("idle");
    }
  }, [status]);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not sign out. Please try again.",
      );
    } finally {
      setStatus("idle");
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        status,
        error,
        clearError,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
