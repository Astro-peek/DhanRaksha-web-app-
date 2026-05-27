import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { useAuth } from '../components/shared/AuthProvider';
import { useLanguageStore } from '../lib/languageStore';
import { useNudges } from '../hooks/useNudges';
import StatCard from '../components/shared/StatCard';
import { PageSkeleton } from '../components/shared/LoadingSkeleton';
import LanguageToggle from '../components/shared/LanguageToggle';
import RupeeProgressBar from '../components/shared/RupeeProgressBar';
import { formatINR } from '../lib/utils';
import { 
  Lock, 
  Users, 
  Coins, 
  Award, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles, 
  ChevronRight, 
  Info,
  TrendingUp,
  Percent,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, t } = useLanguageStore();
  const { nudges, dismissNudge, nudgeRef, refresh: refreshNudges } = useNudges();

  const [profile, setProfile] = useState(null);
  const [vaultAccount, setVaultAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  // Localized string fallbacks
  const l = {
    greeting: lang === 'hi' ? 'स्वागत है' : 'Welcome back',
    subtitle: lang === 'hi' ? 'विकेंद्रीकृत बचत और माइक्रोफाइनेंस सर्कल' : 'Decentralized savings and microfinance circle',
    vaultBalance: lang === 'hi' ? 'सुरक्षित वॉल्ट बैलेंस' : 'Secure Vault Balance',
    chitPool: lang === 'hi' ? 'सक्रिय चिट फंड पूल' : 'Active Chit Fund Pool',
    lendingIndex: lang === 'hi' ? 'लेंडिंग इंडेक्स' : 'P2P Lending Index',
    certificates: lang === 'hi' ? 'स्मार्ट सर्टिफिकेट' : 'Smart Certificates',
    recentActivity: lang === 'hi' ? 'हालिया ट्रस्ट लेनदेन' : 'Recent Trust Actions',
    viewLedger: lang === 'hi' ? 'बहीखाता देखें' : 'View Ledger',
    simulateTitle: lang === 'hi' ? 'ऑटो-सेव सिम्युलेटर (UPI)' : 'Auto-Save Simulator (UPI)',
    simulateDesc: lang === 'hi' ? 'Razorpay AutoPay को ट्रिगर करने और एक वास्तविक समय का अनुभव करने के लिए UPI क्रेडिट का अनुकरण करें।' : 'Simulate a UPI payment to trigger the Razorpay AutoPay mandate and see real-time vault credit in action.',
    simulateBtn: lang === 'hi' ? '₹20 UPI क्रेडिट का अनुकरण करें' : 'Simulate ₹20 UPI Credit',
    quickActions: lang === 'hi' ? 'त्वरित कार्रवाइयाँ' : 'Quick Actions',
    actionSave: lang === 'hi' ? 'वॉल्ट में पैसे बचाएं' : 'Save in Vault',
    actionChit: lang === 'hi' ? 'चिट फंड में शामिल हों' : 'Join Chit Circle',
    actionLoan: lang === 'hi' ? 'माइक्रो-लोन के लिए आवेदन करें' : 'Apply for Micro-Loan',
    actionCert: lang === 'hi' ? 'सर्टिफिकेट बनाएं' : 'Generate Certificate',
    yieldTitle: lang === 'hi' ? 'ब्याज/आय विश्लेषण' : 'Yield Breakdown',
    weightedApy: lang === 'hi' ? 'भारित APY' : 'Weighted APY',
    tutorialTitle: lang === 'hi' ? 'मार्गदर्शन की आवश्यकता है?' : 'Need Guidance?',
    tutorialDesc: lang === 'hi' ? 'ब्लॉकचेन चिट फंड और सुरक्षित वॉल्ट बचत के बारे में समझने के लिए हमारा इंटरैक्टिव ट्यूटोरियल शुरू करें।' : 'Explore how our decentralized multi-signature pools and blockchain ledgers protect and grow your money.',
    tutorialBtn: lang === 'hi' ? 'ट्यूटोरियल शुरू करें' : 'Start Tutorial',
    nudgeTitle: lang === 'hi' ? 'आपके लिए सूचनाएं' : 'Real-time Alerts & Nudges',
    vaultDesc: lang === 'hi' ? 'ब्लॉकचेन सुरक्षित कोलेटरल' : 'Blockchain backed collateral',
    chitDesc: lang === 'hi' ? 'मासिक चिट फंड चक्र' : 'Active chit fund circles',
    lendingDesc: lang === 'hi' ? 'ब्याज कमाने की दर' : 'Earn interest on credits',
    certDesc: lang === 'hi' ? 'सत्यापित स्मार्ट सर्टिफिकेट' : 'Verified agreements',
    noActivity: lang === 'hi' ? 'कोई हालिया लेनदेन नहीं मिला' : 'No recent transactions found'
  };

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/me');
      setProfile(res.data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  }, []);

  const fetchVaultAccount = useCallback(async () => {
    try {
      const res = await api.get('/api/vault/account');
      if (res.data?.success) {
        setVaultAccount(res.data.account);
      }
    } catch (err) {
      console.error('Error fetching vault account:', err);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await api.get('/api/vault/transactions?page=1&limit=5');
      if (res.data?.success) {
        setTransactions(res.data.transactions || []);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProfile(), fetchVaultAccount(), fetchTransactions()]);
    setLoading(false);
  }, [fetchProfile, fetchVaultAccount, fetchTransactions]);

  // Initial Data Fetch
  useEffect(() => {
    if (user?.id) {
      fetchAllData();
    }
  }, [user?.id, fetchAllData]);

  // Supabase Real-time Listener for Vault Transactions
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`db-vault-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vault_transactions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          toast.success(
            lang === 'hi' 
              ? `वास्तविक समय अपडेट: ₹${payload.new.amount} का लेनदेन सफल!`
              : `Real-time Update: Transaction of ₹${payload.new.amount} succeeded!`,
            { id: 'vault-realtime-update' }
          );
          fetchVaultAccount();
          fetchTransactions();
          refreshNudges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, lang, fetchVaultAccount, fetchTransactions, refreshNudges]);

  // Simulate UPI credit webhook call
  const handleSimulateUpiCredit = async () => {
    setSimulating(true);
    try {
      const res = await api.post('/api/vault/simulate-webhook');
      if (res.data?.success) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        
        const nudgeMsg = lang === 'hi' 
          ? res.data.nudge?.message_hi 
          : res.data.nudge?.message_en;
          
        toast.success(
          nudgeMsg || (lang === 'hi' ? 'सिम्युलेटेड UPI ऑटो-सेव सफल!' : 'Simulated UPI Auto-Save successful!'),
          { duration: 5000 }
        );
        
        fetchVaultAccount();
        fetchTransactions();
        refreshNudges();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Simulation failed. Ensure mandate status is active or pending.');
    } finally {
      setSimulating(false);
    }
  };

  const getUserTypeLabel = (type) => {
    switch (type) {
      case 'gig_worker': return lang === 'hi' ? 'गिग वर्कर' : 'Gig Worker';
      case 'chit_organiser': return lang === 'hi' ? 'चिट आयोजक' : 'Chit Organiser';
      case 'chit_member': return lang === 'hi' ? 'चिट सदस्य' : 'Chit Member';
      default: return lang === 'hi' ? 'मिश्रित प्रकार' : 'Mixed User';
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6 py-6">
      
      {/* Header section with Language Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-brand-dark tracking-tight">
              {l.greeting}, {profile?.name || user?.email || 'User'}
            </h1>
            {profile?.user_type && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                {getUserTypeLabel(profile.user_type)}
              </span>
            )}
          </div>
          <p className="text-sm text-brand-textMuted mt-1">
            {l.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
        </div>
      </div>

      {/* Nudges Section */}
      {nudges.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-card p-4 shadow-sm">
          <h2 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Sparkles size={14} className="animate-pulse text-amber-600" />
            {l.nudgeTitle}
          </h2>
          <div className="space-y-2">
            {nudges.map((nudge) => (
              <div
                key={nudge.id}
                ref={nudgeRef(nudge.id)}
                className="flex items-start justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-amber-100 dark:border-amber-950/40 shadow-sm transition-all duration-200"
              >
                <div className="flex-1 pr-4">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {lang === 'hi' ? nudge.message_hi : nudge.message_en}
                  </p>
                </div>
                <button
                  onClick={() => dismissNudge(nudge.id)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                  aria-label="Dismiss Alert"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financial Health Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/vault">
          <StatCard
            title={l.vaultBalance}
            value={formatINR(vaultAccount?.balance || 0)}
            icon={Lock}
            description={l.vaultDesc}
            className="hover:scale-[1.01] transition-transform"
          />
        </Link>
        <Link to="/chitfund">
          <StatCard
            title={l.chitPool}
            value={profile?.active_chit_count || 0}
            icon={Users}
            description={l.chitDesc}
            className="hover:scale-[1.01] transition-transform"
          />
        </Link>
        <Link to="/lending">
          <StatCard
            title={l.lendingIndex}
            value={lang === 'hi' ? '१२% प्रति वर्ष' : '12% p.a.'}
            icon={Coins}
            description={l.lendingDesc}
            className="hover:scale-[1.01] transition-transform"
          />
        </Link>
        <Link to="/certificate">
          <StatCard
            title={l.certificates}
            value={profile?.latest_certificate_status ? (lang === 'hi' ? 'सत्यापित' : 'Verified') : (lang === 'hi' ? 'कोई नहीं' : 'None')}
            icon={Award}
            description={l.certDesc}
            className="hover:scale-[1.01] transition-transform"
          />
        </Link>
      </div>

      {/* Main Grid: Simulator + Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Transactions & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Actions Panel */}
          <div className="premium-card p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-4">{l.quickActions}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => navigate('/vault')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 hover:border-brand-primary/30 hover:bg-slate-50/50 transition-all duration-200 text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Lock size={20} />
                </div>
                <span className="text-xs font-bold text-brand-textPrimary">{l.actionSave}</span>
              </button>

              <button
                onClick={() => navigate('/chitfund')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 hover:border-brand-secondary/30 hover:bg-slate-50/50 transition-all duration-200 text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-full bg-brand-secondary/10 text-brand-secondary flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Users size={20} />
                </div>
                <span className="text-xs font-bold text-brand-textPrimary">{l.actionChit}</span>
              </button>

              <button
                onClick={() => navigate('/lending')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50/50 transition-all duration-200 text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Coins size={20} />
                </div>
                <span className="text-xs font-bold text-brand-textPrimary">{l.actionLoan}</span>
              </button>

              <button
                onClick={() => navigate('/certificate')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-slate-50/50 transition-all duration-200 text-center group active:scale-95"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <Award size={20} />
                </div>
                <span className="text-xs font-bold text-brand-textPrimary">{l.actionCert}</span>
              </button>
            </div>
          </div>

          {/* Transactions List */}
          <div className="premium-card p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-brand-dark">{l.recentActivity}</h3>
                <p className="text-xs text-brand-textMuted">Audited history from your local ledger.</p>
              </div>
              <button 
                onClick={() => navigate('/vault')}
                className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-0.5"
              >
                {l.viewLedger} <ChevronRight size={14} />
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="py-8 text-center text-sm text-brand-textMuted">
                {l.noActivity}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        tx.direction === 'credit' 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' 
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                      }`}>
                        {tx.direction === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-textPrimary">
                          {tx.note || (tx.direction === 'credit' ? 'Vault Credit' : 'Vault Debit')}
                        </p>
                        <p className="text-[10px] text-brand-textMuted">
                          {new Date(tx.created_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        tx.direction === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-textPrimary'
                      }`}>
                        {tx.direction === 'credit' ? '+' : '-'}{formatINR(tx.amount)}
                      </p>
                      <span className="text-[9px] uppercase font-bold text-brand-secondary bg-brand-secondary/10 px-1.5 py-0.5 rounded-md">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: UPI Simulator & Portfolio */}
        <div className="space-y-6">
          
          {/* UPI Simulator Panel */}
          <div className="premium-card p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-900 border border-slate-200/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-brand-primary animate-ping" />
              <h3 className="text-md font-bold text-brand-dark">{l.simulateTitle}</h3>
            </div>
            <p className="text-xs text-brand-textMuted mb-5 leading-relaxed">
              {l.simulateDesc}
            </p>
            <button
              onClick={handleSimulateUpiCredit}
              disabled={simulating}
              className="w-full py-3 px-4 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-sm rounded-input shadow-md active:scale-98 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {simulating ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {l.simulateBtn}
            </button>
          </div>

          {/* Allocation Breakdown */}
          <div className="premium-card p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-4">{l.yieldTitle}</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-brand-textPrimary mb-1">
                  <span>{lang === 'hi' ? 'वॉल्ट आवंटन' : 'Vault Allocation'}</span>
                  <span>54%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-brand-primary h-full rounded-full" style={{ width: '54%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-brand-textPrimary mb-1">
                  <span>{lang === 'hi' ? 'चिट फंड बिड पूल' : 'Chit Fund Bid Pools'}</span>
                  <span>26%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-brand-secondary h-full rounded-full" style={{ width: '26%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-brand-textPrimary mb-1">
                  <span>{lang === 'hi' ? 'पी2पी लेंडिंग क्रेडिट' : 'P2P Lending Credits'}</span>
                  <span>20%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-brand-dark h-full rounded-full" style={{ width: '20%' }} />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 mt-6 pt-4 flex justify-between items-center text-xs">
              <span className="font-semibold text-brand-textMuted">{l.weightedApy}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Percent size={14} />
                12.35% {lang === 'hi' ? 'वार्षिक' : 'Year'}
              </span>
            </div>
          </div>

          {/* Quick Guidance Tutorial */}
          <div className="premium-card p-6 bg-brand-dark text-white relative overflow-hidden">
            <div className="absolute right-0 bottom-0 w-24 h-24 rounded-full bg-brand-secondary/20 blur-xl pointer-events-none" />
            <h3 className="text-md font-bold mb-2 flex items-center gap-1.5">
              <Info size={16} />
              {l.tutorialTitle}
            </h3>
            <p className="text-xs text-white/70 mb-4 leading-relaxed">
              {l.tutorialDesc}
            </p>
            <button
              onClick={() => navigate('/vault')}
              className="w-full py-2.5 px-4 bg-brand-secondary hover:bg-brand-secondary/90 text-white font-bold text-xs rounded-input transition-all duration-200 active:scale-95 shadow-md"
            >
              {l.tutorialBtn}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
