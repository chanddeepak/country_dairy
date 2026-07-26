import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'country_dairy_admin_session';

// Demo seed accounts for local testing
export const DEMO_ACCOUNTS: UserProfile[] = [
  {
    id: 'usr-001',
    email: 'admin@countrydairy.in',
    fullName: 'Deepak Chand (Super Admin)',
    role: 'SUPER_ADMIN',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr-002',
    email: 'catalog@countrydairy.in',
    fullName: 'Ananya Sharma (Catalog Manager)',
    role: 'CATALOG_MANAGER',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr-003',
    email: 'orders@countrydairy.in',
    fullName: 'Rajesh Kumar (Order Manager)',
    role: 'ORDER_MANAGER',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr-004',
    email: 'driver@countrydairy.in',
    fullName: 'Vikram Singh (Local Delivery Driver)',
    role: 'DELIVERY_DRIVER',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

async function generateAdminJwtToken(userId: string, role: string, email: string): Promise<string> {
  try {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { sub: userId, role, email, iat: Math.floor(Date.now() / 1000) };

    const base64UrlEncode = (obj: any) => {
      const str = JSON.stringify(obj);
      return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    };

    const encodedHeader = base64UrlEncode(header);
    const encodedPayload = base64UrlEncode(payload);
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const secret = 'country-dairy-dev-secret-key-12345';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToSign));
    const signatureArray = Array.from(new Uint8Array(signature));
    const base64Signature = btoa(String.fromCharCode.apply(null, signatureArray))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${dataToSign}.${base64Signature}`;
  } catch (e) {
    console.warn('Crypto JWT generation failed fallback:', e);
    return 'demo-jwt-token';
  }
}

  // Restore stored session on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const { user: storedUser, timestamp } = JSON.parse(stored);
          const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
          if (!isExpired && storedUser && storedUser.isActive) {
            setUser(storedUser);
            const token = await generateAdminJwtToken(storedUser.id, storedUser.role, storedUser.email);
            localStorage.setItem('country_dairy_admin_token', token);
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            localStorage.removeItem('country_dairy_admin_token');
          }
        }
      } catch (e) {
        console.error('Failed to restore auth session:', e);
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  // Silent Token Refresh Simulation (every 55 minutes)
  useEffect(() => {
    if (!user) return;
    const refreshInterval = setInterval(async () => {
      const token = await generateAdminJwtToken(user.id, user.role, user.email);
      const sessionData = { user, token, timestamp: Date.now() };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
      localStorage.setItem('country_dairy_admin_token', token);
    }, 55 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [user]);

  const login = async (email: string, selectedRole: UserRole): Promise<boolean> => {
    setIsLoading(true);
    try {
      const found = DEMO_ACCOUNTS.find(a => a.email.toLowerCase() === email.toLowerCase()) || {
        id: `usr-${Date.now()}`,
        email,
        fullName: email.split('@')[0].toUpperCase(),
        role: selectedRole,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!found.isActive) {
        throw new Error('Account is deactivated. Contact Super Admin.');
      }

      const token = await generateAdminJwtToken(found.id, found.role, found.email);
      const sessionData = { user: found, token, timestamp: Date.now() };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
      localStorage.setItem('country_dairy_admin_token', token);
      setUser(found);
      return true;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('country_dairy_admin_token');
    setUser(null);
  };

  const hasPermission = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true; // Super Admin has access to everything
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    return user.role === requiredRole;
  };

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
