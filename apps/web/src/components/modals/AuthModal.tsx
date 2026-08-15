'use client';

import React, { useState, useEffect } from 'react';
import { X, Smartphone, Mail, Globe, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useStoreConfig } from '../../context/StoreConfigContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { loginPhone, setLoginPhone, sendOtp, verifyOtp, loginWithEmail, registerWithEmail, loginWithGoogle, isLoading } = useApp();
  const { isFlagOn } = useStoreConfig();

  // Only offer methods that are actually switched on. Mobile used to be the
  // default tab while OTP was disabled, so the modal opened on the one method
  // guaranteed to fail with a 403.
  const methods = {
    mobile: isFlagOn('ENABLE_OTP_LOGIN'),
    email: true,
    google: isFlagOn('ENABLE_GOOGLE_LOGIN'),
  };
  const enabledMethods = (Object.keys(methods) as ('mobile' | 'email' | 'google')[]).filter(
    (m) => methods[m],
  );

  const [activeTab, setActiveTab] = useState<'mobile' | 'email' | 'google'>('email');

  // If the flags change, never leave the modal on a disabled method.
  useEffect(() => {
    if (!methods[activeTab] && enabledMethods.length > 0) {
      setActiveTab(enabledMethods[0]);
    }
  }, [methods.mobile, methods.google, activeTab]);
  
  // Mobile states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  
  // Email states
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [error, setError] = useState('');

  // Handle Google GIS initialization
  useEffect(() => {
    if (isOpen && activeTab === 'google') {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) return;

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);

      script.onload = () => {
        if ((window as any).google) {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse,
          });
          (window as any).google.accounts.id.renderButton(
            document.getElementById('googleSignInBtn')!,
            { theme: 'outline', size: 'large', width: 300 }
          );
        }
      };

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleGoogleResponse = async (response: any) => {
    setError('');
    const success = await loginWithGoogle(response.credential);
    if (success) {
      handleClose();
    } else {
      setError('Google Sign-In failed.');
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await sendOtp(loginPhone);
    if (success) setOtpSent(true);
    else setError('Failed to send OTP. Please try again.');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await verifyOtp(otpCode);
    if (success) handleClose();
    else setError('Invalid OTP code. Please use: 123456');
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    let success = false;
    if (isRegistering) {
      success = await registerWithEmail(email, password, name);
    } else {
      success = await loginWithEmail(email, password);
    }
    
    if (success) handleClose();
    else setError(isRegistering ? 'Registration failed. Email might exist.' : 'Invalid email or password.');
  };

  const handleClose = () => {
    onClose();
    setOtpSent(false);
    setOtpCode('');
    setEmail('');
    setPassword('');
    setName('');
    setError('');
    setActiveTab('mobile');
  };

  return (
    <div data-testid="auth-modal" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white max-w-sm w-full p-8 rounded-2xl shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="font-serif font-black text-2xl text-[#2A2A2A] mb-2">Welcome</h3>
        <p className="text-xs text-[#6b6661] mb-6">
          Sign in to track your orders and check out faster.
        </p>

        {/* Tabs — hidden when only one sign-in method is enabled. */}
        {enabledMethods.length > 1 && (
        <div className="flex bg-stone-100 p-1 rounded-xl mb-6">
          {methods.mobile && (
          <button 
            onClick={() => setActiveTab('mobile')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center transition ${activeTab === 'mobile' ? 'bg-white shadow text-[#2A2A2A]' : 'text-[#6b6661]'}`}
          >
            <Smartphone className="w-4 h-4 mr-1" /> Mobile
          </button>
          )}
          <button 
            onClick={() => setActiveTab('email')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center transition ${activeTab === 'email' ? 'bg-white shadow text-[#2A2A2A]' : 'text-[#6b6661]'}`}
          >
            <Mail className="w-4 h-4 mr-1" /> Email
          </button>
          {methods.google && (
          <button 
            onClick={() => setActiveTab('google')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center transition ${activeTab === 'google' ? 'bg-white shadow text-[#2A2A2A]' : 'text-[#6b6661]'}`}
          >
            <Globe className="w-4 h-4 mr-1" /> Google
          </button>
          )}
        </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-bold mb-4">
            {error}
          </div>
        )}

        {/* MOBILE TAB */}
        {activeTab === 'mobile' && (
          !otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#2A2A2A] block mb-1">Mobile Number:</label>
                <input
                  type="tel"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full bg-[#FAF8F3] border border-stone-300 px-4 py-3 rounded-xl text-[#2A2A2A] placeholder-stone-400 focus:outline-none focus:border-[#3A6038] transition"
                />
              </div>
              <button type="submit" className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3 rounded-xl transition">
                Request OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#2A2A2A] block mb-1">6-digit Code:</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="e.g. 123456"
                  maxLength={6}
                  className="w-full bg-[#FAF8F3] border border-stone-300 px-4 py-3 rounded-xl text-[#2A2A2A] focus:outline-none focus:border-[#3A6038] text-center tracking-[0.5em] font-black transition"
                />
              </div>
              <button type="submit" className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3 rounded-xl transition">
                Verify Code
              </button>
              <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-[10px] text-center font-bold">
                Development Code: <strong>123456</strong>
              </div>
            </form>
          )
        )}

        {/* EMAIL TAB */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="text-xs font-bold text-[#2A2A2A] block mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="signup-name"
                  placeholder="Amit Sharma"
                  className="w-full bg-[#FAF8F3] border border-stone-300 px-4 py-3 rounded-xl text-[#2A2A2A] placeholder-stone-400 focus:outline-none focus:border-[#3A6038] transition"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-[#2A2A2A] block mb-1">Email Address:</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-[#FAF8F3] border border-stone-300 px-4 py-3 rounded-xl text-[#2A2A2A] placeholder-stone-400 focus:outline-none focus:border-[#3A6038] transition"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#2A2A2A] block mb-1">Password:</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#FAF8F3] border border-stone-300 px-4 py-3 rounded-xl text-[#2A2A2A] placeholder-stone-400 focus:outline-none focus:border-[#3A6038] transition"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Please wait…' : isRegistering ? 'Create Account' : 'Sign In'}
            </button>
            <div className="text-center pt-2">
              <button 
                type="button" 
                onClick={() => setIsRegistering(!isRegistering)}
                data-testid="toggle-register"
                className="text-xs text-[#C59B27] font-bold hover:underline"
              >
                {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Register"}
              </button>
            </div>
          </form>
        )}

        {/* GOOGLE TAB */}
        {activeTab === 'google' && (
          <div className="flex flex-col items-center justify-center py-6 min-h-[160px]">
            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
              <div id="googleSignInBtn"></div>
            ) : (
              <div className="text-center space-y-3">
                <Globe className="w-10 h-10 text-stone-300 mx-auto" />
                <p className="text-sm font-bold text-stone-500">Google Sign-In Coming Soon</p>
                <p className="text-xs text-stone-400">Client ID needs to be configured in .env</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
