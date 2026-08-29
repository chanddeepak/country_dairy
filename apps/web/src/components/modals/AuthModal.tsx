'use client';

import React, { useState, useEffect } from 'react';
import { X, Smartphone, Mail, Globe, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useStoreConfig } from '../../context/StoreConfigContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** How long before a new code can be requested. */
const RESEND_SECONDS = 30;

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { loginPhone, setLoginPhone, sendOtp, verifyOtp, loginWithEmail, registerWithEmail, loginWithGoogle, isLoading } = useApp();
  const { isFlagOn } = useStoreConfig();

  // Only offer methods that are actually switched on. Mobile is the default
  // way in now; the effect below moves off it while ENABLE_OTP_LOGIN is still
  // off, so the modal never opens on a method guaranteed to fail with a 403.
  const methods = {
    mobile: isFlagOn('ENABLE_OTP_LOGIN'),
    email: isFlagOn('ENABLE_EMAIL_LOGIN'),
    google: isFlagOn('ENABLE_GOOGLE_LOGIN'),
  };
  const enabledMethods = (Object.keys(methods) as ('mobile' | 'email' | 'google')[]).filter(
    (m) => methods[m],
  );

  const [activeTab, setActiveTab] = useState<'mobile' | 'email' | 'google'>('mobile');

  // If the flags change, never leave the modal on a disabled method.
  useEffect(() => {
    if (!methods[activeTab] && enabledMethods.length > 0) {
      setActiveTab(enabledMethods[0]);
    }
  }, [methods.mobile, methods.email, methods.google, activeTab]);
  
  // Mobile states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  /*
   * Sending takes about 700ms — three rate-limit counts, a bcrypt hash and an
   * insert, against a database in Singapore. That is real work rather than a
   * bug, but with no feedback the button looks dead and people press it again.
   */
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Ticks the resend countdown down to zero, then stops.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  
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
    if (sending) return;
    setError('');
    setSending(true);
    try {
      const success = await sendOtp(loginPhone);
      if (success) {
        setOtpSent(true);
        setResendIn(RESEND_SECONDS);
      } else {
        setError('We could not send a code to that number. Check it and try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifying) return;
    setError('');
    setVerifying(true);
    try {
      const success = await verifyOtp(otpCode);
      if (success) handleClose();
      else setError('That code was not right. Check the message, or request a new code.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || sending) return;
    setError('');
    setOtpCode('');
    setSending(true);
    try {
      const success = await sendOtp(loginPhone);
      if (success) setResendIn(RESEND_SECONDS);
      else setError('We could not send another code just yet. Please wait a moment.');
    } finally {
      setSending(false);
    }
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
    setSending(false);
    setVerifying(false);
    setResendIn(0);
    setEmail('');
    setPassword('');
    setName('');
    setError('');
    setActiveTab('mobile');
  };

  return (
    <div data-testid="auth-modal" className="fixed inset-0 z-50 bg-[rgb(var(--ink-rgb)/0.55)] backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full p-8 rounded-sm shadow-2xl relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-[var(--ink-soft)] hover:text-[var(--ink)] transition"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="font-serif font-light text-2xl text-[var(--ink)] mb-2">Welcome</h3>
        <p className="text-xs text-[var(--ink-soft)] mb-6">
          Sign in to track your orders and check out faster.
        </p>

        {/* Tabs — hidden when only one sign-in method is enabled. */}
        {enabledMethods.length > 1 && (
        <div className="flex bg-[var(--cream)] p-1 rounded-sm mb-6">
          {methods.mobile && (
          <button 
            onClick={() => setActiveTab('mobile')}
            className={`flex-1 py-2 text-xs font-bold rounded-sm flex items-center justify-center transition ${activeTab === 'mobile' ? 'bg-white shadow text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}
          >
            <Smartphone className="w-4 h-4 mr-1" /> Mobile
          </button>
          )}
          {methods.email && (
          <button 
            onClick={() => setActiveTab('email')}
            className={`flex-1 py-2 text-xs font-bold rounded-sm flex items-center justify-center transition ${activeTab === 'email' ? 'bg-white shadow text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}
          >
            <Mail className="w-4 h-4 mr-1" /> Email
          </button>
          )}
          {methods.google && (
          <button 
            onClick={() => setActiveTab('google')}
            className={`flex-1 py-2 text-xs font-bold rounded-sm flex items-center justify-center transition ${activeTab === 'google' ? 'bg-white shadow text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}
          >
            <Globe className="w-4 h-4 mr-1" /> Google
          </button>
          )}
        </div>
        )}

        {error && (
          <div className="bg-[var(--danger-bg)] text-[var(--danger)] p-3 rounded-sm text-xs font-bold mb-4">
            {error}
          </div>
        )}

        {/* MOBILE TAB */}
        {activeTab === 'mobile' && (
          !otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[var(--ink)] block mb-1">Mobile Number:</label>
                <input
                  type="tel"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full bg-[var(--ivory)] border border-[var(--line)] px-4 py-3 rounded-sm text-[var(--ink)] placeholder-[var(--ink-soft)] focus:outline-none focus:border-[var(--forest)] transition"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold py-3 rounded-sm transition disabled:opacity-60"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                {sending ? 'Sending code…' : 'Request OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[var(--ink)] block mb-1">6-digit Code:</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="······"
                  maxLength={6}
                  className="w-full bg-[var(--ivory)] border border-[var(--line)] px-4 py-3 rounded-sm text-[var(--ink)] focus:outline-none focus:border-[var(--forest)] text-center tracking-[0.5em] font-black transition"
                />
              </div>
              <button
                type="submit"
                disabled={verifying || otpCode.length < 6}
                className="flex w-full items-center justify-center gap-2 bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold py-3 rounded-sm transition disabled:opacity-60"
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifying ? 'Verifying…' : 'Verify Code'}
              </button>

              <p className="text-center text-[11px] text-[var(--ink-soft)]">
                {resendIn > 0 ? (
                  `Resend code in ${resendIn}s`
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={sending}
                    className="font-bold text-[var(--forest)] underline underline-offset-2 disabled:opacity-60"
                  >
                    {sending ? 'Sending…' : 'Resend code'}
                  </button>
                )}
              </p>
            </form>
          )
        )}

        {/* EMAIL TAB */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="text-xs font-bold text-[var(--ink)] block mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="signup-name"
                  placeholder="Amit Sharma"
                  className="w-full bg-[var(--ivory)] border border-[var(--line)] px-4 py-3 rounded-sm text-[var(--ink)] placeholder-[var(--ink-soft)] focus:outline-none focus:border-[var(--forest)] transition"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-[var(--ink)] block mb-1">Email Address:</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-[var(--ivory)] border border-[var(--line)] px-4 py-3 rounded-sm text-[var(--ink)] placeholder-[var(--ink-soft)] focus:outline-none focus:border-[var(--forest)] transition"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--ink)] block mb-1">Password:</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[var(--ivory)] border border-[var(--line)] px-4 py-3 rounded-sm text-[var(--ink)] placeholder-[var(--ink-soft)] focus:outline-none focus:border-[var(--forest)] transition"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[var(--forest)] hover:bg-[var(--pine)] text-white font-bold py-3 rounded-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Please wait…' : isRegistering ? 'Create Account' : 'Sign In'}
            </button>
            <div className="text-center pt-2">
              <button 
                type="button" 
                onClick={() => setIsRegistering(!isRegistering)}
                data-testid="toggle-register"
                className="text-xs text-[var(--brass-text)] font-bold hover:underline"
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
                <Globe className="w-10 h-10 text-[var(--line)] mx-auto" />
                <p className="text-sm font-bold text-[var(--ink-soft)]">Google Sign-In Coming Soon</p>
                <p className="text-xs text-[var(--ink-soft)]">Client ID needs to be configured in .env</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
