import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import useLanguageStore from '../store/languageStore';

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Accumulated onboarding state
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [userType, setUserType] = useState('gig_worker'); // default

  // Language options
  const languages = [
    { code: 'hi', label: 'हिंदी' },
    { code: 'mr', label: 'मराठी' },
    { code: 'te', label: 'తెలుగు' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'en', label: 'English' }
  ];

  const upiChips = ['@upi', '@okaxis', '@okicici', '@okhdfcbank', '@paytm', '@ybl'];

  const handleLanguageSelect = (langCode) => {
    setLanguage(langCode);
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      const cleanName = name.trim();
      if (cleanName.length < 2 || cleanName.length > 50) {
        toast.error('Naam 2 se 50 characters ka hona chahiye.');
        return;
      }
      if (/[0-9]/.test(cleanName)) {
        toast.error('Naam mein numbers nahi ho sakte.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const cleanUpi = upiId.trim();
      const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z]+$/;
      if (!upiRegex.test(cleanUpi)) {
        toast.error('Kripya ek valid UPI ID enter karein. (e.g. name@upi)');
        return;
      }
      setStep(4);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleUpiChipClick = (suffix) => {
    const parts = upiId.split('@');
    const base = parts[0] || '';
    setUpiId(base + suffix);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // 1. Submit Profile fields: name, language, upi_id, user_type
      await api.put('/api/auth/profile', {
        name: name.trim(),
        language,
        upi_id: upiId.trim(),
        user_type: userType
      });

      // 2. Mark complete-onboarding
      const completeRes = await api.post('/api/auth/complete-onboarding');
      
      if (completeRes.data.success) {
        // Trigger confetti!
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        
        // Update user state in authStore
        setUser(completeRes.data.user);
        toast.success('SafeKosh account setup complete!');
        
        // Redirect to dashboard after a short delay for animation
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error) {
      console.error('Onboarding submission error:', error);
      const errMsg = error.response?.data?.error || error.message || 'Onboarding failed.';
      toast.error(errMsg);
      
      if (import.meta.env.DEV) {
        // Simulate dev bypass
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setUser({
          ...user,
          name: name.trim(),
          language,
          upi_id: upiId.trim(),
          user_type: userType,
          onboarding_completed: true
        });
        toast.success('Simulated success!');
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-brand-bg relative overflow-hidden px-4 py-8">
      {/* Decorative Background */}
      <div className="absolute w-[500px] h-[500px] -top-40 -left-40 rounded-full bg-brand-primary/5 blur-3xl" />
      <div className="absolute w-[500px] h-[500px] -bottom-40 -right-40 rounded-full bg-brand-secondary/5 blur-3xl" />

      {/* Progress Dots */}
      <div className="flex items-center gap-3 mb-8 relative z-10">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
              s <= step ? 'bg-teal-600 scale-110 shadow-sm' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      <div className="max-w-md w-full glass-panel rounded-card shadow-premium p-8 relative z-10 border border-slate-200/40">
        
        {/* Step 1: Welcome & Language selection */}
        {step === 1 && (
          <div className="space-y-6 text-center animate-fadeIn">
            {/* SafeKosh Logo Keyframe Animation */}
            <div className="flex justify-center mb-6">
              <div 
                className="gradient-primary w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  animation: 'logoAnimation 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                }}
              >
                <ShieldCheck className="w-12 h-12 text-white" />
              </div>
            </div>

            <style>{`
              @keyframes logoAnimation {
                0% {
                  opacity: 0;
                  transform: scale(0.6) rotate(-15deg);
                }
                100% {
                  opacity: 1;
                  transform: scale(1) rotate(0deg);
                }
              }
            `}</style>

            <h2 className="text-2xl font-extrabold text-brand-dark">
              SafeKosh mein aapka swagat hai!
            </h2>
            <p className="text-sm text-brand-textMuted">
              Kripya apni bhasha (language) select karein:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={`py-3 px-4 rounded-xl font-bold border-2 transition-all text-sm ${
                    language === lang.code
                      ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleNextStep}
              className="w-full mt-4 flex items-center justify-center py-3.5 px-4 font-bold text-white rounded-input gradient-primary hover:gradient-hover transition-all shadow-md"
            >
              Aage Badho
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}

        {/* Step 2: Name Input */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-extrabold text-brand-dark text-center">
              Aapka naam kya hai?
            </h2>
            <p className="text-sm text-brand-textMuted text-center">
              Aapke profile aur certificates par isi naam ka use hoga.
            </p>

            <div>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Apna poora naam likhein"
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z\s]/g, '').slice(0, 50))}
                  className="input-premium pr-16 text-base font-medium"
                  autoFocus
                />
                <span className="absolute right-4 top-4 text-xs font-bold text-slate-400">
                  {name.length}/50
                </span>
              </div>
              <p className="text-[10px] text-brand-textMuted mt-1">
                Keval letters aur spaces use karein (no numbers).
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handlePrevStep}
                className="flex-1 flex items-center justify-center py-3.5 px-4 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all rounded-input"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Peeche
              </button>
              <button
                onClick={handleNextStep}
                disabled={name.trim().length < 2}
                className="flex-1 flex items-center justify-center py-3.5 px-4 font-bold text-white rounded-input gradient-primary hover:gradient-hover transition-all shadow-md disabled:opacity-50"
              >
                Aage Badho
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: UPI ID Input */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-extrabold text-brand-dark text-center">
              Aapka UPI ID kya hai?
            </h2>
            <p className="text-sm text-brand-textMuted text-center">
              Payouts aur smart vault auto-save deposits isi account se honge.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                required
                placeholder="Example: name@upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value.trim().toLowerCase())}
                className="input-premium text-base font-mono"
                autoFocus
              />
              
              <div className="flex flex-wrap gap-2 pt-1">
                {upiChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleUpiChipClick(chip)}
                    className="py-1 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full border border-slate-200 transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-brand-textMuted">
                Example: yourname@upi ya yourname@okaxis
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handlePrevStep}
                className="flex-1 flex items-center justify-center py-3.5 px-4 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all rounded-input"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Peeche
              </button>
              <button
                onClick={handleNextStep}
                disabled={!upiId.trim()}
                className="flex-1 flex items-center justify-center py-3.5 px-4 font-bold text-white rounded-input gradient-primary hover:gradient-hover transition-all shadow-md disabled:opacity-50"
              >
                Aage Badho
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: User Type Cards */}
        {step === 4 && (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-extrabold text-brand-dark text-center">
              Aap kya karte hain?
            </h2>
            <p className="text-sm text-brand-textMuted text-center">
              Isse hum aapke user role ko customize karenge.
            </p>

            <div className="grid grid-cols-2 gap-3.5">
              {[
                { id: 'gig_worker', emoji: '🛵', title: 'Gig Worker', subtitle: 'Delivery Partner' },
                { id: 'chit_organiser', emoji: '👥', title: 'Organiser', subtitle: 'Chit Organiser' },
                { id: 'chit_member', emoji: '🏠', title: 'Member', subtitle: 'Chit Member' },
                { id: 'mixed', emoji: '🔄', title: 'Dono (Both)', subtitle: 'Organiser & Member' }
              ].map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setUserType(role.id)}
                  className={`p-4 rounded-xl font-bold border-2 transition-all flex flex-col items-center justify-center text-center text-slate-800 ${
                    userType === role.id
                      ? 'border-teal-600 bg-teal-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-3xl mb-2">{role.emoji}</span>
                  <span className="text-sm font-extrabold block text-slate-800">{role.title}</span>
                  <span className="text-[10px] text-brand-textMuted mt-0.5">{role.subtitle}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handlePrevStep}
                disabled={loading}
                className="flex-1 flex items-center justify-center py-3.5 px-4 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all rounded-input"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Peeche
              </button>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="flex-1 flex items-center justify-center py-3.5 px-4 font-bold text-white rounded-input gradient-primary hover:gradient-hover transition-all shadow-md"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <>
                    SafeKosh Shuru Karo
                    <ShieldCheck className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Onboarding;
