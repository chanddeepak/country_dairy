'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { loginPhone, setLoginPhone, sendOtp, verifyOtp } = useApp();
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await sendOtp(loginPhone);
    if (success) {
      setOtpSent(true);
    } else {
      setError('Failed to send OTP. Please try again.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await verifyOtp(otpCode);
    if (success) {
      onClose();
      setOtpSent(false);
      setOtpCode('');
    } else {
      setError('Invalid OTP code. Please use: 123456');
    }
  };

  const handleClose = () => {
    onClose();
    setOtpSent(false);
    setOtpCode('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white max-w-sm w-full p-8 rounded-2xl shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="font-serif font-black text-2xl text-[#2A2A2A] mb-2">Welcome Back</h3>
        <p className="text-xs text-[#6b6661] mb-6">
          Enter your mobile number to retrieve your wallet balance & catalog.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-bold mb-4">
            {error}
          </div>
        )}

        {!otpSent ? (
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
            <button
              type="submit"
              className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3 rounded-xl transition"
            >
              Request OTP
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#2A2A2A] block mb-1">6-digit Verification Code:</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="e.g. 123456"
                maxLength={6}
                className="w-full bg-[#FAF8F3] border border-stone-300 px-4 py-3 rounded-xl text-[#2A2A2A] placeholder-stone-400 focus:outline-none focus:border-[#3A6038] text-center tracking-[0.5em] font-black transition"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#3A6038] hover:bg-[#2d4d2b] text-white font-bold py-3 rounded-xl transition"
            >
              Verify Code
            </button>
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-[10px] text-center font-bold">
              Development Code: <strong>123456</strong>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
