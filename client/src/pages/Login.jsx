import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Phone, Lock, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

const Login = () => {
  const navigate = useNavigate();
  const { setSession, setUser } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpInputsRef = useRef([]);

  // Handle Resend OTP Countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10 || !/^[6-9]\d{9}$/.test(phoneNumber)) {
      toast.error('Please enter a valid 10-digit Indian mobile number (starts with 6-9).');
      return;
    }

    setLoading(true);

    try {
      // Trigger OTP sending through our backend API
      const res = await api.post('/api/auth/send-otp', { mobile: phoneNumber });
      if (res.data.success) {
        toast.success(`OTP sent successfully to +91 ${phoneNumber}`);
        setStep('otp');
        setCountdown(30); // 30 second countdown
        setOtp(['', '', '', '', '', '']);
        // Focus first OTP field after state updates
        setTimeout(() => {
          if (otpInputsRef.current[0]) otpInputsRef.current[0].focus();
        }, 100);
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      const errMsg = error.response?.data?.error || error.message || 'Failed to send OTP.';
      toast.error(errMsg);
      
      // Simulate for local development if credentials not fully supplied in .env
      if (import.meta.env.DEV) {
        toast.custom((t) => (
          <div className="bg-brand-dark text-white px-4 py-3 rounded-card shadow-premium border border-brand-primary flex flex-col space-y-1">
            <span className="font-bold text-xs uppercase tracking-wider text-brand-secondary">Dev Helper Mode</span>
            <span className="text-xs">OTP sign-in simulated for testing.</span>
          </div>
        ));
        setStep('otp');
        setCountdown(30);
        setTimeout(() => {
          if (otpInputsRef.current[0]) otpInputsRef.current[0].focus();
        }, 100);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length < 6 || !/^\d{6}$/.test(otpCode)) {
      toast.error('Please enter a valid 6-digit OTP code.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/api/auth/verify-otp', {
        mobile: phoneNumber,
        otp: otpCode
      });

      const { session, user } = res.data;

      // Set session in Supabase client
      const { error: supabaseErr } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (supabaseErr) throw supabaseErr;

      // Store in authStore
      setSession(session);
      setUser(user);

      toast.success('Successfully authenticated!');
      
      if (!user.onboarding_completed) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      const errMsg = error.response?.data?.error || error.message || 'Invalid or expired OTP.';
      toast.error(errMsg);

      // Simulate bypass in dev sandbox for prototype validation
      if (import.meta.env.DEV) {
        toast.success('Simulated dev bypass successful!');
        // Locally fake trigger auth state using a placeholder session
        const fakeSession = { access_token: 'fake', refresh_token: 'fake' };
        setSession(fakeSession);
        setUser({
          id: '00000000-0000-0000-0000-000000000000',
          mobile: phoneNumber,
          name: null,
          language: 'hi',
          user_type: null,
          onboarding_completed: false,
          upi_id: null
        });
        navigate('/onboarding');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit OTP when fully filled
  useEffect(() => {
    const otpCode = otp.join('');
    if (otpCode.length === 6 && /^\d{6}$/.test(otpCode)) {
      handleVerifyOtp();
    }
  }, [otp]);

  // Handle OTP digit changes
  const handleOtpChange = (index, value) => {
    // Only allow digits
    const cleanedVal = value.replace(/\D/g, '');
    if (!cleanedVal) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    const digits = cleanedVal.split('');
    const newOtp = [...otp];
    
    // Paste/entry logic
    for (let i = 0; i < digits.length; i++) {
      if (index + i < 6) {
        newOtp[index + i] = digits[i];
      }
    }
    setOtp(newOtp);

    // Auto-advance cursor
    const nextIndex = Math.min(index + digits.length, 5);
    if (otpInputsRef.current[nextIndex]) {
      otpInputsRef.current[nextIndex].focus();
    }
  };

  // Handle Backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        if (otpInputsRef.current[index - 1]) {
          otpInputsRef.current[index - 1].focus();
        }
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-brand-bg relative overflow-hidden px-4">
      {/* Decorative Blurry Orbs */}
      <div className="absolute w-96 h-96 -top-20 -left-20 rounded-full bg-brand-primary/10 blur-3xl" />
      <div className="absolute w-96 h-96 -bottom-20 -right-20 rounded-full bg-brand-secondary/10 blur-3xl" />

      <div className="max-w-md w-full glass-panel rounded-card shadow-premium p-8 relative z-10 border border-slate-200/40">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="gradient-primary w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-brand-dark tracking-tight">SafeKosh</h1>
          <p className="text-sm text-brand-textMuted mt-1.5">
            Decentralized savings, chit funds & credit registry
          </p>
        </div>

        {/* Step 1: Input Phone Number */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-6 animate-fadeIn">
            <div>
              <label className="block text-sm font-bold text-brand-dark mb-2">
                Apna mobile number dalein
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 font-bold text-base">
                  +91
                </div>
                <input
                  type="tel"
                  required
                  placeholder="Enter 10-digit number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="input-premium pl-14 text-base tracking-wide"
                  disabled={loading}
                />
                <Phone className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 px-4 font-bold text-white rounded-input gradient-primary hover:gradient-hover transition-all duration-200 shadow-md focus:outline-none focus:ring-4 focus:ring-brand-primary/20 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <>
                    OTP Bhejo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
              <p className="text-center text-xs text-brand-textMuted font-medium">
                Koi password nahi. Sirf OTP.
              </p>
            </div>
          </form>
        )}

        {/* Step 2: Input OTP Verification */}
        {step === 'otp' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-brand-dark">
                  OTP Code
                </label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-xs text-brand-primary font-bold hover:underline"
                >
                  Change Number
                </button>
              </div>
              
              {/* 6 Digit Input Boxes */}
              <div className="flex justify-between gap-2.5 mb-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 text-center text-xl font-extrabold bg-white border-2 border-slate-200 rounded-lg focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all"
                    disabled={loading}
                  />
                ))}
              </div>

              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-brand-textMuted font-medium">
                  Sent to +91 {phoneNumber}
                </span>
                {countdown > 0 ? (
                  <span className="text-xs font-bold text-brand-textMuted">
                    Resend in {countdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-xs font-bold text-brand-primary hover:underline"
                  >
                    OTP nahi mila? Dobara bhejo
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full flex items-center justify-center py-3.5 px-4 font-bold text-white rounded-input gradient-dark hover:gradient-primary transition-all duration-200 shadow-md focus:outline-none focus:ring-4 focus:ring-brand-primary/20 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <>
                  OTP Verify Karo
                  <ShieldCheck className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer Security Shield */}
        <div className="mt-8 pt-6 border-t border-slate-200/40 flex items-center justify-center gap-2 text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-brand-secondary" />
          End-to-End Encrypted Vaults
        </div>

      </div>
    </div>
  );
};

export default Login;
