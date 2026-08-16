import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'cd_token';
const USER_KEY = 'cd_user';

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  phone?: string | null;
  role: string;
}

/**
 * Where the signed-in session lives between launches.
 *
 * SecureStore rather than AsyncStorage: the token authorises orders and shows
 * a person's address history, so it belongs in the keychain and the Android
 * keystore rather than in a plain file any other process on a rooted device
 * can read. The storefront keeps its token in localStorage because a browser
 * offers nothing better; a phone does.
 *
 * The user record is cached alongside it only so the app can render a name on
 * first paint instead of a spinner. It is never trusted for anything — the
 * server decides who you are on every request, and /auth/me refreshes it.
 */
export async function saveSession(token: string, user: SessionUser): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function readSession(): Promise<{ token: string; user: SessionUser } | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return null;

    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;

    return { token, user: JSON.parse(raw) as SessionUser };
  } catch {
    // A corrupt or unreadable entry is not worth crashing the launch over.
    // Treating it as signed-out costs one sign-in; throwing costs the app.
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined);
}
