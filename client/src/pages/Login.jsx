import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Phone, Lock, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Handle Resend OTP Countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    const fullPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    try {
      // Supabase Phone Auth OTP invocation
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) throw error;

      toast.success(`OTP sent successfully to ${fullPhone}`);
      setStep('otp');
      setCountdown(60);
    } catch (error) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || 'Failed to send OTP. Please check your number.');
      
      // Simulate for local development if credentials not fully supplied in .env
      if (import.meta.env.DEV) {
        toast.custom((t) => (
          <div className="bg-brand-dark text-white px-4 py-3 rounded-card shadow-premium border border-brand-primary flex flex-col space-y-1">
            <span className="font-bold text-xs uppercase tracking-wider text-brand-secondary">Dev Helper Mode</span>
            <span className="text-xs">OTP sign-in simulated for testing since Supabase secrets might be blank.</span>
          </div>
        ));
        setStep('otp');
        setCountdown(60);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      toast.error('Please enter a valid 6-digit OTP code.');
      return;
    }

    setLoading(true);
    const fullPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;

      toast.success('Successfully authenticated!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast.error(error.message || 'Invalid or expired OTP. Please try again.');

      // Simulate bypass in dev sandbox for prototype validation
      if (import.meta.env.DEV) {
        toast.success('Simulated dev bypass successful!');
        // Locally fake trigger auth state using a placeholder session
        // Note: For fully working local routing if keys aren't added yet,
        // we redirect directly. The AuthProvider's hook handles the true session check,
        // but we navigate to /dashboard for preview.
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
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
          <div className="gradient-primary w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-brand-dark tracking-tight">SafeKosh</h1>
          <p className="text-sm text-brand-textMuted mt-1.5">
            Decentralized savings, chit funds & credit registry
          </p>
        </div>

        {/* Step 1: Input Phone Number */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-textMuted mb-2">
                Indian Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                  +91
                </div>
                <input
                  type="tel"
                  required
                  placeholder="Enter 10-digit number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="input-premium pl-12"
                  disabled={loading}
                />
                <Phone className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
              <p className="text-[10px] text-brand-textMuted mt-2">
                We will send an OTP verify code via standard SMS. Carrier fees apply.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-3.5 px-4 font-bold text-white rounded-input gradient-primary hover:gradient-hover transition-all duration-200 shadow-md focus:outline-none focus:ring-4 focus:ring-brand-primary/20 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <>
                  Get OTP Code
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2: Input OTP Verification */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-textMuted">
                  Enter One-Time Password
                </label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-xs text-brand-primary font-bold hover:underline"
                >
                  Change Number
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-premium pl-10 text-center tracking-[0.4em] font-extrabold text-lg"
                  disabled={loading}
                />
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-[10px] text-brand-textMuted font-medium">
                  Sent to +91 {phoneNumber}
                </span>
                {countdown > 0 ? (
                  <span className="text-[10px] font-bold text-brand-textMuted">
                    Resend in {countdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-[10px] font-bold text-brand-primary hover:underline"
                  >
                    Resend Code
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-3.5 px-4 font-bold text-white rounded-input gradient-dark hover:gradient-primary transition-all duration-200 shadow-md focus:outline-none focus:ring-4 focus:ring-brand-primary/20 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <>
                  Verify & Proceed
                  <ShieldCheck className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>
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
