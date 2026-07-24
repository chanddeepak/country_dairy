import React, { useState } from 'react';
import { useAuth, DEMO_ACCOUNTS } from '../context/AuthContext';
import type { UserRole } from '../types';
import { Lock, Mail, Shield, Sparkles, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@countrydairy.in');
  const [password, setPassword] = useState('password123');
  const [selectedRole, setSelectedRole] = useState<UserRole>('SUPER_ADMIN');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const success = await login(email, selectedRole);
      if (!success) {
        setErrorMessage('Invalid credentials or account deactivated.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillQuickDemo = (demo: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(demo.email);
    setSelectedRole(demo.role);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F3] p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background Decorative Blur Circles */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#064e3b]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#C59B27]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-stone-200/60 relative z-10 space-y-7">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#064e3b] text-[#C59B27] font-black text-2xl shadow-lg shadow-[#064e3b]/20 border-2 border-[#C59B27]/30 mb-1">
            🐄
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#C59B27] bg-[#C59B27]/10 px-3 py-1 rounded-full border border-[#C59B27]/20">
              Direct Farm Fresh D2C
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#2A2A2A] tracking-tight mt-2">
              Country Dairy Admin
            </h1>
            <p className="text-xs text-[#6b6661] mt-1">
              Sign in to manage catalog, dispatches & farm logistics
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl text-center font-medium shadow-sm flex items-center justify-center gap-2">
            <span>⚠️</span> {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#2A2A2A] mb-1.5 uppercase tracking-wider">
              Work Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6661]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#FAF8F3] border border-stone-200 rounded-xl text-xs text-[#2A2A2A] font-medium focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b] transition-all"
                placeholder="name@countrydairy.in"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2A2A2A] mb-1.5 uppercase tracking-wider">
              Security Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6661]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#FAF8F3] border border-stone-200 rounded-xl text-xs text-[#2A2A2A] font-medium focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b] transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2A2A2A] mb-1.5 uppercase tracking-wider">
              Target Role Scope
            </label>
            <div className="relative">
              <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#064e3b]" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full pl-10 pr-4 py-3 bg-[#FAF8F3] border border-stone-200 rounded-xl text-xs text-[#2A2A2A] font-bold focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b] transition-all appearance-none cursor-pointer"
              >
                <option value="SUPER_ADMIN">👑 Super Admin (Full Root Access)</option>
                <option value="CATALOG_MANAGER">📦 Catalog Manager (Products & Banners)</option>
                <option value="ORDER_MANAGER">🚚 Order Manager (Orders & Courier)</option>
                <option value="DELIVERY_DRIVER">🛵 Delivery Driver (Local Deliveries)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-[#064e3b] hover:bg-[#065f46] text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-[#064e3b]/20 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Admin Console'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Demo Shortcuts */}
        <div className="pt-5 border-t border-stone-100 space-y-3">
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#6b6661] uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-[#C59B27]" />
            <span>Quick Login Presets (Development):</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => fillQuickDemo(acc)}
                className="p-2.5 text-left bg-[#FAF8F3] hover:bg-[#064e3b]/5 border border-stone-200/80 rounded-xl transition-all hover:border-[#064e3b]/30 group"
              >
                <div className="text-[10px] font-extrabold text-[#064e3b] uppercase tracking-wide group-hover:text-[#C59B27]">
                  {acc.role.replace('_', ' ')}
                </div>
                <div className="text-[10px] text-[#6b6661] truncate mt-0.5 font-medium">
                  {acc.email}
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
