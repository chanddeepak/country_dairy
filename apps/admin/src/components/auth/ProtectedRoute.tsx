import React from 'react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-900 text-amber-400">
        <div className="animate-spin text-3xl">⌛</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Handled at App level by rendering Login component
    return null;
  }

  if (requiredRole && !hasPermission(requiredRole)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-stone-900 text-stone-100 rounded-2xl border border-stone-800 m-6">
        <div className="text-5xl mb-4">🛡️</div>
        <h2 className="text-2xl font-bold text-red-400 mb-2">403 — Access Restricted</h2>
        <p className="text-sm text-stone-400 max-w-md mb-6">
          Your account role (<span className="text-amber-400 font-mono font-bold">{user.role}</span>) does not have authorization to view this module.
        </p>
        <div className="text-xs text-stone-500 bg-stone-800 p-3 rounded-lg border border-stone-700">
          Required Permission Scope: <code className="text-stone-300">{Array.isArray(requiredRole) ? requiredRole.join(', ') : requiredRole}</code>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
