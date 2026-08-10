import React from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
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
      <div className="min-h-[40vh] flex items-center justify-center gap-2 text-xs text-[#6b6661]">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your access…
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Handled at App level by rendering Login component
    return null;
  }

  if (requiredRole && !hasPermission(requiredRole)) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-stone-200/80 shadow-sm text-center">
        <ShieldAlert className="h-8 w-8 text-stone-300 mx-auto mb-3" />
        <h2 className="text-sm font-bold text-[#2A2A2A] mb-1">You cannot open this page</h2>
        <p className="text-xs text-[#6b6661] max-w-md mx-auto mb-4">
          Your role is{' '}
          <span className="font-mono font-bold text-[#2A2A2A]">{user.role}</span>. Ask
          a Super Admin if you need access.
        </p>
        <code className="inline-block text-[11px] font-mono text-[#6b6661] bg-[#FAF8F3] border border-stone-200 rounded-lg px-3 py-2">
          Needs: {Array.isArray(requiredRole) ? requiredRole.join(', ') : requiredRole}
        </code>
      </div>
    );
  }

  return <>{children}</>;
}
