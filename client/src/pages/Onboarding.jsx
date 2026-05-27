import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';
import api from '../lib/api';
import { getErrorMessage } from '../lib/utils';
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
  const [dob, setDob] = useState('');
  const [upiId, setUpiId] = useState('');
  const [userType, setUserType] = useState('gig_worker');
  const [avatar, setAvatar] = useState(null);

  // Supported languages list mapping to the schema values
  const languagesList = [
    { code: 'en', symbol: 'A', native: 'English', desc: 'Global Standard' },
    { code: 'hi', symbol: 'अ', native: 'हिन्दी', desc: 'Hindi' },
    { code: 'mr', symbol: 'म', native: 'मराठी', desc: 'Marathi' },
    { code: 'ta', symbol: 'த', native: 'தமிழ்', desc: 'Tamil' },
    { code: 'te', symbol: 'తె', native: 'తెలుగు', desc: 'Telugu' }
  ];

  const upiChips = ['@upi', '@okaxis', '@okicici', '@okhdfcbank', '@paytm', '@ybl'];

  const previewImage = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function() {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLanguageSelect = (langCode) => {
    setLanguage(langCode);
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      const cleanName = name.trim();
      if (cleanName.length < 2 || cleanName.length > 50) {
        toast.error(language === 'hi' ? 'नाम 2 से 50 अक्षरों का होना चाहिए।' : 'Name must be between 2 and 50 characters.');
        return;
      }
      if (/[0-9]/.test(cleanName)) {
        toast.error(language === 'hi' ? 'नाम में संख्याएँ नहीं हो सकतीं।' : 'Name cannot contain numbers.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const cleanUpi = upiId.trim();
      const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z]+$/;
      if (!upiRegex.test(cleanUpi)) {
        toast.error(language === 'hi' ? 'कृपया एक वैध UPI ID दर्ज करें। (e.g. name@upi)' : 'Please enter a valid UPI ID (e.g. name@upi).');
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
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        
        setUser(completeRes.data.user);
        toast.success(language === 'hi' ? 'सेअप पूर्ण हुआ!' : 'SafeKosh account setup complete!');
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error) {
      console.error('Onboarding submission error:', error);
      const errMsg = getErrorMessage(error, 'Onboarding failed.');
      toast.error(errMsg);
      
      if (import.meta.env.DEV) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setUser({
          ...user,
          name: name.trim(),
          language,
          upi_id: upiId.trim(),
          user_type: userType,
          onboarding_completed: true
        });
        toast.success('Simulated success in development mode!');
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch(step) {
      case 1:
        return language === 'hi' ? 'अपनी भाषा चुनें' : 'Choose Your Language';
      case 2:
        return language === 'hi' ? 'अपने बारे में बताएं' : 'Tell Us About Yourself';
      case 3:
        return language === 'hi' ? 'अपना UPI कनेक्ट करें' : 'Connect Your UPI';
      case 4:
        return language === 'hi' ? 'अपना रोल चुनें' : 'Select Your Role';
      default:
        return 'SafeKosh Onboarding';
    }
  };

  const getStepSubtitle = () => {
    switch(step) {
      case 1:
        return language === 'hi' ? 'दैनिक बचत और वित्त के लिए अपनी पसंदीदा भाषा का चयन करें।' : 'Select the language you are most comfortable using for your daily finance.';
      case 2:
        return language === 'hi' ? 'आपकी पहचान आपकी वित्तीय तिजोरी को सुरक्षित रखने में मदद करती है।' : 'Your identity helps us secure your financial vault.';
      case 3:
        return language === 'hi' ? 'यूपीआई आईडी लिंक करके तत्काल ऑटो-सेव और सुरक्षित भुगतान सक्रिय करें।' : 'Enable instant savings and secure payouts by linking your existing UPI ID.';
      case 4:
        return language === 'hi' ? 'हम आपके काम और प्राथमिकताओं के अनुसार आपके वित्तीय टूल कस्टमाइज़ करेंगे।' : 'We will customize your financial tools based on your daily work and role.';
      default:
        return '';
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen font-sans selection:bg-primary-fixed-dim overflow-x-hidden flex flex-col justify-between">
      {/* Progress Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface shadow-sm border-b border-outline-variant/30">
        <div className="max-w-4xl mx-auto px-container-margin-mob md:px-container-margin-desk h-16 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[20px] font-extrabold text-primary tracking-tight">SafeKosh</span>
            <span className="text-xs font-bold text-on-surface-variant">
              {language === 'hi' ? `चरण ${step} / 4` : `Step ${step} of 4`}
            </span>
          </div>
          <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-secondary transition-all duration-500 ease-out" 
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Content Form Container */}
      <main className="pt-24 pb-32 max-w-4xl w-full mx-auto px-container-margin-mob md:px-container-margin-desk flex-1 flex flex-col justify-center">
        <div className="mb-stack-lg text-left">
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-extrabold text-on-surface mb-2">
            {getStepTitle()}
          </h1>
          <p className="text-body-md md:text-body-lg text-on-surface-variant">
            {getStepSubtitle()}
          </p>
        </div>

        {/* Step 1: Language Selection Grid */}
        {step === 1 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-gutter animate-fade-in">
            {languagesList.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageSelect(lang.code)}
                className={`flex flex-col items-start p-stack-lg bg-surface-container-lowest border-2 rounded-xl transition-all text-left group active:scale-[0.98] ${
                  language === lang.code
                    ? 'border-primary bg-surface-container shadow-md'
                    : 'border-outline-variant hover:border-primary hover:bg-surface-container-low'
                }`}
              >
                <span className="text-lg font-bold text-primary mb-1">{lang.symbol}</span>
                <span className="text-headline-md font-bold text-on-surface">{lang.native}</span>
                <span className="text-xs text-on-surface-variant mt-2">{lang.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Name and Profile Details */}
        {step === 2 && (
          <div className="bg-surface-container-lowest p-stack-lg rounded-3xl shadow-sm border border-outline-variant animate-fade-in max-w-xl mx-auto w-full">
            <div className="flex flex-col items-center mb-stack-lg">
              <div className="relative group cursor-pointer">
                <div className="w-28 h-28 rounded-full bg-surface-container-high border-4 border-white flex items-center justify-center overflow-hidden shadow-sm">
                  {avatar ? (
                    <img alt="Profile" className="w-full h-full object-cover" src={avatar} />
                  ) : (
                    <span className="material-symbols-outlined text-outline text-6xl">account_circle</span>
                  )}
                </div>
                <label 
                  htmlFor="photo-upload"
                  className="absolute bottom-1 right-1 bg-primary text-on-primary w-9 h-9 rounded-full flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                </label>
                <input 
                  accept="image/*" 
                  className="hidden" 
                  id="photo-upload" 
                  onChange={previewImage} 
                  type="file"
                />
              </div>
              <span className="mt-3 text-xs font-bold text-primary">
                {language === 'hi' ? 'प्रोफ़ाइल फोटो अपलोड करें' : 'Upload Profile Photo'}
              </span>
            </div>

            <div className="space-y-stack-md text-left">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  {language === 'hi' ? 'पूरा कानूनी नाम (PAN कार्ड के अनुसार)' : 'Full Legal Name (as per PAN card)'}
                </label>
                <input 
                  className="input-premium" 
                  placeholder={language === 'hi' ? 'अपना नाम दर्ज करें' : 'Enter your name'} 
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z\s]/g, '').slice(0, 50))}
                  required
                />
                <p className="text-[10px] text-on-surface-variant mt-1">
                  {language === 'hi' ? 'केवल अक्षर और स्पेस इस्तेमाल करें।' : 'Only letters and spaces are permitted.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  {language === 'hi' ? 'जन्म तिथि' : 'Date of Birth'}
                </label>
                <input 
                  className="input-premium" 
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Connect UPI ID */}
        {step === 3 && (
          <div className="bg-surface-container-lowest p-stack-lg rounded-3xl shadow-sm border border-outline-variant animate-fade-in max-w-xl mx-auto w-full">
            <div className="flex items-center gap-3.5 p-4 bg-primary-container/10 rounded-xl mb-stack-lg border border-primary/20 text-left">
              <span className="material-symbols-outlined text-primary text-[32px]">verified_user</span>
              <p className="text-xs font-bold text-on-surface leading-snug">
                {language === 'hi' 
                  ? 'हम आपके वित्तीय डेटा को शत-प्रतिशत निजी रखने के लिए एन्क्रिप्टेड टनल का उपयोग करते हैं।'
                  : 'We use encrypted tunnels to ensure your transaction data remains 100% private.'}
              </p>
            </div>

            <div className="space-y-stack-md text-left">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  {language === 'hi' ? 'UPI ID दर्ज करें' : 'Enter UPI ID'}
                </label>
                <div className="relative">
                  <input 
                    className="input-premium font-mono uppercase tracking-wide" 
                    placeholder="username@bank" 
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value.trim().toLowerCase())}
                    required
                  />
                  <span className="absolute right-4 top-3.5 material-symbols-outlined text-outline text-[18px]">alternate_email</span>
                </div>
                
                {/* UPI Suffix Chips */}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {upiChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleUpiChipClick(chip)}
                      className="py-1 px-3 bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-full border border-outline-variant/50 transition-all active:scale-95"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 py-2 border-t border-outline-variant/35 mt-4">
                <span className="text-xs font-bold text-outline">Supported Networks:</span>
                <span className="text-xs font-black text-on-surface font-mono tracking-widest text-primary">BHIM UPI</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Choose User Role / Type */}
        {step === 4 && (
          <div className="space-y-6 max-w-xl mx-auto w-full animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'gig_worker', symbol: 'motorcycle', title: language === 'hi' ? 'गिग वर्कर' : 'Gig Worker', desc: language === 'hi' ? 'डिलीवरी/ड्राइवर पार्टनर' : 'Delivery & Rides partner' },
                { id: 'chit_organiser', symbol: 'diversity_3', title: language === 'hi' ? 'चिट आयोजक' : 'Chit Organiser', desc: language === 'hi' ? 'बचत समूह प्रबंधक' : 'Organise savings pools' },
                { id: 'chit_member', symbol: 'home', title: language === 'hi' ? 'चिट सदस्य' : 'Chit Member', desc: language === 'hi' ? 'बचत सहभागी' : 'Save in circles' },
                { id: 'mixed', symbol: 'sync', title: language === 'hi' ? 'दोनों (Both)' : 'Both Roles', desc: language === 'hi' ? 'आयोजक और सदस्य' : 'Organise & participate' }
              ].map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setUserType(role.id)}
                  className={`p-stack-lg rounded-2xl font-bold border-2 transition-all flex flex-col items-center justify-center text-center group active:scale-[0.98] ${
                    userType === role.id
                      ? 'border-primary bg-surface-container/60 shadow-md'
                      : 'border-outline-variant bg-surface-container-lowest hover:border-primary hover:bg-surface-container-low'
                  }`}
                >
                  <span className={`material-symbols-outlined text-4xl mb-2 ${userType === role.id ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {role.symbol}
                  </span>
                  <span className="text-sm font-extrabold text-on-surface block">{role.title}</span>
                  <span className="text-[10px] text-on-surface-variant mt-1 leading-snug">{role.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex items-start gap-3 text-left p-3.5 bg-surface-container rounded-xl border border-outline-variant/30">
              <input 
                className="mt-1 rounded border-outline-variant text-primary focus:ring-primary h-4 w-4" 
                id="terms" 
                type="checkbox"
                required
                defaultChecked
              />
              <label className="text-[11px] text-on-surface-variant leading-normal" htmlFor="terms">
                {language === 'hi' ? (
                  <>मैं स्वचालित बचत प्रबंधन के लिए अपना UPI लिंक करने के लिए सहमत हूँ और SafeKosh <span className="text-primary font-bold cursor-pointer hover:underline">सेवा की शर्तों</span> को स्वीकार करता हूँ।</>
                ) : (
                  <>I agree to link my UPI ID for automated gig-income management and acknowledge the SafeKosh <span className="text-primary font-bold cursor-pointer hover:underline">Terms of Service</span>.</>
                )}
              </label>
            </div>
          </div>
        )}
      </main>

      {/* Navigation Footer */}
      <footer className="fixed bottom-0 left-0 w-full glass-effect py-stack-md px-container-margin-mob md:px-container-margin-desk z-50 border-t border-outline-variant/35">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-gutter">
          {step > 1 ? (
            <button 
              className="flex items-center gap-1.5 px-6 h-12 font-bold text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer active:scale-95"
              id="back-btn" 
              onClick={handlePrevStep}
              disabled={loading}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              {language === 'hi' ? 'पीछे' : 'Back'}
            </button>
          ) : (
            <div className="w-10" />
          )}

          <button 
            className={`flex items-center justify-center gap-1.5 px-10 h-12 text-on-primary rounded-full font-bold text-xs shadow-md active:scale-95 transition-all w-full md:w-auto cursor-pointer ${
              step === 4 ? 'bg-secondary hover:bg-secondary/90' : 'bg-primary hover:bg-primary/95'
            }`} 
            id="next-btn" 
            onClick={step === 4 ? handleFinish : handleNextStep}
            disabled={loading || (step === 2 && !name.trim()) || (step === 3 && !upiId.trim())}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : step === 4 ? (
              <>
                {language === 'hi' ? 'सेटअप पूरा करें' : 'Complete Setup'}
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
              </>
            ) : (
              <>
                {language === 'hi' ? 'आगे बढ़ें' : 'Continue'}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Onboarding;
