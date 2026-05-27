import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { useAuth } from '../components/shared/AuthProvider';
import { useLanguageStore } from '../lib/languageStore';
import AmountInput from '../components/shared/AmountInput';
import ConfirmModal from '../components/shared/ConfirmModal';
import { formatINR } from '../lib/utils';
import { 
  Lock, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles, 
  Info, 
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Settings,
  AlertCircle,
  Plus,
  Minus,
  CheckCircle2,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';
import useSWR from 'swr';
import { useVaultRealtime } from '../hooks/useRealtime';
import { withOfflineQueue } from '../lib/offlineQueue';

export default function Vault() {
  const { user } = useAuth();
  const { lang, t } = useLanguageStore();

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

  // Settings Panel States
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
    title: lang === 'hi' ? 'सुरक्षित बचत वॉल्ट' : 'Decentralized Vault',
    subtitle: lang === 'hi' ? 'Razorpay और ब्लॉकचेन द्वारा सुरक्षित स्वचालित बचत लॉकर।' : 'Automated savings locker secured by UPI mandates & verified on-chain.',
    totalSaved: lang === 'hi' ? 'कुल संचित बचत' : 'Total Saved Balance',
    dailySavings: lang === 'hi' ? 'आज की बचत सीमा' : 'Daily Savings Limit',
    savedToday: lang === 'hi' ? 'आज की कुल बचत' : 'Saved Today',
    mandateActive: lang === 'hi' ? 'ऑटो-पे सक्रिय' : 'Auto-Save Active',
    mandatePending: lang === 'hi' ? 'ऑटो-पे लंबित' : 'Auto-Pay Pending',
    mandateInactive: lang === 'hi' ? 'ऑटो-पे निष्क्रिय' : 'Auto-Pay Inactive',
    settingsBtn: lang === 'hi' ? 'बचत सेटिंग्स' : 'Savings Settings',
    saveBtn: lang === 'hi' ? 'मैन्युअल जमा' : 'Save Money',
    withdrawBtn: lang === 'hi' ? 'पैसे निकालें' : 'Withdraw Funds',
    saveTitle: lang === 'hi' ? 'वॉल्ट में पैसे जमा करें' : 'Deposit to Vault',
    withdrawTitle: lang === 'hi' ? 'वॉल्ट से पैसे निकालें' : 'Withdraw from Vault',
    minMaxSave: lang === 'hi' ? 'न्यूनतम ₹10, अधिकतम ₹200' : 'Min ₹10, Max ₹200',
    minWithdraw: lang === 'hi' ? 'न्यूनतम ₹100' : 'Minimum ₹100',
    recentTx: lang === 'hi' ? 'लेनदेन का इतिहास' : 'Transaction History',
    noTx: lang === 'hi' ? 'कोई लेनदेन नहीं मिला' : 'No transactions recorded yet.',
    mandateSetupTitle: lang === 'hi' ? 'UPI ऑटो-पे सेटअप करें' : 'Set Up UPI AutoPay',
    mandateSetupDesc: lang === 'hi' ? 'दैनिक बचत को स्वचालित करने के लिए ऑटो-पे जनादेश सेट करें।' : 'Enable friction-free automated savings by creating a secure UPI AutoPay mandate.',
    enterUpiId: lang === 'hi' ? 'अपना UPI ID दर्ज करें' : 'Enter your UPI ID',
    initiateMandate: lang === 'hi' ? 'जनादेश शुरू करें' : 'Initiate Mandate',
    openRazorpay: lang === 'hi' ? 'Razorpay पर प्रमाणित करें' : 'Authorize on Razorpay',
    pollMessage: lang === 'hi' ? 'ऑटो-पे सक्रिय होने की प्रतीक्षा की जा रही है...' : 'Waiting for mandate activation status...',
    mandateSuccess: lang === 'hi' ? 'ऑटो-पे सफलतापूर्वक सक्रिय किया गया! 🎉' : 'AutoPay Mandate Successfully Activated! 🎉',
    faqTitle: lang === 'hi' ? 'अक्सर पूछे जाने वाले प्रश्न' : 'Frequently Asked Questions',
    faq1Q: lang === 'hi' ? '१. क्या यह पूरी तरह से सुरक्षित है?' : '1. Is this system completely secure?',
    faq1A: lang === 'hi' ? 'हाँ। आपका पैसा सीधे रिजर्व बैंक (RBI) द्वारा लाइसेंस प्राप्त ट्रस्ट खातों में रहता है। प्रत्येक लेनदेन ब्लॉकचेन पर दर्ज होता है।' : 'Yes. Your funds are secured in RBI-regulated trustee accounts with smart contract logic, and every single event is audited and written on the public Polygon blockchain ledger.',
    faq2Q: lang === 'hi' ? '२. ऑटो-सेव (Auto-Save) कैसे काम करता है?' : '2. How does Auto-Save work?',
    faq2A: lang === 'hi' ? 'जब आप सामान्य खर्च करते हैं, तो आपका चुना हुआ अमाउंट (उदा. ₹20) आपके UPI खाते से स्वचालित रूप से कटकर इस तिजोरी में जमा हो जाता है।' : 'Whenever you make digital transactions, our system auto-debits your chosen round-up or save amount (e.g. ₹20) from your UPI account up to your daily limits, moving it into your high-yield secure locker.',
    faq3Q: lang === 'hi' ? '३. मैं अपने पैसे कब निकाल सकता हूँ?' : '3. When can I withdraw my funds?',
    faq3A: lang === 'hi' ? 'आप कभी भी पैसे निकाल सकते हैं। पैसा तुरंत ६० सेकंड के भीतर आपके लिंक्ड UPI पते पर वापस भेज दिया जाता है।' : 'You can withdraw your entire savings at any moment. Withdrawals are processed instantly and credited to your destination UPI ID within 60 seconds.',
    calcTitle: lang === 'hi' ? 'दैनिक बचत का अनुमान' : 'Estimated Savings Tool',
    calcDesc: lang === 'hi' ? 'यदि आप प्रति दिन औसतन ५ डिजिटल भुगतान करते हैं:' : 'If you make an average of 5 digital UPI payments per day:',
    calcWeekly: lang === 'hi' ? 'साप्ताहिक बचत' : 'Weekly Savings',
    calcMonthly: lang === 'hi' ? 'मासिक बचत' : 'Monthly Savings',
    calcYearly: lang === 'hi' ? 'वार्षिक बचत (१०% अनुमानित ब्याज के साथ)' : 'Yearly Savings (with 10% expected compound)'
  };

  // Call Realtime Hook
  useVaultRealtime(user?.id);

  // SWR Caching
  const fetcher = (url) => api.get(url).then(r => r.data);
  const { data: swrData, error: swrErr, mutate } = useSWR(
    user?.id ? `/api/vault/account?userId=${user.id}` : null,
    fetcher,
    {
      refreshInterval: 30000,
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
      toast.error(err.response?.data?.error || 'Failed to initialize mandate checkout.');
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
      toast.error(err.response?.data?.error || 'Failed to complete savings transaction.');
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
            ? `निकासी शुरू! आपके खाते में लगभग ६० सेकंड में ₹${amountNum} प्राप्त होंगे।`
            : `Withdrawal initiated! You will receive ₹${amountNum} in approximately 60 seconds.`,
          { duration: 5000 }
        );
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        mutate();
        fetchTransactions(1, false);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Withdrawal failed. Check balance or input fields.');
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

  // Toggle FAQ Accordions
  const toggleFaq = (key) => {
    setFaqOpen(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Render SVG circular progress ring
  const getProgressCircle = () => {
    const todaySaved = account?.daily_saved_today || 0;
    const limit = account?.daily_limit || 500;
    const percentage = Math.min(Math.round((todaySaved / limit) * 100), 100);
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const strokeOffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-card border border-slate-100 dark:border-slate-800 shadow-premium relative">
        <svg className="w-36 h-36 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-slate-100 dark:stroke-slate-850 fill-transparent"
            strokeWidth="10"
          />
          {/* Progress circle */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-brand-primary fill-transparent transition-all duration-500 ease-out"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-black text-brand-dark">{percentage}%</span>
          <span className="text-[10px] font-bold text-brand-textMuted uppercase">{lang === 'hi' ? 'आज की सीमा' : 'Limit Used'}</span>
        </div>
        <div className="mt-4 text-center">
          <p className="text-xs font-bold text-brand-textMuted">{l.savedToday}</p>
          <p className="text-lg font-black text-brand-textPrimary mt-0.5">{formatINR(todaySaved)} / {formatINR(limit)}</p>
        </div>
      </div>
    );
  };

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6 py-6">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-brand-dark tracking-tight">
            {l.title}
          </h1>
          <p className="text-sm text-brand-textMuted mt-1">
            {l.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {account?.mandate_status === 'active' && (
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-input transition-all duration-200 active:scale-95"
            >
              <Settings size={14} />
              {l.settingsBtn}
            </button>
          )}
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input shadow-md active:scale-95 transition-all duration-200"
          >
            {l.saveBtn}
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="px-4 py-2 bg-brand-dark hover:bg-brand-dark/95 text-white font-bold text-xs rounded-input shadow-md active:scale-95 transition-all duration-200"
          >
            {l.withdrawBtn}
          </button>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Mandate / Settings + Circle + Calculator */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Top row inside left: circular progress ring + balance details card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Balance Card */}
            <div className="md:col-span-2 premium-card p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-0 top-0 w-36 h-36 rounded-full bg-brand-primary/5 blur-xl pointer-events-none" />
              <div>
                <span className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl inline-block mb-4">
                  <Lock size={24} />
                </span>
                <p className="text-xs font-bold text-brand-textMuted uppercase tracking-wider">{l.totalSaved}</p>
                <h2 className="text-3xl md:text-4xl font-black text-brand-textPrimary mt-1">
                  {formatINR(account?.balance || 0)}
                </h2>
              </div>
              <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    account?.mandate_status === 'active' ? 'bg-emerald-500' : account?.mandate_status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                  }`} />
                  <span className="text-xs font-semibold text-brand-textPrimary">
                    {account?.mandate_status === 'active' ? l.mandateActive : account?.mandate_status === 'pending' ? l.mandatePending : l.mandateInactive}
                  </span>
                </div>
                {account?.razorpay_mandate_id && (
                  <span className="text-[10px] text-brand-textMuted font-mono ml-auto">
                    ID: {account.razorpay_mandate_id}
                  </span>
                )}
              </div>
            </div>

            {/* Circular Progress Ring */}
            {getProgressCircle()}
          </div>

          {/* Stepper setup for inactive mandates */}
          {(!account?.mandate_status || account?.mandate_status === 'inactive' || account?.mandate_status === 'pending') && (
            <div className="premium-card p-6 border-brand-primary/10">
              <div className="flex items-start gap-3.5 mb-5">
                <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-lg mt-0.5">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-md font-bold text-brand-dark">{l.mandateSetupTitle}</h3>
                  <p className="text-xs text-brand-textMuted mt-0.5">{l.mandateSetupDesc}</p>
                </div>
              </div>

              {/* Step indicator */}
              <div className="flex items-center justify-between mb-6 max-w-md mx-auto">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    mandateStep >= 1 ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-400'
                  }`}>1</div>
                  <span className="text-xs font-bold text-brand-textPrimary">UPI ID</span>
                </div>
                <div className="h-0.5 bg-slate-200 flex-1 mx-2" />
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    mandateStep >= 2 ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-400'
                  }`}>2</div>
                  <span className="text-xs font-bold text-brand-textPrimary">{lang === 'hi' ? 'प्रमाणीकृत' : 'Authorize'}</span>
                </div>
                <div className="h-0.5 bg-slate-200 flex-1 mx-2" />
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    mandateStep >= 3 ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-400'
                  }`}>3</div>
                  <span className="text-xs font-bold text-brand-textPrimary">{lang === 'hi' ? 'पूर्ण' : 'Active'}</span>
                </div>
              </div>

              {/* Stepper Content */}
              {mandateStep === 1 && (
                <form onSubmit={handleSetupMandate} className="max-w-md mx-auto space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{l.enterUpiId}</label>
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
                    className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input active:scale-98 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {submittingMandate ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {l.initiateMandate} <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {mandateStep === 2 && (
                <div className="max-w-md mx-auto text-center space-y-4 py-3">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
                  <p className="text-xs font-medium text-brand-textPrimary leading-relaxed">
                    {lang === 'hi' 
                      ? 'जनादेश स्वीकृत करने के लिए नीचे दिए गए बटन पर क्लिक करें और Razorpay सुरक्षित पेमेंट गेटवे पर भुगतान पूरा करें।'
                      : 'Please authorize the subscription checkout on Razorpay by opening the secure window below. Confirming the mandate sets up automated credits.'}
                  </p>
                  
                  <div className="flex flex-col gap-2">
                    <a
                      href={shortUrl || account?.razorpay_mandate_id ? `https://rzp.io/i/${account?.razorpay_mandate_id}` : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      {l.openRazorpay} <ExternalLink size={14} />
                    </a>
                    
                    <span className="text-[10px] text-brand-textMuted flex items-center justify-center gap-1 mt-1">
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
            <div className="premium-card p-6 bg-slate-50/50 dark:bg-slate-900/30">
              <h3 className="text-md font-bold text-brand-dark flex items-center gap-2">
                <Sparkles size={16} className="text-brand-primary" />
                {l.calcTitle}
              </h3>
              <p className="text-xs text-brand-textMuted mt-1">{l.calcDesc}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="text-[10px] font-bold text-brand-textMuted uppercase">{l.calcWeekly}</span>
                  <p className="text-lg font-black text-brand-dark mt-1">{formatINR(savePerTx * 5 * 7)}</p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="text-[10px] font-bold text-brand-textMuted uppercase">{l.calcMonthly}</span>
                  <p className="text-lg font-black text-brand-dark mt-1">{formatINR(savePerTx * 5 * 30)}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-brand-primary/10 to-brand-secondary/5 border border-brand-primary/10 rounded-xl">
                  <span className="text-[10px] font-bold text-brand-primary uppercase">{l.calcYearly}</span>
                  <p className="text-lg font-black text-brand-primary mt-1">
                    {formatINR((savePerTx * 5 * 365) * 1.1)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div className="premium-card p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-4">{l.recentTx}</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-brand-textMuted text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="text-brand-textPrimary hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3.5 font-semibold flex items-center gap-2">
                        {tx.direction === 'credit' 
                          ? <ArrowDownLeft size={14} className="text-emerald-500" />
                          : <ArrowUpRight size={14} className="text-rose-500" />
                        }
                        {tx.note || (tx.direction === 'credit' ? 'Savings Deposit' : 'Withdrawal Payout')}
                      </td>
                      <td className="py-3.5 font-bold">{formatINR(tx.amount)}</td>
                      <td className="py-3.5 text-xs text-brand-textMuted font-medium capitalize">
                        {String(tx.trigger_type).replace('_', ' ')}
                      </td>
                      <td className="py-3.5 text-xs text-brand-textMuted">
                        {new Date(tx.created_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                      </td>
                      <td className="py-3.5 text-right">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          tx.status === 'success' 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' 
                            : tx.status === 'pending' 
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20' 
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {transactions.length === 0 && (
                <div className="py-8 text-center text-sm text-brand-textMuted">
                  {l.noTx}
                </div>
              )}
              
              {/* Load More scroll target */}
              {hasMore && (
                <div ref={loadMoreRef} className="py-4 flex justify-center">
                  {loadingMore ? (
                    <span className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-xs text-brand-textMuted font-semibold">Scroll to load more</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: FAQ Accordion */}
        <div className="space-y-6">
          
          {/* FAQ Accordion block */}
          <div className="premium-card p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
              <HelpCircle size={18} className="text-brand-primary" />
              {l.faqTitle}
            </h3>
            
            <div className="space-y-3.5 divide-y divide-slate-100 dark:divide-slate-800">
              
              {/* Q1 */}
              <div className="pt-3.5 first:pt-0">
                <button
                  onClick={() => toggleFaq('q1')}
                  className="w-full flex items-center justify-between text-left text-sm font-bold text-brand-textPrimary hover:text-brand-primary transition-colors focus:outline-none"
                >
                  <span>{l.faq1Q}</span>
                  {faqOpen.q1 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {faqOpen.q1 && (
                  <p className="text-xs text-brand-textMuted mt-2 leading-relaxed">
                    {l.faq1A}
                  </p>
                )}
              </div>

              {/* Q2 */}
              <div className="pt-3.5">
                <button
                  onClick={() => toggleFaq('q2')}
                  className="w-full flex items-center justify-between text-left text-sm font-bold text-brand-textPrimary hover:text-brand-primary transition-colors focus:outline-none"
                >
                  <span>{l.faq2Q}</span>
                  {faqOpen.q2 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {faqOpen.q2 && (
                  <p className="text-xs text-brand-textMuted mt-2 leading-relaxed">
                    {l.faq2A}
                  </p>
                )}
              </div>

              {/* Q3 */}
              <div className="pt-3.5">
                <button
                  onClick={() => toggleFaq('q3')}
                  className="w-full flex items-center justify-between text-left text-sm font-bold text-brand-textPrimary hover:text-brand-primary transition-colors focus:outline-none"
                >
                  <span>{l.faq3Q}</span>
                  {faqOpen.q3 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {faqOpen.q3 && (
                  <p className="text-xs text-brand-textMuted mt-2 leading-relaxed">
                    {l.faq3A}
                  </p>
                )}
              </div>

            </div>
          </div>
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
          <p className="text-xs text-brand-textMuted leading-relaxed">
            {lang === 'hi' 
              ? 'कृपया वह राशि चुनें जिसे आप अपने सुरक्षित ब्लॉकचेन वॉल्ट में मैन्युअल रूप से जोड़ना चाहते हैं।'
              : 'Specify the savings amount you wish to manually transfer from your UPI account to your vault locker.'}
          </p>
          <div>
            <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{lang === 'hi' ? 'राशि दर्ज करें' : 'Amount'}</label>
            <AmountInput
              value={saveAmount}
              onChange={setSaveAmount}
              min={10}
              max={200}
              placeholder="e.g. 50"
            />
            <span className="text-[10px] text-brand-textMuted mt-1 block">{l.minMaxSave}</span>
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
          <p className="text-xs text-brand-textMuted leading-relaxed">
            {lang === 'hi' 
              ? 'कृपया ध्यान दें: तिजोरी से की गई निकासी ६० सेकंड के भीतर आपके बैंक खाते में जमा हो जाएगी।'
              : 'Note: Withdrawals from the vault are processed instantly via UPI payouts and arrive within 60 seconds.'}
          </p>
          <div>
            <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{lang === 'hi' ? 'राशि दर्ज करें' : 'Amount'}</label>
            <AmountInput
              value={withdrawAmount}
              onChange={setWithdrawAmount}
              min={100}
              placeholder="e.g. 500"
            />
            <span className="text-[10px] text-brand-textMuted mt-1 block">{l.minWithdraw}</span>
          </div>
          <div>
            <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{lang === 'hi' ? 'प्राप्तकर्ता UPI ID' : 'Destination UPI ID'}</label>
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

      {/* Settings Modal */}
      <ConfirmModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title={l.settingsBtn}
        confirmText={lang === 'hi' ? 'सेटिंग्स सुरक्षित करें' : 'Save Limits'}
        cancelText={lang === 'hi' ? 'रद्द करें' : 'Cancel'}
        onConfirm={handleUpdateSettings}
        loading={updatingSettings}
        variant="safe"
      >
        <div className="space-y-5 py-2 text-left">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-brand-textPrimary">
                {lang === 'hi' ? 'प्रति भुगतान बचत' : 'Save per transaction'}
              </label>
              <span className="text-xs font-black text-brand-primary">{formatINR(savePerTx)}</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={savePerTx}
              onChange={(e) => setSavePerTx(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
            />
            <span className="text-[9px] text-brand-textMuted mt-1 block">Min ₹10 - Max ₹200</span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-brand-textPrimary">
                {lang === 'hi' ? 'दैनिक बचत सीमा' : 'Daily savings limit'}
              </label>
              <span className="text-xs font-black text-brand-primary">{formatINR(dailyLimit)}</span>
            </div>
            <input
              type="range"
              min="100"
              max="2000"
              step="50"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
            />
            <span className="text-[9px] text-brand-textMuted mt-1 block">Min ₹100 - Max ₹2,000</span>
          </div>
        </div>
      </ConfirmModal>

    </div>
  );
}
