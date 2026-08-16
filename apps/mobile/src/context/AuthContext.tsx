import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, request, type RequestOptions } from '../lib/api';
import { clearSession, readSession, saveSession, type SessionUser } from '../lib/session';

interface AuthValue {
  user: SessionUser | null;
  /** False until the stored session has been read, so nothing flashes. */
  isReady: boolean;
  /** Set when a token was rejected, to explain why they were signed out. */
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Authenticated request. Signs out and throws on a rejected token. */
  authRequest: <T>(path: string, options?: Omit<RequestOptions, 'token'>) => Promise<T>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Who is signed in.
 *
 * The session is restored before the first screen renders rather than after,
 * so a returning customer does not see a signed-out home screen blink into a
 * signed-in one — which reads as the app having forgotten them.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await readSession();
      if (cancelled) return;

      if (stored) {
        setToken(stored.token);
        setUser(stored.user);

        // Confirm the token is still good, in the background. The cached user
        // is enough to render with; this is what catches a password change or
        // a closed account on another device.
        try {
          const fresh = await request<SessionUser>('/auth/me', { token: stored.token });
          if (!cancelled) {
            setUser(fresh);
            await saveSession(stored.token, fresh);
          }
        } catch (err) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            await clearSession();
            if (!cancelled) {
              setToken(null);
              setUser(null);
              setSessionExpired(true);
            }
          }
          // Any other failure is the network, not the token. Staying signed in
          // offline is the whole point of caching the session.
        }
      }

      if (!cancelled) setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback(async (result: { accessToken: string; user: SessionUser }) => {
    await saveSession(result.accessToken, result.user);
    setToken(result.accessToken);
    setUser(result.user);
    setSessionExpired(false);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await request<{ accessToken: string; user: SessionUser }>(
        '/auth/email/login',
        { method: 'POST', body: { email: email.trim().toLowerCase(), password } },
      );
      await adopt(result);
    },
    [adopt],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await request<{ accessToken: string; user: SessionUser }>(
        '/auth/email/register',
        {
          method: 'POST',
          body: { name: name.trim(), email: email.trim().toLowerCase(), password },
        },
      );
      await adopt(result);
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    await clearSession();
    setToken(null);
    setUser(null);
    setSessionExpired(false);
  }, []);

  const authRequest = useCallback(
    async <T,>(path: string, options: Omit<RequestOptions, 'token'> = {}): Promise<T> => {
      if (!token) throw new ApiError('You are not signed in.', 401);

      try {
        return await request<T>(path, { ...options, token });
      } catch (err) {
        // A rejected token means the session is over. Ending it here rather
        // than letting every screen handle a 401 keeps the app from sitting
        // in a state where nothing works and nothing explains why.
        if (err instanceof ApiError && err.status === 401) {
          await clearSession();
          setToken(null);
          setUser(null);
          setSessionExpired(true);
        }
        throw err;
      }
    },
    [token],
  );

  const value = useMemo(
    () => ({ user, isReady, sessionExpired, signIn, register, signOut, authRequest }),
    [user, isReady, sessionExpired, signIn, register, signOut, authRequest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
