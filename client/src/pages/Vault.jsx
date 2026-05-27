import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { useAuth } from '../components/shared/AuthProvider';
import { useLanguageStore } from '../lib/languageStore';
import AmountInput from '../components/shared/AmountInput';
import ConfirmModal from '../components/shared/ConfirmModal';
import { formatINR, getErrorMessage } from '../lib/utils';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';
import useSWR from 'swr';
import { useVaultRealtime } from '../hooks/useRealtime';
import { withOfflineQueue } from '../lib/offlineQueue';

export default function Vault() {
  const { user } = useAuth();
  const { lang } = useLanguageStore();

  // App States
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Infinite Scroll States
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef(null);

  // Modal States
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [saveAmount, setSaveAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [destinationUpi, setDestinationUpi] = useState(user?.upi_id || '');
  const [actionLoading, setActionLoading] = useState(false);

  // Settings / Limits States
  const [showSettings, setShowSettings] = useState(false);
  const [savePerTx, setSavePerTx] = useState(20);
  const [dailyLimit, setDailyLimit] = useState(500);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // Mandate Stepper States
  const [mandateUpi, setMandateUpi] = useState('');
  const [mandateStep, setMandateStep] = useState(1); // 1: Input, 2: Authorize, 3: Success
  const [shortUrl, setShortUrl] = useState('');
  const [submittingMandate, setSubmittingMandate] = useState(false);

  // FAQ Accordion States
  const [faqOpen, setFaqOpen] = useState({
    q1: false,
    q2: false,
    q3: false
  });

  // Localized Strings
  const l = {
    title: lang === 'hi' ? 'स्मार्ट बचत वॉल्ट' : 'Smart Savings Vault',
    subtitle: lang === 'hi' ? 'UPI ऑटो-पे और ब्लॉकचेन द्वारा सुरक्षित स्वचालित तिजोरी।' : 'Automated savings locker secured by UPI mandates & verified on-chain.',
    totalSaved: lang === 'hi' ? 'कुल तिजोरी शेष' : 'TOTAL VAULT BALANCE',
    dailySavings: lang === 'hi' ? 'दैनिक बचत सीमा' : 'Daily Savings Limit',
    savedToday: lang === 'hi' ? 'आज की सीमा उपयोग' : 'Limit Used Today',
    mandateActive: lang === 'hi' ? 'ऑटो-पे सक्रिय' : 'Auto-Save Active',
    mandatePending: lang === 'hi' ? 'ऑटो-पे लंबित' : 'Auto-Pay Pending',
    mandateInactive: lang === 'hi' ? 'ऑटो-पे निष्क्रिय' : 'Auto-Pay Inactive',
    settingsBtn: lang === 'hi' ? 'बचत सीमाएं' : 'Savings Rules',
    saveBtn: lang === 'hi' ? 'जमा करें' : 'Deposit',
    withdrawBtn: lang === 'hi' ? 'पैसे निकालें' : 'Withdraw',
    saveTitle: lang === 'hi' ? 'वॉल्ट में पैसे जमा करें' : 'Deposit to Vault',
    withdrawTitle: lang === 'hi' ? 'वॉल्ट से पैसे निकालें' : 'Withdraw from Vault',
    minMaxSave: lang === 'hi' ? 'न्यूनतम ₹10, अधिकतम ₹200' : 'Min ₹10, Max ₹200',
    minWithdraw: lang === 'hi' ? 'न्यूनतम ₹100' : 'Minimum ₹100',
    recentTx: lang === 'hi' ? 'बचत इतिहास' : 'Savings History',
    noTx: lang === 'hi' ? 'कोई बचत रिकॉर्ड नहीं मिला।' : 'No transactions recorded yet.',
    mandateSetupTitle: lang === 'hi' ? 'UPI ऑटो-पे सेटअप करें' : 'Connect Your UPI AutoPay',
    mandateSetupDesc: lang === 'hi' ? 'दैनिक बचत को स्वचालित करने के लिए सुरक्षित ऑटो-पे जनादेश स्थापित करें।' : 'Enable friction-free automated savings by creating a secure UPI AutoPay mandate.',
    enterUpiId: lang === 'hi' ? 'अपना UPI ID दर्ज करें' : 'Enter UPI ID',
    initiateMandate: lang === 'hi' ? 'जनादेश शुरू करें' : 'Initiate Mandate',
    openRazorpay: lang === 'hi' ? 'Razorpay पर प्रमाणित करें' : 'Authorize on Razorpay',
    pollMessage: lang === 'hi' ? 'ऑटो-पे सक्रिय होने की प्रतीक्षा की जा रही है...' : 'Waiting for mandate activation status...',
    mandateSuccess: lang === 'hi' ? 'ऑटो-पे सफलतापूर्वक सक्रिय किया गया! 🎉' : 'AutoPay Mandate Successfully Activated! 🎉',
    faqTitle: lang === 'hi' ? 'अक्सर पूछे जाने वाले प्रश्न' : 'Frequently Asked Questions',
    faq1Q: lang === 'hi' ? '1. क्या यह तिजोरी पूरी तरह सुरक्षित है?' : '1. Is this system completely secure?',
    faq1A: lang === 'hi' ? 'हाँ। आपका पैसा सीधे ट्रस्ट खातों में रहता है और प्रत्येक लेनदेन ब्लॉकचेन पर दर्ज होता है।' : 'Yes. Your funds are secured in RBI-regulated trustee accounts with smart contract logic, and every single event is audited and written on the public Polygon blockchain ledger.',
    faq2Q: lang === 'hi' ? '2. ऑटो-सेव (Auto-Save) कैसे काम करता है?' : '2. How does Auto-Save work?',
    faq2A: lang === 'hi' ? 'जब आप खर्च करते हैं या काम पूरा करते हैं, तो आपकी चुनी हुई राशि आपके लिंक्ड UPI खाते से स्वचालित रूप से कटकर इस तिजोरी में जमा हो जाती है।' : 'Whenever you make digital transactions, our system auto-debits your chosen round-up or save amount (e.g. ₹20) from your UPI account up to your daily limits, moving it into your high-yield secure locker.',
    faq3Q: lang === 'hi' ? '3. मैं अपने पैसे कब निकाल सकता हूँ?' : '3. When can I withdraw my funds?',
    faq3A: lang === 'hi' ? 'आप कभी भी पैसे निकाल सकते हैं। पैसा तुरंत 60 सेकंड के भीतर आपके लिंक्ड UPI पते पर वापस भेज दिया जाता है।' : 'You can withdraw your entire savings at any moment. Withdrawals are processed instantly and credited to your destination UPI ID within 60 seconds.',
    calcTitle: lang === 'hi' ? 'दैनिक बचत का अनुमान' : 'Estimated Savings Tool',
    calcDesc: lang === 'hi' ? 'यदि आप प्रति दिन औसतन 5 डिजिटल भुगतान करते हैं:' : 'If you make an average of 5 digital UPI payments per day:',
    calcWeekly: lang === 'hi' ? 'साप्ताहिक बचत' : 'Weekly Savings',
    calcMonthly: lang === 'hi' ? 'मासिक बचत' : 'Monthly Savings',
    calcYearly: lang === 'hi' ? 'वार्षिक बचत (10% अनुमानित ब्याज के साथ)' : 'Yearly Savings (with 10% expected compound)',
    goalsTitle: lang === 'hi' ? 'आपके बचत लक्ष्य' : 'Your Goals',
    goalBike: lang === 'hi' ? 'नया इलेक्ट्रिक स्कूटर' : 'New Electric Bike',
    goalEmergency: lang === 'hi' ? 'आपातकालीन कोष' : 'Emergency Fund',
    predictionTitle: lang === 'hi' ? 'स्मार्ट भविष्यवाणी' : 'Smart Prediction',
    predictionDesc: lang === 'hi' ? 'आपकी हालिया गति के आधार पर, आप 12 दिसंबर तक अपना लक्ष्य पूरा कर लेंगे!' : 'Based on your recent gig frequency, you\'ll reach your \'New Bike\' goal by December 12th!',
    boostBtn: lang === 'hi' ? 'बचत बढ़ाएं' : 'Boost Savings',
    autoSaveDesc: lang === 'hi' ? 'प्रत्येक भुगतान पर बचत करें' : 'Save as you earn',
    activeLabel: lang === 'hi' ? 'सक्रिय: प्रत्येक भुगतान पर 5%' : 'Active: 5% of each payout',
    roundupTitle: lang === 'hi' ? 'राउंड-अप' : 'Round-ups',
    roundupDesc: lang === 'hi' ? '₹10 प्रति पूरा काम' : '₹10 per gig completed',
    editRulesBtn: lang === 'hi' ? 'नियम बदलें' : 'Edit Rules',
    saveRulesTitle: lang === 'hi' ? 'बचत सीमा सेटिंग्स' : 'Update Savings Limits'
  };

  // Call Realtime Hook
  useVaultRealtime(user?.id);

  // SWR Caching
  const fetcher = (url) => api.get(url).then(r => r.data);
  const { data: swrData, mutate } = useSWR(
    user?.id ? `/api/vault/account?userId=${user.id}` : null,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true
    }
  );

  // Sync SWR Data with Local State
  useEffect(() => {
    if (swrData?.success) {
      setAccount(swrData.account);
      setSavePerTx(swrData.account.save_per_transaction || 20);
      setDailyLimit(swrData.account.daily_limit || 500);
      
      if (swrData.account.mandate_status === 'pending') {
        setMandateStep(2);
      } else if (swrData.account.mandate_status === 'active') {
        setMandateStep(3);
      }
    }
  }, [swrData]);

  // Fetch transactions with pagination
  const fetchTransactions = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum > 1) setLoadingMore(true);
    try {
      const res = await api.get(`/api/vault/transactions?page=${pageNum}&limit=10`);
      if (res.data?.success) {
        const fetched = res.data.transactions || [];
        setTransactions(prev => append ? [...prev, ...fetched] : fetched);
        setHasMore(pageNum < res.data.totalPages);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('Error fetching vault transactions:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initialize transactions
  useEffect(() => {
    fetchTransactions(1, false);
  }, [fetchTransactions]);

  // Infinite Scroll Intersection Observer Setup
  useEffect(() => {
    if (loading || !hasMore || loadingMore) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchTransactions(page + 1, true);
      }
    }, { threshold: 0.8 });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [loading, hasMore, loadingMore, page, fetchTransactions]);

  // Setup mandate handler
  const handleSetupMandate = async (e) => {
    e.preventDefault();
    if (!mandateUpi) {
      toast.error('Please enter a valid UPI ID');
      return;
    }
    setSubmittingMandate(true);
    try {
      const res = await api.post('/api/vault/setup-mandate', { upi_id: mandateUpi });
      if (res.data?.success) {
        setShortUrl(res.data.shortUrl);
        setMandateStep(2);
        toast.success(lang === 'hi' ? 'ऑटो-पे जनादेश शुरू हो गया!' : 'AutoPay mandate checkout initiated!');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to initialize mandate checkout.'));
    } finally {
      setSubmittingMandate(false);
    }
  };

  // Save operation wrapped for offline queueing
  const saveOperation = async (amount) => {
    const res = await api.post('/api/vault/save', { amount });
    if (res.data?.success) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success(lang === 'hi' ? `₹${amount} सफलतापूर्वक सुरक्षित जमा हुआ!` : `₹${amount} saved successfully in Vault!`);
      setShowSaveModal(false);
      setSaveAmount('');
      mutate();
      fetchTransactions(1, false);
    }
  };

  // Manual save handler
  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(saveAmount);
    if (isNaN(amountNum) || amountNum < 10 || amountNum > 200) {
      toast.error(l.minMaxSave);
      return;
    }

    setActionLoading(true);
    try {
      await withOfflineQueue(saveOperation, amountNum);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete savings transaction.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Manual withdraw handler
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum < 100) {
      toast.error(l.minWithdraw);
      return;
    }
    if (!destinationUpi) {
      toast.error('Destination UPI ID is required.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post('/api/vault/withdraw', { 
        amount: amountNum, 
        destination_upi: destinationUpi 
      });
      if (res.data?.success) {
        toast.success(
          lang === 'hi' 
            ? `निकासी शुरू! आपके खाते में लगभग 60 सेकंड में ₹${amountNum} प्राप्त होंगे।`
            : `Withdrawal initiated! You will receive ₹${amountNum} in approximately 60 seconds.`,
          { duration: 5000 }
        );
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        mutate();
        fetchTransactions(1, false);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Withdrawal failed. Check balance or input fields.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Settings update handler
  const handleUpdateSettings = async () => {
    setUpdatingSettings(true);
    try {
      const res = await api.put('/api/vault/settings', {
        save_per_transaction: savePerTx,
        daily_limit: dailyLimit
      });
      if (res.data?.success) {
        toast.success(lang === 'hi' ? 'बचत सीमाएं अपडेट की गईं!' : 'Savings settings successfully updated!');
        setShowSettings(false);
        mutate();
      }
    } catch (err) {
      toast.error('Failed to update savings limits.');
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleSliderChange = (e) => {
    const newVal = Number(e.target.value);
    setDailyLimit(newVal);
  };

  const handleSliderSave = async () => {
    try {
      await api.put('/api/vault/settings', {
        save_per_transaction: savePerTx,
        daily_limit: dailyLimit
      });
      toast.success(lang === 'hi' ? 'नया सीमा स्वीकृत हुआ!' : 'Daily limits updated successfully!');
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle FAQ Accordions
  const toggleFaq = (key) => {
    setFaqOpen(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const todaySaved = account?.daily_saved_today || 0;
  const limit = account?.daily_limit || 500;
  const percentage = Math.min(Math.round((todaySaved / limit) * 100), 100);

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-1 md:px-2 py-4">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-primary tracking-tight">
            {l.title}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {l.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {account?.mandate_status === 'active' && (
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface-container-low hover:bg-surface-container-high text-on-surface font-bold text-xs rounded-xl border border-outline-variant/30 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">settings</span>
              {l.settingsBtn}
            </button>
          )}
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center justify-center gap-1 px-4 py-2.5 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            {l.saveBtn}
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="flex items-center justify-center gap-1 px-4 py-2.5 bg-surface-container-high hover:bg-surface-variant text-on-surface font-bold text-xs rounded-xl border border-outline-variant/30 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
            {l.withdrawBtn}
          </button>
        </div>
      </div>

      {/* Main Grid Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        
        {/* Left Columns (col-span-7) */}
        <div className="lg:col-span-7 flex flex-col gap-stack-lg">
          
          {/* Vault Balance Card */}
          <section className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-15 transition-opacity pointer-events-none">
              <span className="material-symbols-outlined text-[120px] filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{l.totalSaved}</span>
                <span className="material-symbols-outlined text-secondary text-sm filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              </div>
              <h1 className="text-display-lg md:text-5xl font-black text-primary mb-6">
                {formatINR(account?.balance || 0)}
              </h1>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowSaveModal(true)}
                  className="flex-1 bg-primary text-white h-12 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  {l.saveBtn}
                </button>
                <button 
                  onClick={() => setShowWithdrawModal(true)}
                  className="flex-1 bg-surface-container-high text-on-surface h-12 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-surface-variant active:scale-95 transition-all cursor-pointer border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                  {l.withdrawBtn}
                </button>
              </div>
            </div>
          </section>

          {/* Configuration & Controls row */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-stack-lg">
            
            {/* Auto-Save toggle details */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-headline-md font-bold text-on-surface">Auto-Save</h3>
                  <p className="text-xs text-on-surface-variant">{l.autoSaveDesc}</p>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={account?.mandate_status === 'active'}
                    readOnly
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary relative"></div>
                </label>
              </div>
              <div className="bg-secondary-container/30 p-3 rounded-xl border border-secondary-container/30">
                <p className="text-xs font-bold text-on-secondary-container flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  {l.activeLabel} (₹{savePerTx}/tx)
                </p>
              </div>
            </div>

            {/* Round-up Mandate */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-headline-md font-bold text-on-surface">{l.roundupTitle}</h3>
                  <p className="text-xs text-on-surface-variant">{l.roundupDesc}</p>
                </div>
                <span className="material-symbols-outlined text-secondary filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <button 
                onClick={() => setShowSettings(true)}
                className="text-primary font-bold text-xs flex items-center gap-0.5 hover:underline cursor-pointer text-left"
              >
                {l.editRulesBtn}
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>

            {/* Daily Limit Slider */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-sm md:col-span-2 text-left">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-headline-md font-bold text-on-surface">{l.dailySavings}</h3>
                <span className="text-primary font-black text-sm">{formatINR(dailyLimit)}</span>
              </div>
              <input 
                className="w-full h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary" 
                max="2000" 
                min="50" 
                step="50"
                type="range" 
                value={dailyLimit}
                onChange={handleSliderChange}
                onMouseUp={handleSliderSave}
                onTouchEnd={handleSliderSave}
              />
              <div className="flex justify-between mt-2 text-[10px] text-on-surface-variant font-bold">
                <span>₹50</span>
                <span>₹2000</span>
              </div>
            </div>
          </section>

          {/* Stepper setup for inactive/pending mandates */}
          {(!account?.mandate_status || account?.mandate_status === 'inactive' || account?.mandate_status === 'pending') && (
            <div className="bg-surface-container-lowest rounded-3xl p-6 border border-primary/20 shadow-sm text-left">
              <div className="flex items-start gap-3.5 mb-5">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl mt-0.5">
                  <span className="material-symbols-outlined filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                </div>
                <div>
                  <h3 className="text-md font-bold text-primary">{l.mandateSetupTitle}</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">{l.mandateSetupDesc}</p>
                </div>
              </div>

              {/* Step indicator */}
              <div className="flex items-center justify-between mb-6 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    mandateStep >= 1 ? 'bg-primary text-white' : 'bg-surface-container-high text-outline'
                  }`}>1</div>
                  <span className="text-xs font-bold text-on-surface">UPI ID</span>
                </div>
                <div className="h-0.5 bg-outline-variant/30 flex-1 mx-2" />
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    mandateStep >= 2 ? 'bg-primary text-white' : 'bg-surface-container-high text-outline'
                  }`}>2</div>
                  <span className="text-xs font-bold text-on-surface">{lang === 'hi' ? 'मंजूरी' : 'Authorize'}</span>
                </div>
                <div className="h-0.5 bg-outline-variant/30 flex-1 mx-2" />
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    mandateStep >= 3 ? 'bg-primary text-white' : 'bg-surface-container-high text-outline'
                  }`}>3</div>
                  <span className="text-xs font-bold text-on-surface">{lang === 'hi' ? 'सक्रिय' : 'Active'}</span>
                </div>
              </div>

              {/* Stepper Content */}
              {mandateStep === 1 && (
                <form onSubmit={handleSetupMandate} className="max-w-md mx-auto space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">{l.enterUpiId}</label>
                    <input
                      type="text"
                      value={mandateUpi}
                      onChange={(e) => setMandateUpi(e.target.value)}
                      placeholder="e.g. name@upi"
                      className="input-premium font-mono"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingMandate}
                    className="w-full py-3 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl active:scale-98 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {submittingMandate ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {l.initiateMandate} <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {mandateStep === 2 && (
                <div className="max-w-md mx-auto text-center space-y-4 py-3">
                  <span className="material-symbols-outlined text-amber-500 text-5xl animate-bounce">warning</span>
                  <p className="text-xs font-semibold text-on-surface leading-relaxed">
                    {lang === 'hi' 
                      ? 'जनादेश स्वीकृत करने के लिए नीचे दिए गए बटन पर क्लिक करें और Razorpay सुरक्षित पेमेंट गेटवे पर भुगतान पूरा करें।'
                      : 'Please authorize the subscription checkout on Razorpay by opening the secure window below. Confirming the mandate sets up automated credits.'}
                  </p>
                  
                  <div className="flex flex-col gap-2">
                    <a
                      href={shortUrl || account?.razorpay_mandate_id ? `https://rzp.io/i/${account?.razorpay_mandate_id || shortUrl}` : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      {l.openRazorpay} <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    </a>
                    
                    <span className="text-[10px] text-on-surface-variant flex items-center justify-center gap-1 mt-1 font-bold">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      {l.pollMessage}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Calculator Section */}
          {account?.mandate_status === 'active' && (
            <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-sm text-left">
              <h3 className="text-md font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">bolt</span>
                {l.calcTitle}
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">{l.calcDesc}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="p-4 bg-surface rounded-xl border border-outline-variant/50">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">{l.calcWeekly}</span>
                  <p className="text-base font-black text-primary mt-1">{formatINR(savePerTx * 5 * 7)}</p>
                </div>
                <div className="p-4 bg-surface rounded-xl border border-outline-variant/50">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">{l.calcMonthly}</span>
                  <p className="text-base font-black text-primary mt-1">{formatINR(savePerTx * 5 * 30)}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-primary-container/10 to-secondary-container/5 border border-primary/10 rounded-xl">
                  <span className="text-[10px] font-bold text-primary uppercase">{l.calcYearly}</span>
                  <p className="text-base font-black text-primary mt-1">
                    {formatINR((savePerTx * 5 * 365) * 1.1)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Savings Ledger table */}
          <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-sm text-left">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-headline-md font-bold text-on-surface">{l.recentTx}</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="text-on-surface hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 font-bold flex items-center gap-2">
                        {tx.direction === 'credit' 
                          ? <span className="material-symbols-outlined text-secondary text-sm">trending_up</span>
                          : <span className="material-symbols-outlined text-rose-500 text-sm">payments</span>
                        }
                        {tx.note || (tx.direction === 'credit' ? 'Savings Deposit' : 'Withdrawal Payout')}
                      </td>
                      <td className="py-3.5 font-black">{formatINR(tx.amount)}</td>
                      <td className="py-3.5 text-xs text-on-surface-variant font-bold capitalize">
                        {String(tx.trigger_type).replace('_', ' ')}
                      </td>
                      <td className="py-3.5 text-xs text-on-surface-variant">
                        {new Date(tx.created_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                      </td>
                      <td className="py-3.5 text-right font-mono">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          tx.status === 'success' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : tx.status === 'pending' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {transactions.length === 0 && (
                <div className="py-8 text-center text-sm text-on-surface-variant">
                  {l.noTx}
                </div>
              )}
              
              {/* Load More scroll target */}
              {hasMore && (
                <div ref={loadMoreRef} className="py-4 flex justify-center">
                  {loadingMore ? (
                    <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-xs text-on-surface-variant font-bold">Scroll to load more</span>
                  )}
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Right Column: Goals, Predicts & FAQs (col-span-5) */}
        <div className="lg:col-span-5 flex flex-col gap-stack-lg text-left">
          
          {/* Savings Goals Section */}
          <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-sm flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-headline-md font-bold text-on-surface">{l.goalsTitle}</h3>
              <button 
                onClick={() => toast.success('New goal configurator coming soon!')}
                className="material-symbols-outlined p-2 bg-surface-container-high rounded-full hover:scale-105 active:scale-95 transition-all cursor-pointer border border-outline-variant/30"
              >
                add
              </button>
            </div>
            
            <div className="space-y-8">
              {/* Goal Item 1: Bike */}
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="32" className="stroke-surface-container-high fill-transparent" strokeWidth="6" />
                    <circle cx="40" cy="40" r="32" className="stroke-primary fill-transparent transition-all duration-500" strokeWidth="6" strokeDasharray={2 * Math.PI * 32} strokeDashoffset={(2 * Math.PI * 32) * (1 - 0.75)} strokeLinecap="round" />
                  </svg>
                  <div className="absolute font-black text-primary text-xs">75%</div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-on-surface text-sm">{l.goalBike}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full">₹15k Left</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-2">Target: ₹60,000</p>
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-3/4 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Goal Item 2: Emergency */}
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="32" className="stroke-surface-container-high fill-transparent" strokeWidth="6" />
                    <circle cx="40" cy="40" r="32" className="stroke-secondary fill-transparent transition-all duration-500" strokeWidth="6" strokeDasharray={2 * Math.PI * 32} strokeDashoffset={(2 * Math.PI * 32) * (1 - 0.40)} strokeLinecap="round" />
                  </svg>
                  <div className="absolute font-black text-secondary text-xs">40%</div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-on-surface text-sm">{l.goalEmergency}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full">Critical</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-2">Target: ₹1,00,000</p>
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                    <div className="bg-secondary h-full w-2/5 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Banner */}
            <div className="bg-primary p-6 rounded-2xl relative overflow-hidden text-on-primary mt-4">
              <div className="relative z-10">
                <p className="font-bold mb-1 text-sm">{l.predictionTitle}</p>
                <p className="text-xs opacity-90 leading-snug mb-4">
                  {l.predictionDesc}
                </p>
                <button 
                  onClick={() => {
                    confetti({ particleCount: 50 });
                    toast.success('Savings boosted by ₹50!');
                  }}
                  className="bg-white text-primary px-4 py-2 rounded-lg font-bold text-xs shadow active:scale-95 transition-all cursor-pointer"
                >
                  {l.boostBtn}
                </button>
              </div>
              <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-7xl opacity-10 pointer-events-none">rocket_launch</span>
            </div>
          </section>

          {/* FAQ Accordions */}
          <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant shadow-sm">
            <h3 className="text-headline-md font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">help</span>
              {l.faqTitle}
            </h3>
            
            <div className="space-y-3.5 divide-y divide-outline-variant/40">
              
              {/* Q1 */}
              <div className="pt-3.5 first:pt-0">
                <button
                  onClick={() => toggleFaq('q1')}
                  className="w-full flex items-center justify-between text-left text-sm font-bold text-on-surface hover:text-primary transition-colors focus:outline-none"
                >
                  <span>{l.faq1Q}</span>
                  <span className="material-symbols-outlined text-sm">
                    {faqOpen.q1 ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {faqOpen.q1 && (
                  <p className="text-xs text-on-surface-variant mt-2 leading-relaxed font-medium">
                    {l.faq1A}
                  </p>
                )}
              </div>

              {/* Q2 */}
              <div className="pt-3.5">
                <button
                  onClick={() => toggleFaq('q2')}
                  className="w-full flex items-center justify-between text-left text-sm font-bold text-on-surface hover:text-primary transition-colors focus:outline-none"
                >
                  <span>{l.faq2Q}</span>
                  <span className="material-symbols-outlined text-sm">
                    {faqOpen.q2 ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {faqOpen.q2 && (
                  <p className="text-xs text-on-surface-variant mt-2 leading-relaxed font-medium">
                    {l.faq2A}
                  </p>
                )}
              </div>

              {/* Q3 */}
              <div className="pt-3.5">
                <button
                  onClick={() => toggleFaq('q3')}
                  className="w-full flex items-center justify-between text-left text-sm font-bold text-on-surface hover:text-primary transition-colors focus:outline-none"
                >
                  <span>{l.faq3Q}</span>
                  <span className="material-symbols-outlined text-sm">
                    {faqOpen.q3 ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {faqOpen.q3 && (
                  <p className="text-xs text-on-surface-variant mt-2 leading-relaxed font-medium">
                    {l.faq3A}
                  </p>
                )}
              </div>

            </div>
          </section>

        </div>
      </div>

      {/* Save Modal */}
      <ConfirmModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title={l.saveTitle}
        confirmText={lang === 'hi' ? 'जमा करने की पुष्टि करें' : 'Confirm Deposit'}
        cancelText={lang === 'hi' ? 'रद्द करें' : 'Cancel'}
        onConfirm={handleSaveSubmit}
        loading={actionLoading}
        variant="safe"
      >
        <div className="space-y-4 py-2 text-left">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {lang === 'hi' 
              ? 'कृपया वह राशि चुनें जिसे आप अपने सुरक्षित ब्लॉकचेन वॉल्ट में मैन्युअल रूप से जोड़ना चाहते हैं।'
              : 'Specify the savings amount you wish to manually transfer from your UPI account to your vault locker.'}
          </p>
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5">{lang === 'hi' ? 'राशि दर्ज करें' : 'Amount'}</label>
            <AmountInput
              value={saveAmount}
              onChange={setSaveAmount}
              min={10}
              max={200}
              placeholder="e.g. 50"
            />
            <span className="text-[10px] text-on-surface-variant mt-1.5 block font-bold">{l.minMaxSave}</span>
          </div>
        </div>
      </ConfirmModal>

      {/* Withdraw Modal */}
      <ConfirmModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        title={l.withdrawTitle}
        confirmText={lang === 'hi' ? 'निकासी की पुष्टि करें' : 'Confirm Withdrawal'}
        cancelText={lang === 'hi' ? 'रद्द करें' : 'Cancel'}
        onConfirm={handleWithdrawSubmit}
        loading={actionLoading}
        variant="danger"
      >
        <div className="space-y-4 py-2 text-left">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {lang === 'hi' 
              ? 'कृपया ध्यान दें: तिजोरी से की गई निकासी 60 सेकंड के भीतर आपके बैंक खाते में जमा हो जाएगी।'
              : 'Note: Withdrawals from the vault are processed instantly via UPI payouts and arrive within 60 seconds.'}
          </p>
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5">{lang === 'hi' ? 'राशि दर्ज करें' : 'Amount'}</label>
            <AmountInput
              value={withdrawAmount}
              onChange={setWithdrawAmount}
              min={100}
              placeholder="e.g. 500"
            />
            <span className="text-[10px] text-on-surface-variant mt-1.5 block font-bold">{l.minWithdraw}</span>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5">{lang === 'hi' ? 'प्राप्तकर्ता UPI ID' : 'Destination UPI ID'}</label>
            <input
              type="text"
              value={destinationUpi}
              onChange={(e) => setDestinationUpi(e.target.value)}
              placeholder="e.g. name@upi"
              className="input-premium font-mono text-sm"
              required
            />
          </div>
        </div>
      </ConfirmModal>

      {/* Settings rules Modal */}
      <ConfirmModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title={l.saveRulesTitle}
        confirmText={lang === 'hi' ? 'सेटिंग्स सुरक्षित करें' : 'Save Limits'}
        cancelText={lang === 'hi' ? 'रद्द करें' : 'Cancel'}
        onConfirm={handleUpdateSettings}
        loading={updatingSettings}
        variant="safe"
      >
        <div className="space-y-5 py-2 text-left">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-on-surface">
                {lang === 'hi' ? 'प्रति भुगतान बचत' : 'Save per transaction'}
              </label>
              <span className="text-xs font-black text-primary">{formatINR(savePerTx)}</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={savePerTx}
              onChange={(e) => setSavePerTx(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
      </ConfirmModal>

    </div>
  );
}
