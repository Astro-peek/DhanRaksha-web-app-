import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { useAuth } from '../components/shared/AuthProvider';
import { useLanguageStore } from '../lib/languageStore';
import CopyButton from '../components/shared/CopyButton';
import BlockchainBadge from '../components/shared/BlockchainBadge';
import StatusBadge from '../components/shared/StatusBadge';
import RupeeProgressBar from '../components/shared/RupeeProgressBar';
import ConfirmModal from '../components/shared/ConfirmModal';
import { formatINR } from '../lib/utils';
import { 
  Users, 
  Calendar, 
  ArrowLeft, 
  TrendingUp, 
  Info, 
  Award, 
  Coins, 
  ShieldCheck, 
  Download, 
  Play, 
  CheckCircle,
  Copy,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';

export default function ChitGroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, t } = useLanguageStore();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [bids, setBids] = useState([]);
  const [contributions, setContributions] = useState([]);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Interaction States
  const [bidDiscount, setBidDiscount] = useState(0);
  const [showConfirmSettle, setShowConfirmSettle] = useState(false);

  // Localized Strings
  const l = {
    back: lang === 'hi' ? 'पीछे जाएं' : 'Back to Chit Funds',
    tabOverview: lang === 'hi' ? 'अवलोकन' : 'Overview',
    tabCycle: lang === 'hi' ? 'सक्रिय चक्र' : 'Current Cycle',
    tabLedger: lang === 'hi' ? 'बहीखाता / Ledger' : 'Ledger',
    tabHistory: lang === 'hi' ? 'इतिहास' : 'History',
    inviteTitle: lang === 'hi' ? 'आमंत्रण टोकन साझा करें' : 'Invite Members',
    inviteDesc: lang === 'hi' ? 'इस आमंत्रण टोकन को अपने मित्रों के साथ साझा करें ताकि वे इस बचत सर्कल में शामिल हो सकें।' : 'Share this invite token with members to let them join your micro-savings circle.',
    poolSummary: lang === 'hi' ? 'बचत चक्र नियम' : 'Savings Circle Rules',
    totalPool: lang === 'hi' ? 'कुल पूल आकार' : 'Total Pool Size',
    contribution: lang === 'hi' ? 'मासिक योगदान' : 'Monthly Due per Member',
    duration: lang === 'hi' ? 'चक्र अवधि' : 'Circle Tenure',
    organiser: lang === 'hi' ? 'आयोजक' : 'Circle Organiser',
    membersList: lang === 'hi' ? 'सदस्यों की सूची' : 'Joined Members',
    collectionPhase: lang === 'hi' ? 'संग्रहण चरण' : 'Collection Phase',
    auctionPhase: lang === 'hi' ? 'नीलामी (Bidding) चरण' : 'Auction / Bidding Phase',
    cycleCompleted: lang === 'hi' ? 'चक्र समाप्त हो गया' : 'Cycle Settled & Completed',
    contributeBtn: lang === 'hi' ? 'मासिक योगदान का भुगतान करें' : 'Pay Monthly Due',
    paidBadge: lang === 'hi' ? 'भुगतान किया गया' : 'Paid',
    notPaidBadge: lang === 'hi' ? 'लंबित' : 'Pending',
    startAuctionBtn: lang === 'hi' ? 'नीलामी खोलें (Start Auction)' : 'Open Circle Bidding',
    submitBidBtn: lang === 'hi' ? 'बोली जमा करें' : 'Submit Bid Discount',
    settleCycleBtn: lang === 'hi' ? 'बोली समाप्त और चक्र तय करें' : 'Settle Auction Cycle',
    bidRange: lang === 'hi' ? 'बोली सीमा' : 'Bid Discount Range',
    currentBid: lang === 'hi' ? 'आपकी वर्तमान बोली छूट' : 'Your discount bid',
    exportCsv: lang === 'hi' ? 'CSV बहीखाता डाउनलोड करें' : 'Export Ledger to CSV',
    winnerAnnounced: lang === 'hi' ? 'चक्र विजेता घोषित! 🎉' : 'Cycle Winner Announced! 🎉',
    dividendShared: lang === 'hi' ? 'वितरित लाभांश' : 'Dividends Paid per Member',
    blockchainProof: lang === 'hi' ? 'ब्लॉकचेन ऑडिट प्रमाण' : 'Blockchain Audit Proof'
  };

  const fetchGroupDetail = useCallback(async () => {
    try {
      const res = await api.get(`/api/chitfund/groups/${groupId}`);
      if (res.data?.success) {
        setGroup(res.data.group);
        setMembers(res.data.members || []);
        setCycles(res.data.cycles || []);
      }
    } catch (err) {
      toast.error('Failed to load group details.');
      navigate('/chitfund');
    }
  }, [groupId, navigate]);

  const currentCycle = cycles.find(c => c.cycle_number === group?.current_cycle);

  // Fetch bids for the active cycle
  const fetchBids = useCallback(async () => {
    if (!currentCycle?.id || currentCycle.status !== 'auction') return;
    try {
      const { data, error } = await supabase
        .from('chit_bids')
        .select('*')
        .eq('cycle_id', currentCycle.id)
        .order('bid_amount', { ascending: false });
      if (!error) setBids(data || []);
    } catch (err) {
      console.error(err);
    }
  }, [currentCycle]);

  // Fetch contributions for the active cycle
  const fetchContributions = useCallback(async () => {
    if (!currentCycle?.id) return;
    try {
      const { data, error } = await supabase
        .from('chit_contributions')
        .select('*')
        .eq('cycle_id', currentCycle.id);
      if (!error) setContributions(data || []);
    } catch (err) {
      console.error(err);
    }
  }, [currentCycle]);

  // Load all details
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchGroupDetail();
      setLoading(false);
    };
    init();
  }, [fetchGroupDetail]);

  // Fetch current cycle status data
  useEffect(() => {
    if (currentCycle?.id) {
      fetchContributions();
      fetchBids();
    }
  }, [currentCycle?.id, fetchContributions, fetchBids]);

  // Real-time Bids subscription
  useEffect(() => {
    if (!currentCycle?.id || currentCycle.status !== 'auction') return;

    const channel = supabase
      .channel(`realtime-bids-${currentCycle.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chit_bids',
          filter: `cycle_id=eq.${currentCycle.id}`
        },
        () => {
          fetchBids();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCycle?.id, currentCycle?.status, fetchBids]);

  // Real-time Contributions subscription
  useEffect(() => {
    if (!currentCycle?.id) return;

    const channel = supabase
      .channel(`realtime-contribs-${currentCycle.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chit_contributions',
          filter: `cycle_id=eq.${currentCycle.id}`
        },
        () => {
          fetchContributions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCycle?.id, fetchContributions]);

  // Member anonymization map
  const memberLetters = {};
  members.forEach((m, idx) => {
    memberLetters[m.user_id] = String.fromCharCode(65 + idx);
  });

  const getMemberName = (userId) => {
    const m = members.find(mem => mem.user_id === userId);
    return m?.user?.name || 'Unknown';
  };

  const isOrganiser = group?.organiser_id === user?.id;
  const userHasContributed = contributions.some(c => c.member_id === user?.id);
  const userHasWon = members.find(m => m.user_id === user?.id)?.has_won;

  // Parameters for Bids
  const totalPoolSize = group ? group.member_count * group.contribution_per_member : 0;
  const minBidDiscount = group ? totalPoolSize * (group.organiser_commission_pct / 100) : 0;
  const maxBidDiscount = group ? totalPoolSize * 0.40 : 0;

  // Initialize slider value
  useEffect(() => {
    if (minBidDiscount) {
      setBidDiscount(minBidDiscount);
    }
  }, [minBidDiscount]);

  // Submit contribution handler
  const handleContribute = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/api/chitfund/contribute', {
        cycle_id: currentCycle.id,
        amount: group.contribution_per_member
      });
      if (res.data?.success) {
        toast.success(lang === 'hi' ? 'मासिक योगदान जमा हो गया!' : 'Monthly contribution paid successfully!');
        fetchGroupDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit contribution.');
    } finally {
      setActionLoading(false);
    }
  };

  // Start Auction handler
  const handleStartAuction = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/api/chitfund/groups/${groupId}/start-auction`);
      if (res.data?.success) {
        toast.success(lang === 'hi' ? 'नीलामी सफलतापूर्वक खुल गई!' : 'Bidding cycle successfully opened!');
        fetchGroupDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start auction.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Bid handler
  const handleBidSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.post(`/api/chitfund/groups/${groupId}/bid`, {
        bid_amount: Number(bidDiscount)
      });
      if (res.data?.success) {
        toast.success(lang === 'hi' ? 'आपकी बोली जमा हो गई!' : 'Discount bid submitted successfully!');
        fetchBids();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit discount bid.');
    } finally {
      setActionLoading(false);
    }
  };

  // Settle Cycle handler
  const handleSettleCycle = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/api/chitfund/groups/${groupId}/settle-cycle`);
      if (res.data?.success) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        toast.success(
          lang === 'hi'
            ? `चक्र तय हो गया! विजेता को प्राप्त हुए: ₹${res.data.payoutAmount}`
            : `Cycle settled! Winner receives payout of: ₹${res.data.payoutAmount}`,
          { duration: 5000 }
        );
        setShowConfirmSettle(false);
        fetchGroupDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to settle cycle.');
    } finally {
      setActionLoading(false);
    }
  };

  // Export Ledger to CSV
  const handleExportCSV = () => {
    const completedCycles = cycles.filter(c => c.status === 'completed');
    if (completedCycles.length === 0) {
      toast.error('No settled cycles to export.');
      return;
    }

    const headers = ['Cycle Number', 'Winner Name', 'Pot Size', 'Organiser Commission', 'Winner Payout', 'Dividend per Member', 'Blockchain Tx'];
    const rows = completedCycles.map(c => [
      c.cycle_number,
      getMemberName(c.winner_id),
      c.pot_amount,
      c.organiser_commission || 0,
      c.pot_amount - c.winning_bid,
      c.dividend_per_member,
      c.blockchain_tx_hash || 'N/A'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${group.name}_ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger exported successfully.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const completedCycles = cycles.filter(c => c.status === 'completed');

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6 py-6">
      
      {/* Header Back link */}
      <div>
        <button
          onClick={() => navigate('/chitfund')}
          className="flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline mb-4"
        >
          <ArrowLeft size={14} />
          {l.back}
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-extrabold text-brand-dark tracking-tight">
                {group?.name}
              </h1>
              <StatusBadge status={group?.status} />
            </div>
            <p className="text-xs text-brand-textMuted mt-1">{group?.description}</p>
          </div>
          {isOrganiser && (
            <span className="px-3 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 rounded-full text-xs font-bold">
              {lang === 'hi' ? 'आप आयोजक हैं' : 'You are Organiser'}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'overview' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {l.tabOverview}
        </button>
        {group?.status === 'active' && (
          <button
            onClick={() => setActiveTab('cycle')}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'cycle' 
                ? 'border-brand-primary text-brand-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {l.tabCycle}
          </button>
        )}
        <button
          onClick={() => setActiveTab('ledger')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'ledger' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {l.tabLedger}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'history' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {l.tabHistory}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Rules + Members list */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Rules Overview */}
            <div className="premium-card p-6">
              <h3 className="text-md font-bold text-brand-dark mb-4">{l.poolSummary}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-brand-textMuted uppercase">{l.totalPool}</span>
                  <p className="text-sm font-black text-brand-textPrimary mt-1">{formatINR(totalPoolSize)}</p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-brand-textMuted uppercase">{l.contribution}</span>
                  <p className="text-sm font-black text-brand-textPrimary mt-1">{formatINR(group?.contribution_per_member)}</p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-brand-textMuted uppercase">{l.duration}</span>
                  <p className="text-sm font-black text-brand-textPrimary mt-1">{group?.duration_months} {lang === 'hi' ? 'महीने' : 'Mo'}</p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-brand-textMuted uppercase">{lang === 'hi' ? 'सदस्य कैप' : 'Member Cap'}</span>
                  <p className="text-sm font-black text-brand-textPrimary mt-1">{group?.member_count}</p>
                </div>
              </div>
            </div>

            {/* Members table list */}
            <div className="premium-card p-6">
              <h3 className="text-md font-bold text-brand-dark mb-4">{l.membersList}</h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary font-bold flex items-center justify-center text-sm shadow-sm">
                        {memberLetters[m.user_id]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-textPrimary">
                          {m.user?.name || 'Anonymous User'} {m.user_id === user.id ? `(${lang === 'hi' ? 'आप' : 'You'})` : ''}
                        </p>
                        <p className="text-[10px] text-brand-textMuted font-mono">ID: {m.user_id.substring(0, 8)}...</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      {m.has_won && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-250">
                          {lang === 'hi' ? `जीता चक्र ${m.won_cycle}` : `Won Cycle ${m.won_cycle}`}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        m.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Invite code card */}
          <div className="space-y-6">
            {group?.status === 'forming' && (
              <div className="premium-card p-6 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 border border-indigo-100 dark:border-slate-800 text-left">
                <div className="flex items-center gap-2 mb-3.5">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Copy size={16} />
                  </div>
                  <h3 className="text-sm font-bold text-brand-dark">{l.inviteTitle}</h3>
                </div>
                <p className="text-xs text-brand-textMuted mb-4 leading-relaxed">{l.inviteDesc}</p>
                
                <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-850">
                  <span className="text-xs font-mono text-brand-textPrimary break-all select-all flex-1">
                    {group.invite_token}
                  </span>
                  <CopyButton text={group.invite_token} className="shrink-0" />
                </div>

                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-brand-textMuted">
                  <span>{lang === 'hi' ? 'शामिल सदस्य:' : 'Members:'}</span>
                  <span className="text-brand-primary">{members.length} / {group.member_count}</span>
                </div>
              </div>
            )}
            
            <div className="premium-card p-6 bg-brand-dark text-white relative overflow-hidden">
              <div className="absolute right-0 bottom-0 w-20 h-20 bg-brand-primary/20 blur-xl pointer-events-none" />
              <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-brand-secondary" />
                {lang === 'hi' ? 'सुरक्षित अनुबंध रिकॉर्ड' : 'Escrow Collateral Ledger'}
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                {lang === 'hi'
                  ? 'यह समूह ब्लॉकचेन आधारित मल्टी-सिग्नेचर एस्क्रो द्वारा सुरक्षित है। प्रत्येक मासिक बहीखाता ऑन-चेन सत्यापित और सुरक्षित रहता है।'
                  : 'This circle uses smart escrows on Polygon. Contributions are held in multi-sig vault contracts and payout allocations are mathematically audited on-chain.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cycle' && currentCycle && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main action console: Bidding vs contributions */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Status Phase details */}
            <div className="premium-card p-6 relative overflow-hidden border-brand-primary/10">
              <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-brand-primary/5 blur-xl pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary">
                  {lang === 'hi' ? `चक्र ${currentCycle.cycle_number}` : `Cycle ${currentCycle.cycle_number}`}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border border-brand-primary bg-brand-primary/5 text-brand-primary capitalize">
                  {currentCycle.status}
                </span>
              </div>

              {currentCycle.status === 'collection' && (
                <div className="space-y-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-lg">
                      <Coins size={18} />
                    </div>
                    <div>
                      <h3 className="text-md font-bold text-brand-dark">{l.collectionPhase}</h3>
                      <p className="text-xs text-brand-textMuted mt-0.5">
                        {lang === 'hi'
                          ? `प्रत्येक सदस्य को मासिक योगदान ₹${group.contribution_per_member} का भुगतान करना होगा।`
                          : `Each active member must contribute ₹${group.contribution_per_member} for this cycle.`}
                      </p>
                    </div>
                  </div>

                  <RupeeProgressBar 
                    current={contributions.length * group.contribution_per_member}
                    goal={totalPoolSize} 
                  />

                  <div className="flex items-center gap-3">
                    {userHasContributed ? (
                      <span className="px-4 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                        <CheckCircle size={14} />
                        {l.paidBadge}
                      </span>
                    ) : (
                      <button
                        onClick={handleContribute}
                        disabled={actionLoading}
                        className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input active:scale-95 transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {actionLoading ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Coins size={14} />
                        )}
                        {l.contributeBtn} ({formatINR(group.contribution_per_member)})
                      </button>
                    )}

                    {isOrganiser && contributions.length === group.member_count && (
                      <button
                        onClick={handleStartAuction}
                        disabled={actionLoading}
                        className="px-5 py-2.5 bg-brand-dark hover:bg-brand-dark/95 text-white font-bold text-xs rounded-input active:scale-95 transition-all shadow-md ml-auto flex items-center gap-1.5 animate-pulse"
                      >
                        <Play size={14} />
                        {l.startAuctionBtn}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {currentCycle.status === 'auction' && (
                <div className="space-y-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 rounded-lg">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <h3 className="text-md font-bold text-brand-dark">{l.auctionPhase}</h3>
                      <p className="text-xs text-brand-textMuted mt-0.5">
                        {lang === 'hi'
                          ? 'नीलामी चक्र सक्रिय है। बोली discount का प्रतिनिधित्व करती है जिसे आप छोड़ना चाहते हैं।'
                          : 'Bidding discount corresponds to the amount of pot value you forfeit. The highest discount wins.'}
                      </p>
                    </div>
                  </div>

                  {!userHasWon && (
                    <form onSubmit={handleBidSubmit} className="space-y-4 bg-slate-50 dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-bold text-brand-textPrimary">{l.bidRange}</label>
                          <span className="text-xs font-black text-brand-primary">{formatINR(bidDiscount)}</span>
                        </div>
                        <input
                          type="range"
                          min={minBidDiscount}
                          max={maxBidDiscount}
                          step={100}
                          value={bidDiscount}
                          onChange={(e) => setBidDiscount(Number(e.target.value))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                        />
                        <div className="flex justify-between text-[10px] text-brand-textMuted mt-1">
                          <span>Min: {formatINR(minBidDiscount)}</span>
                          <span>Max: {formatINR(maxBidDiscount)}</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
                      >
                        {actionLoading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        {l.submitBidBtn}
                      </button>
                    </form>
                  )}

                  {userHasWon && (
                    <div className="p-4 bg-amber-50/50 border border-amber-250 text-amber-700 rounded-lg text-xs font-semibold leading-relaxed">
                      {lang === 'hi' 
                        ? 'चूंकि आपने पिछले चक्र में पॉट जीत लिया है, आप इस चक्र में भाग नहीं ले सकते।'
                        : 'Since you have won the pot in a previous cycle of this circle, you are excluded from this auction.'}
                    </div>
                  )}

                  {isOrganiser && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        onClick={() => setShowConfirmSettle(true)}
                        className="px-5 py-2.5 bg-brand-dark hover:bg-brand-dark/95 text-white font-bold text-xs rounded-input active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                      >
                        <CheckCircle size={14} />
                        {l.settleCycleBtn}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contributions lists table */}
            {currentCycle.status === 'collection' && (
              <div className="premium-card p-6">
                <h3 className="text-md font-bold text-brand-dark mb-4">{lang === 'hi' ? 'योगदानकर्ता स्थिति' : 'Contribution Roster'}</h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((m) => {
                    const contributed = contributions.some(c => c.member_id === m.user_id);
                    return (
                      <div key={m.id} className="flex items-center justify-between py-3">
                        <span className="text-xs font-bold text-brand-textPrimary">
                          Member {memberLetters[m.user_id]} {m.user_id === user.id ? `(${lang === 'hi' ? 'आप' : 'You'})` : ''}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          contributed 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-250' 
                            : 'bg-rose-50 text-rose-700 border-rose-250 animate-pulse'
                        }`}>
                          {contributed ? l.paidBadge : l.notPaidBadge}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live bids list / active cycle details */}
          <div className="space-y-6">
            
            {/* Live Bids list */}
            {currentCycle.status === 'auction' && (
              <div className="premium-card p-6 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-ping" />
                  <h3 className="text-md font-bold text-brand-dark">{lang === 'hi' ? 'लाइव बोलियां' : 'Live Bid Ledger'}</h3>
                </div>

                {bids.length === 0 ? (
                  <p className="text-xs text-brand-textMuted py-4 text-center">
                    {lang === 'hi' ? 'कोई बोली अब तक नहीं लगी।' : 'No bids submitted yet.'}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {bids.map((bid, index) => (
                      <div 
                        key={bid.id} 
                        className={`flex justify-between items-center p-3 rounded-lg border bg-white dark:bg-slate-900 shadow-sm ${
                          index === 0 ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100 dark:border-slate-800'
                        }`}
                      >
                        <span className="text-xs font-bold text-brand-textPrimary">
                          Member {memberLetters[bid.member_id] || 'Anon'} {bid.member_id === user.id ? `(${lang === 'hi' ? 'आप' : 'You'})` : ''}
                        </span>
                        <span className="text-xs font-black text-brand-dark font-mono">
                          {formatINR(bid.bid_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="premium-card p-6 bg-brand-dark text-white">
              <h3 className="text-sm font-bold mb-2">{lang === 'hi' ? 'लाभांश वितरण' : 'Dividend Returns'}</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                {lang === 'hi'
                  ? 'नीलामी चक्र के दौरान, विजेता सदस्य का कुल डिस्काउंट और आयोजक का कमीशन घटाकर जो बचता है वह लाभांश (Dividend) के रूप में सभी सदस्यों में बराबर बांट दिया जाता है।'
                  : 'During auctions, the winning bidder accepts a lower payout. The remaining discount (minus organizer fee) is immediately returned to all other circle members as dividends.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Tab with Export CSV */}
      {activeTab === 'ledger' && (
        <div className="premium-card p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-brand-dark">{lang === 'hi' ? 'वित्तीय विवरण' : 'Financial Ledger'}</h3>
              <p className="text-xs text-brand-textMuted">Official settled cycles ledger.</p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-input transition-all active:scale-95 shadow-sm"
            >
              <Download size={14} />
              {l.exportCsv}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-150 dark:border-slate-800 text-brand-textMuted text-xs font-bold uppercase tracking-wider">
                  <th className="pb-3">Cycle</th>
                  <th className="pb-3">Winner</th>
                  <th className="pb-3">Winner Payout</th>
                  <th className="pb-3">Dividend/Member</th>
                  <th className="pb-3 text-right">Blockchain Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {completedCycles.map((c) => (
                  <tr key={c.id} className="text-brand-textPrimary">
                    <td className="py-4 font-bold">Cycle {c.cycle_number}</td>
                    <td className="py-4 font-medium">{getMemberName(c.winner_id)}</td>
                    <td className="py-4 font-black text-brand-dark">{formatINR(c.pot_amount - c.winning_bid)}</td>
                    <td className="py-4 font-black text-emerald-600 dark:text-emerald-450">+{formatINR(c.dividend_per_member)}</td>
                    <td className="py-4 text-right">
                      <BlockchainBadge txHash={c.blockchain_tx_hash} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {completedCycles.length === 0 && (
              <div className="py-8 text-center text-sm text-brand-textMuted">
                No cycles have been settled yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="premium-card p-6 space-y-6">
          <h3 className="text-lg font-bold text-brand-dark">{lang === 'hi' ? 'चक्र इतिहास लॉग' : 'Cycle Activity History'}</h3>
          
          <div className="relative border-l border-slate-200 dark:border-slate-850 pl-5 ml-2.5 space-y-6">
            {completedCycles.map((c) => (
              <div key={c.id} className="relative">
                <span className="absolute -left-[26px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary ring-4 ring-white dark:ring-slate-900 text-white shadow-sm">
                  <CheckCircle size={10} className="stroke-[2.5]" />
                </span>
                
                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-xl max-w-2xl">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-400">
                      {new Date(c.updated_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <BlockchainBadge txHash={c.blockchain_tx_hash} />
                  </div>
                  <h4 className="text-sm font-bold text-brand-textPrimary mt-2">
                    {l.winnerAnnounced}
                  </h4>
                  <p className="text-xs text-brand-textMuted mt-1 leading-relaxed">
                    {lang === 'hi'
                      ? `चक्र ${c.cycle_number} में सदस्य ${memberLetters[c.winner_id] || 'A'} ने ₹${c.winning_bid} की छूट बोली लगाकर पॉट जीता। प्रत्येक सदस्य को ₹${c.dividend_per_member.toFixed(2)} का लाभांश प्राप्त हुआ।`
                      : `In Cycle ${c.cycle_number}, member ${memberLetters[c.winner_id] || 'A'} submitted a discount bid of ₹${c.winning_bid} and successfully claimed the pot. A total dividend of ₹${c.dividend_per_member.toFixed(2)} was distributed back to each participant.`}
                  </p>
                </div>
              </div>
            ))}

            {completedCycles.length === 0 && (
              <p className="text-xs text-brand-textMuted py-4">No completed cycles recorded.</p>
            )}
          </div>
        </div>
      )}

      {/* Settle cycle confirmation modal */}
      <ConfirmModal
        isOpen={showConfirmSettle}
        onClose={() => setShowConfirmSettle(false)}
        title={lang === 'hi' ? 'नीलामी चक्र तय करने की पुष्टि' : 'Confirm Auction Settlement'}
        confirmText={lang === 'hi' ? 'चक्र तय करें (Settle)' : 'Confirm Settlement'}
        cancelText={lang === 'hi' ? 'रद्द करें' : 'Cancel'}
        onConfirm={handleSettleCycle}
        loading={actionLoading}
        variant="danger"
      >
        <div className="py-2 text-left text-xs font-semibold text-brand-textMuted leading-relaxed">
          {lang === 'hi'
            ? 'क्या आप वास्तव में इस चक्र को तय करना चाहते हैं? ऐसा करने से उच्चतम बोली (या डिफ़ॉल्ट रूप से एस्क्रो की सीमा) के अनुसार विजेता घोषित किया जाएगा और लाभांश सभी सदस्यों में वितरित कर दिया जाएगा।'
            : 'Are you sure you want to settle the current cycle? The highest submitted discount bid will be declared the winner. The remaining discount will be split as dividends among all members, and a smart contract certification will be generated on the blockchain.'}
        </div>
      </ConfirmModal>

    </div>
  );
}
