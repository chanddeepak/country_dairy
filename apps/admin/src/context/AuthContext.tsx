import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, UserRole } from '../types';
import { adminApi, clearAdminToken, setAdminToken } from '../services/apiClient';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'country_dairy_admin_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearAdminToken();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  /**
   * Revalidates the stored token against the API on load. The session is only
   * as good as what the server says right now — a deactivated account or a
   * revoked token must not survive in localStorage.
   */
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const profile = await adminApi.getCurrentUser();
        if (!cancelled) {
          setUser(profile);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
        }
      } catch {
        if (!cancelled) {
          clearAdminToken();
          localStorage.removeItem(USER_STORAGE_KEY);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // The API verifies the password and signs the token. The console used to
      // accept any email and mint its own JWT in the browser.
      const { accessToken, user: profile } = await adminApi.login(email, password);
      setAdminToken(accessToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Roles are enforced server-side; this only decides what the UI offers.
  const hasPermission = useCallback(
    (requiredRole: UserRole | UserRole[]): boolean => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true;

      return Array.isArray(requiredRole)
        ? requiredRole.includes(user.role)
        : user.role === requiredRole;
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
