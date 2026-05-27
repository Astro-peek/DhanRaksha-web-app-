import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { useAuth } from '../components/shared/AuthProvider';
import { useLanguageStore } from '../lib/languageStore';
import { useNudges } from '../hooks/useNudges';
import { PageSkeleton } from '../components/shared/LoadingSkeleton';
import LanguageToggle from '../components/shared/LanguageToggle';
import { asDisplayText, formatINR, getErrorMessage } from '../lib/utils';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang } = useLanguageStore();
  const { nudges, dismissNudge, nudgeRef, refresh: refreshNudges } = useNudges();

  const [profile, setProfile] = useState({ name: asDisplayText(user?.email, 'Rohan') });
  const [vaultAccount, setVaultAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  // Localized strings
  const l = {
    greeting: lang === 'hi' ? 'नमस्ते' : 'Hello',
    subtitle: lang === 'hi' ? 'आज के लिए आपका वित्तीय विकास सारांश।' : 'Here\'s your financial growth summary for today.',
    vaultBalance: lang === 'hi' ? 'कुल बचत शेष' : 'Total Savings Balance',
    vsLastMonth: lang === 'hi' ? 'पिछले महीने की तुलना में +12.5%' : '+12.5% vs last month',
    activeChit: lang === 'hi' ? 'सक्रिय चिट फंड' : 'Chit Funds',
    activeCount: lang === 'hi' ? 'सक्रिय' : 'Active',
    viewChitDetails: lang === 'hi' ? 'चिट विवरण देखें' : 'View Chit Details',
    quickActions: lang === 'hi' ? 'त्वरित कार्रवाइयाँ' : 'Quick Actions',
    actionSave: lang === 'hi' ? 'स्मार्ट वॉल्ट' : 'Smart Vault',
    actionChit: lang === 'hi' ? 'चिट सर्कल' : 'Chit Circle',
    actionLoan: lang === 'hi' ? 'लेंडिंग सेंटर' : 'Lending Center',
    actionCert: lang === 'hi' ? 'सर्टिफिकेट्स' : 'Certificates',
    recentActivity: lang === 'hi' ? 'हालिया लेनदेन' : 'Recent Transactions',
    viewLedger: lang === 'hi' ? 'सभी देखें' : 'See All',
    simulateTitle: lang === 'hi' ? 'ऑटो-सेव सिम्युलेटर (UPI)' : 'Auto-Save Simulator (UPI)',
    simulateDesc: lang === 'hi' ? 'Razorpay AutoPay को ट्रिगर करने और रीयल-टाइम क्रेडिट देखने के लिए UPI क्रेडिट का अनुकरण करें।' : 'Simulate a UPI payment to trigger the Razorpay AutoPay mandate and see real-time vault credit in action.',
    simulateBtn: lang === 'hi' ? '₹20 UPI क्रेडिट सिम्युलेट करें' : 'Simulate ₹20 UPI Credit',
    yieldTitle: lang === 'hi' ? 'ब्याज/आय ब्रेकडाउन' : 'Yield Breakdown',
    weightedApy: lang === 'hi' ? 'भारित APY' : 'Weighted APY',
    tutorialTitle: lang === 'hi' ? 'मार्गदर्शन चाहिए?' : 'Need Guidance?',
    tutorialDesc: lang === 'hi' ? 'हमारे ब्लॉकचेन चिट फंड और ऑटो-सेव तिजोरी के कार्य करने के तरीके को समझें।' : 'Explore how our decentralized multi-signature pools and blockchain ledgers protect and grow your money.',
    tutorialBtn: lang === 'hi' ? 'ट्यूटोरियल शुरू करें' : 'Start Tutorial',
    nudgeTitle: lang === 'hi' ? 'महत्वपूर्ण सूचनाएं' : 'Alerts & Nudges',
    noActivity: lang === 'hi' ? 'कोई हालिया लेनदेन नहीं मिला' : 'No recent transactions found',
    vaultAlloc: lang === 'hi' ? 'वॉल्ट आवंटन' : 'Vault Allocation',
    chitAlloc: lang === 'hi' ? 'चिट फंड बिड पूल' : 'Chit Fund Bid Pools',
    lendAlloc: lang === 'hi' ? 'पी2पी क्रेडिट' : 'P2P Lending Credits',
    yearly: lang === 'hi' ? 'प्रति वर्ष' : 'p.a.'
  };

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/me');
      const data = res?.data && typeof res.data === 'object' ? res.data : {};
      setProfile({
        ...data,
        name: asDisplayText(data.name, asDisplayText(user?.email, 'Rohan')),
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  }, [user?.email]);

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
      toast.error(getErrorMessage(err, 'Simulation failed. Ensure mandate status is active or pending.'));
    } finally {
      setSimulating(false);
    }
  };

  const getTxIcon = (triggerType) => {
    switch (triggerType) {
      case 'fuel': return 'local_gas_station';
      case 'auto_save': return 'savings';
      case 'payout': return 'directions_car';
      default: return 'payments';
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-1 md:px-2 py-4">
      {/* Top Banner section with Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-headline-lg-mobile md:text-headline-lg font-extrabold text-on-background flex items-center gap-2">
            {l.greeting}, {profile?.name || user?.email || 'Rohan'} 👋
          </h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            {l.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
        </div>
      </div>

      {/* Nudges Section */}
      {nudges.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-stack-md shadow-sm">
          <h2 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] animate-pulse text-amber-600">notifications_active</span>
            {l.nudgeTitle}
          </h2>
          <div className="space-y-2">
            {nudges.map((nudge) => (
              <div
                key={nudge.id}
                ref={nudgeRef(nudge.id)}
                className="flex items-start justify-between bg-white p-3 rounded-xl border border-amber-100 shadow-sm transition-all duration-200"
              >
                <div className="flex-1 pr-4">
                  <p className="text-sm font-semibold text-gray-800">
                    {asDisplayText(lang === 'hi' ? nudge.message_hi : nudge.message_en, 'New notification')}
                  </p>
                </div>
                <button
                  onClick={() => dismissNudge(nudge.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  aria-label="Dismiss Alert"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        
        {/* Main Balance Card (cols 8) */}
        <div className="lg:col-span-8 bg-primary-container text-on-primary rounded-3xl p-stack-lg shadow-lg relative overflow-hidden flex flex-col justify-between h-64 group">
          <div className="relative z-10">
            <p className="text-xs font-bold opacity-80 mb-2 uppercase tracking-wider">{l.vaultBalance}</p>
            <h3 className="text-display-lg font-black tracking-tight">
              {formatINR(vaultAccount?.balance || 0)}
            </h3>
            <div className="flex items-center gap-2 mt-4 bg-white/10 w-fit px-3 py-1 rounded-full border border-white/20">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span className="text-xs font-bold">{l.vsLastMonth}</span>
            </div>
          </div>
          {/* Decorative pattern */}
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-primary rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute right-8 top-8 opacity-20 group-hover:scale-110 transition-transform duration-300">
            <span className="material-symbols-outlined text-[120px] filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
          </div>
        </div>

        {/* Active Chit Fund Summary Card (cols 4) */}
        <div className="lg:col-span-4 bg-surface rounded-3xl p-stack-lg border border-outline-variant shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <h4 className="text-headline-md font-bold text-on-surface">{l.activeChit}</h4>
            <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-bold">
              {profile?.active_chit_count || 0} {l.activeCount}
            </span>
          </div>
          <div className="space-y-4">
            <div className="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/60">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-bold text-on-surface">SafeKosh Circles</span>
                <span className="text-primary font-extrabold text-xs">Active Pool</span>
              </div>
              <div className="w-full bg-outline-variant h-2 rounded-full overflow-hidden">
                <div className="bg-secondary h-full rounded-full" style={{ width: '65%' }}></div>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-on-surface-variant">Rotating Escrows</span>
                <span className="text-[10px] text-on-surface-variant">Verified</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => navigate('/chitfund')}
            className="mt-auto text-primary text-xs font-bold flex items-center gap-0.5 hover:underline text-left cursor-pointer"
          >
            {l.viewChitDetails} <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        {/* Quick Actions Panel (cols 4) */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/vault')}
            className="bg-surface-container-high rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all cursor-pointer active:scale-95 text-left border border-outline-variant/30"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>lock_person</span>
            </div>
            <span className="text-xs font-bold text-on-surface">{l.actionSave}</span>
          </button>

          <button
            onClick={() => navigate('/chitfund')}
            className="bg-surface-container-high rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all cursor-pointer active:scale-95 text-left border border-outline-variant/30"
          >
            <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>handshake</span>
            </div>
            <span className="text-xs font-bold text-on-surface">{l.actionChit}</span>
          </button>

          <button
            onClick={() => navigate('/lending')}
            className="bg-surface-container-high rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all cursor-pointer active:scale-95 text-left border border-outline-variant/30"
          >
            <div className="w-10 h-10 bg-tertiary-container/10 rounded-xl flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
            </div>
            <span className="text-xs font-bold text-on-surface">{l.actionLoan}</span>
          </button>

          <button
            onClick={() => navigate('/certificate')}
            className="bg-surface-container-high rounded-2xl p-4 flex flex-col gap-3 hover:shadow-md transition-all cursor-pointer active:scale-95 text-left border border-outline-variant/30"
          >
            <div className="w-10 h-10 bg-error/10 rounded-xl flex items-center justify-center text-error">
              <span className="material-symbols-outlined filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>emergency_home</span>
            </div>
            <span className="text-xs font-bold text-on-surface">{l.actionCert}</span>
          </button>
        </div>

        {/* Recent Transactions Card (cols 8) */}
        <div className="lg:col-span-8 bg-surface rounded-3xl p-stack-lg border border-outline-variant shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className="text-headline-md font-bold text-on-surface">{l.recentActivity}</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">Audited history from your local ledger.</p>
              </div>
              <button 
                onClick={() => navigate('/vault')}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                {l.viewLedger}
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="py-8 text-center text-sm text-on-surface-variant">
                {l.noActivity}
              </div>
            ) : (
              <div className="space-y-1">
                {transactions.map((tx) => (
                  <div 
                    key={tx.id} 
                    className="flex items-center justify-between p-3.5 hover:bg-surface-container-low rounded-2xl transition-colors border-b border-outline-variant last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-surface-variant rounded-full flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">{getTxIcon(tx.trigger_type)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">
                          {asDisplayText(tx.note, tx.direction === 'credit' ? 'Vault Credit' : 'Vault Debit')}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">
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
                      <p className={`text-sm font-black ${
                        tx.direction === 'credit' ? 'text-secondary' : 'text-on-surface'
                      }`}>
                        {tx.direction === 'credit' ? '+' : '-'}{formatINR(tx.amount)}
                      </p>
                      <span className="text-[9px] uppercase font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                        {asDisplayText(tx.status, 'success')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* UPI Simulator Panel (cols 4) */}
        <div className="lg:col-span-4 bg-surface rounded-3xl p-stack-lg border border-outline-variant shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
              <h3 className="text-sm font-bold text-on-surface">{l.simulateTitle}</h3>
            </div>
            <p className="text-xs text-on-surface-variant mb-5 leading-relaxed">
              {l.simulateDesc}
            </p>
          </div>
          <button
            onClick={handleSimulateUpiCredit}
            disabled={simulating}
            className="w-full py-3 px-4 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl shadow-md active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
          >
            {simulating ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[16px]">bolt</span>
            )}
            {l.simulateBtn}
          </button>
        </div>

        {/* Allocation Breakdown (cols 4) */}
        <div className="lg:col-span-4 bg-surface rounded-3xl p-stack-lg border border-outline-variant shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-on-surface mb-4">{l.yieldTitle}</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-on-surface mb-1">
                  <span>{l.vaultAlloc}</span>
                  <span>54%</span>
                </div>
                <div className="w-full bg-outline-variant/30 h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '54%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-on-surface mb-1">
                  <span>{l.chitAlloc}</span>
                  <span>26%</span>
                </div>
                <div className="w-full bg-outline-variant/30 h-2 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '26%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-on-surface mb-1">
                  <span>{l.lendAlloc}</span>
                  <span>20%</span>
                </div>
                <div className="w-full bg-outline-variant/30 h-2 rounded-full overflow-hidden">
                  <div className="bg-tertiary h-full rounded-full" style={{ width: '20%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-outline-variant/35 mt-6 pt-4 flex justify-between items-center text-xs">
            <span className="font-bold text-on-surface-variant">{l.weightedApy}</span>
            <span className="font-black text-secondary flex items-center gap-0.5">
              12.35% {l.yearly}
            </span>
          </div>
        </div>

        {/* Quick Guidance Tutorial (cols 4) */}
        <div className="lg:col-span-4 bg-primary text-on-primary rounded-3xl p-stack-lg relative overflow-hidden flex flex-col justify-between h-56">
          <div className="absolute right-0 bottom-0 w-24 h-24 rounded-full bg-secondary/20 blur-xl pointer-events-none" />
          <div>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">info</span>
              {l.tutorialTitle}
            </h3>
            <p className="text-xs text-white/70 leading-relaxed mb-4">
              {l.tutorialDesc}
            </p>
          </div>
          <button
            onClick={() => navigate('/vault')}
            className="w-full py-2.5 px-4 bg-secondary hover:bg-secondary/90 text-white font-bold text-xs rounded-xl transition-all duration-200 active:scale-95 shadow-md cursor-pointer"
          >
            {l.tutorialBtn}
          </button>
        </div>

      </div>
    </div>
  );
}
