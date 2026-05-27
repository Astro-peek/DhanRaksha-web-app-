import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Mail, Lock, ArrowRight, ShieldCheck, RefreshCw, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';
import useAuthStore from '../store/authStore';

const Login = () => {
  const navigate = useNavigate();
  const { setSession, setUser } = useAuthStore();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Handle Google OAuth redirect callback
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setSession(session);
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            setUser(profile);
            if (!profile.onboarding_completed) {
              navigate('/onboarding');
            } else {
              navigate('/dashboard');
            }
          } else {
            // New user via Google — create profile row
            const { data: newProfile } = await supabase
              .from('users')
              .insert({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.full_name || null,
              })
              .select()
              .single();
            setUser(newProfile || { id: session.user.id, onboarding_completed: false });
            navigate('/onboarding');
          }
        } catch (err) {
          console.error('Profile fetch error:', err);
          setUser({ id: session.user.id, onboarding_completed: false });
          navigate('/onboarding');
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [setSession, setUser, navigate]);

  // ── Google OAuth ──────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err.message || 'Google sign-in failed.');
      setGoogleLoading(false);
    }
  };

  // ── Email Login ───────────────────────────────────────────────────
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Email and password are required.'); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      setSession(data.session);

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      setUser(profile || { id: data.user.id, onboarding_completed: false });

      if (!profile?.onboarding_completed) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ── Email Signup ──────────────────────────────────────────────────
  const handleEmailSignup = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Email and password are required.'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;

      if (data.user && !data.user.email_confirmed_at) {
        toast.success('Check your email for a confirmation link!', { duration: 6000 });
        return;
      }

      // Auto-confirmed (e.g. disabled email confirmation in Supabase)
      if (data.session) {
        setSession(data.session);
        setUser({ id: data.user.id, onboarding_completed: false });
        navigate('/onboarding');
      }
    } catch (err) {
      toast.error(err.message || 'Sign-up failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-brand-bg relative overflow-hidden px-4">
      {/* Decorative orbs */}
      <div className="absolute w-96 h-96 -top-20 -left-20 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute w-96 h-96 -bottom-20 -right-20 rounded-full bg-brand-secondary/10 blur-3xl pointer-events-none" />

      <div className="max-w-md w-full glass-panel rounded-card shadow-premium p-8 relative z-10 border border-slate-200/40">

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="gradient-primary w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-brand-dark tracking-tight">SafeKosh</h1>
          <p className="text-sm text-brand-textMuted mt-1.5">
            Decentralized savings, chit funds &amp; credit registry
          </p>
        </div>

        {/* ── Google OAuth Button ── */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          id="google-signin-btn"
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border-2 border-slate-200 rounded-input hover:border-brand-primary/40 hover:bg-slate-50 transition-all duration-200 shadow-sm font-bold text-brand-dark text-sm mb-5 disabled:opacity-50"
        >
          {googleLoading ? (
            <RefreshCw className="w-5 h-5 animate-spin text-brand-primary" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs font-bold text-brand-textMuted uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* ── Mode Tabs ── */}
        <div className="flex rounded-input bg-slate-100 p-1 mb-5">
          <button
            onClick={() => setMode('login')}
            id="tab-login"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-md transition-all duration-200 ${
              mode === 'login'
                ? 'bg-white text-brand-primary shadow-sm'
                : 'text-brand-textMuted hover:text-brand-dark'
            }`}
          >
            <LogIn size={13} /> Sign In
          </button>
          <button
            onClick={() => setMode('signup')}
            id="tab-signup"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-md transition-all duration-200 ${
              mode === 'signup'
                ? 'bg-white text-brand-primary shadow-sm'
                : 'text-brand-textMuted hover:text-brand-dark'
            }`}
          >
            <UserPlus size={13} /> Create Account
          </button>
        </div>

        {/* ── Email Form ── */}
        <form onSubmit={mode === 'login' ? handleEmailLogin : handleEmailSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-brand-dark mb-1.5">Email Address</label>
            <div className="relative">
              <input
                id="email-input"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-premium pl-10"
                disabled={loading}
              />
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-dark mb-1.5">Password</label>
            <div className="relative">
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Enter password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-premium pl-10 pr-10"
                disabled={loading}
              />
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-brand-primary"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="email-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 font-bold text-white rounded-input gradient-primary hover:gradient-hover transition-all duration-200 shadow-md focus:outline-none focus:ring-4 focus:ring-brand-primary/20 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-slate-200/40 flex items-center justify-center gap-2 text-[10px] text-brand-textMuted font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-brand-secondary" />
          End-to-End Encrypted · RBI Compliant
        </div>
      </div>
    </div>
  );
};

export default Login;
