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
import { formatINR, getErrorMessage } from '../lib/utils';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';
import { useChitRealtime } from '../hooks/useRealtime';

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

  // Real-time Group Subscriptions (bids, contributions, cycles)
  useChitRealtime(groupId, {
    onBid: () => fetchBids(),
    onContribution: () => fetchContributions(),
    onCycleStatusChange: () => fetchGroupDetail()
  });

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
      toast.error(getErrorMessage(err, 'Failed to submit contribution.'));
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
      toast.error(getErrorMessage(err, 'Failed to start auction.'));
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
      toast.error(getErrorMessage(err, 'Failed to submit discount bid.'));
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
      toast.error(getErrorMessage(err, 'Failed to settle cycle.'));
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
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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
          className="flex items-center gap-1.5 text-label-md font-bold text-primary hover:text-primary-container mb-4 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {l.back}
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-unit">
              <span className={`px-2.5 py-0.5 rounded-full text-label-md font-semibold ${
                group?.status === 'active' 
                  ? 'bg-secondary-container text-on-secondary-container' 
                  : 'bg-primary-fixed text-on-primary-fixed'
              }`}>
                {group?.status === 'forming' ? (lang === 'hi' ? 'गठन चरण' : 'Forming Circle') : (lang === 'hi' ? 'सक्रिय चक्र' : 'Active Circle')}
              </span>
              <span className="text-label-md text-on-surface-variant font-mono">ID: #{group?.id.substring(0, 8).toUpperCase()}</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-background tracking-tight">
              {group?.name}
            </h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              {group?.member_count} {lang === 'hi' ? 'सदस्य' : 'Members'} • {formatINR(group?.contribution_per_member)} {lang === 'hi' ? 'मासिक योगदान' : 'Monthly Contribution'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOrganiser && (
              <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary-fixed-dim rounded-full text-xs font-bold">
                {lang === 'hi' ? 'आप आयोजक हैं' : 'You are Organiser'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant overflow-x-auto whitespace-nowrap scrollbar-none mb-6">
        {[
          { id: 'overview', label: l.tabOverview, icon: 'info' },
          { id: 'cycle', label: l.tabCycle, icon: 'sync', cond: group?.status === 'active' },
          { id: 'ledger', label: l.tabLedger, icon: 'menu_book' },
          { id: 'history', label: l.tabHistory, icon: 'history' }
        ].filter(t => t.cond !== false).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 py-3 px-6 text-sm font-semibold border-b-2 transition-all duration-200 ${
              activeTab === tab.id 
                ? 'border-primary text-primary font-bold' 
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 rounded-t-lg'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Rules + Members list */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Rules Overview */}
            <div className="bento-card">
              <h3 className="font-headline-md text-headline-md mb-stack-lg">{l.poolSummary}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{l.totalPool}</span>
                  <p className="text-body-lg font-extrabold text-on-surface mt-1">{formatINR(totalPoolSize)}</p>
                </div>
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{l.contribution}</span>
                  <p className="text-body-lg font-extrabold text-on-surface mt-1">{formatINR(group?.contribution_per_member)}</p>
                </div>
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{l.duration}</span>
                  <p className="text-body-lg font-extrabold text-on-surface mt-1">{group?.duration_months} {lang === 'hi' ? 'महीने' : 'Mo'}</p>
                </div>
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{lang === 'hi' ? 'सदस्य कैप' : 'Member Cap'}</span>
                  <p className="text-body-lg font-extrabold text-on-surface mt-1">{group?.member_count}</p>
                </div>
              </div>
            </div>

            {/* Members table list */}
            <div className="bento-card">
              <h3 className="font-headline-md text-headline-md mb-stack-lg">{l.membersList}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low text-on-surface-variant text-label-md">
                    <tr>
                      <th className="p-3 font-semibold rounded-l-xl">Member</th>
                      <th className="p-3 font-semibold text-center">Status</th>
                      <th className="p-3 font-semibold text-right rounded-r-xl">Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="p-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shadow-sm">
                            {memberLetters[m.user_id]}
                          </div>
                          <div>
                            <p className="font-label-md text-on-surface">
                              {m.user?.name || 'Anonymous User'} {m.user_id === user.id ? `(${lang === 'hi' ? 'आप' : 'You'})` : ''}
                            </p>
                            <p className="text-[10px] text-on-surface-variant font-mono">ID: {m.user_id.substring(0, 8)}...</p>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                            m.status === 'active' 
                              ? 'bg-secondary-container/25 text-on-secondary-container border-secondary-container' 
                              : 'bg-surface-container-highest text-on-surface-variant border-outline-variant'
                          }`}>
                            {m.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {m.has_won ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary-fixed-dim">
                              <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                              {lang === 'hi' ? `जीता चक्र ${m.won_cycle}` : `Won Cycle ${m.won_cycle}`}
                            </span>
                          ) : (
                            <span className="text-xs text-on-surface-variant">{lang === 'hi' ? 'अभी तक नहीं जीता' : 'Yet to win'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: Invite code card */}
          <div className="space-y-6">
            {group?.status === 'forming' && (
              <div className="bento-card bg-gradient-to-br from-primary/5 to-white dark:from-slate-900 border-primary/20">
                <div className="flex items-center gap-2 mb-3.5">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <span className="material-symbols-outlined text-[20px]">content_copy</span>
                  </div>
                  <h3 className="font-label-md text-on-surface">{l.inviteTitle}</h3>
                </div>
                <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">{l.inviteDesc}</p>
                
                <div className="flex items-center gap-2 bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant">
                  <span className="text-xs font-mono text-on-surface break-all select-all flex-1">
                    {group.invite_token}
                  </span>
                  <CopyButton text={group.invite_token} className="shrink-0" />
                </div>

                <div className="mt-4 pt-3.5 border-t border-outline-variant flex justify-between items-center text-xs font-bold text-on-surface-variant">
                  <span>{lang === 'hi' ? 'शामिल सदस्य:' : 'Members:'}</span>
                  <span className="text-primary">{members.length} / {group.member_count}</span>
                </div>
              </div>
            )}
            
            <div className="bento-card bg-on-background text-white relative overflow-hidden">
              <div className="absolute right-0 bottom-0 w-20 h-20 bg-primary/20 blur-xl pointer-events-none" />
              <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary-fixed text-[18px]">verified_user</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main action console: Bidding vs contributions */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Collection Phase */}
            {currentCycle.status === 'collection' && (
              <div className="bento-card border-l-4 border-l-secondary">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-headline-md text-headline-md mb-unit flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-secondary rounded-full animate-ping"></span>
                      {lang === 'hi' ? `संग्रहण चरण: चक्र ${currentCycle.cycle_number}` : `Collection Phase: Cycle ${currentCycle.cycle_number}`}
                    </h3>
                    <p className="text-body-md text-on-surface-variant">
                      {lang === 'hi'
                        ? `सभी सदस्यों को मासिक योगदान जमा करना आवश्यक है।`
                        : `All members must pay their monthly due to unlock the auction.`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-label-md text-on-surface-variant uppercase">{lang === 'hi' ? 'संग्रहीत राशि' : 'Collected Pot'}</p>
                    <p className="font-financial-xl text-financial-xl text-secondary">
                      {formatINR(contributions.length * group.contribution_per_member)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <RupeeProgressBar 
                    current={contributions.length * group.contribution_per_member}
                    goal={totalPoolSize} 
                  />
                  <p className="text-xs text-on-surface-variant font-medium">
                    {contributions.length} / {group.member_count} {lang === 'hi' ? 'सदस्यों ने भुगतान किया' : 'members have contributed this month'}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {userHasContributed ? (
                    <span className="px-4 py-2 bg-secondary-container/20 text-on-secondary-container border border-secondary-container rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      {l.paidBadge}
                    </span>
                  ) : (
                    <button
                      onClick={handleContribute}
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-input active:scale-95 transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {actionLoading ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">payments</span>
                      )}
                      {l.contributeBtn} ({formatINR(group.contribution_per_member)})
                    </button>
                  )}

                  {isOrganiser && contributions.length === group.member_count && (
                    <button
                      onClick={handleStartAuction}
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-on-background hover:bg-on-background/90 text-white font-bold text-xs rounded-input active:scale-95 transition-all shadow-md ml-auto flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                      {l.startAuctionBtn}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Auction Phase */}
            {currentCycle.status === 'auction' && (
              <div className="bento-card border-l-4 border-l-secondary">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-headline-md text-headline-md mb-unit flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-secondary rounded-full animate-ping"></span>
                      {lang === 'hi' ? `लाइव नीलामी: चक्र ${currentCycle.cycle_number}` : `Live Auction: Cycle ${currentCycle.cycle_number}`}
                    </h3>
                    <p className="text-body-md text-on-surface-variant">
                      {lang === 'hi' ? 'नीलामी चक्र सक्रिय है।' : 'Discount auction is active.'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-label-md text-on-surface-variant uppercase">{lang === 'hi' ? 'उच्चतम बोली' : 'Highest Bid'}</p>
                    <p className="font-financial-xl text-financial-xl text-secondary">
                      {formatINR(bids[0]?.bid_amount || minBidDiscount)}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {!userHasWon && (
                    <form onSubmit={handleBidSubmit} className="space-y-4 bg-surface-container-low p-5 rounded-xl border border-outline-variant/30">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-bold text-on-surface">{l.bidRange}</label>
                          <span className="text-xs font-black text-primary">{formatINR(bidDiscount)}</span>
                        </div>
                        <input
                          type="range"
                          min={minBidDiscount}
                          max={maxBidDiscount}
                          step={100}
                          value={bidDiscount}
                          onChange={(e) => setBidDiscount(Number(e.target.value))}
                          className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-on-surface-variant mt-1 font-semibold">
                          <span>Min: {formatINR(minBidDiscount)}</span>
                          <span>Max: {formatINR(maxBidDiscount)}</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-2.5 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-input active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
                      >
                        {actionLoading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                        )}
                        {l.submitBidBtn}
                      </button>
                    </form>
                  )}

                  {userHasWon && (
                    <div className="p-4 bg-tertiary-fixed/30 border border-tertiary-fixed-dim text-on-tertiary-fixed-variant rounded-lg text-xs font-semibold leading-relaxed">
                      {lang === 'hi' 
                        ? 'चूंकि आपने पिछले चक्र में पॉट जीत लिया है, आप इस चक्र में भाग नहीं ले सकते।'
                        : 'Since you have won the pot in a previous cycle of this circle, you are excluded from this auction.'}
                    </div>
                  )}

                  {isOrganiser && (
                    <div className="pt-4 border-t border-outline-variant/30 flex justify-end">
                      <button
                        onClick={() => setShowConfirmSettle(true)}
                        className="px-5 py-2.5 bg-on-background hover:bg-on-background/90 text-white font-bold text-xs rounded-input active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        {l.settleCycleBtn}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contributions list */}
            {currentCycle.status === 'collection' && (
              <div className="bento-card">
                <h3 className="font-headline-md text-headline-md mb-stack-lg">{lang === 'hi' ? 'योगदानकर्ता स्थिति' : 'Contribution Roster'}</h3>
                <div className="divide-y divide-outline-variant/30">
                  {members.map((m) => {
                    const contributed = contributions.some(c => c.member_id === m.user_id);
                    return (
                      <div key={m.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <span className="text-xs font-bold text-on-surface">
                          Member {memberLetters[m.user_id]} {m.user_id === user.id ? `(${lang === 'hi' ? 'आप' : 'You'})` : ''}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          contributed 
                            ? 'bg-secondary-container/20 text-on-secondary-container border-secondary-container' 
                            : 'bg-error-container/20 text-on-error-container border-error-container animate-pulse'
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
              <div className="bento-card">
                <div className="flex items-center gap-1.5 mb-stack-lg">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <h3 className="font-headline-md text-headline-md">{lang === 'hi' ? 'लाइव बोलियां' : 'Live Bid Ledger'}</h3>
                </div>

                {bids.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-4 text-center">
                    {lang === 'hi' ? 'कोई बोली अब तक नहीं लगी।' : 'No bids submitted yet.'}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {bids.map((bid, index) => (
                      <div 
                        key={bid.id} 
                        className={`flex justify-between items-center p-3 rounded-lg border bg-surface-container-lowest shadow-sm ${
                          index === 0 ? 'border-primary bg-primary-fixed/20' : 'border-outline-variant/30'
                        }`}
                      >
                        <span className="text-xs font-bold text-on-surface">
                          Member {memberLetters[bid.member_id] || 'Anon'} {bid.member_id === user.id ? `(${lang === 'hi' ? 'आप' : 'You'})` : ''}
                        </span>
                        <span className="text-xs font-black text-on-surface font-mono">
                          {formatINR(bid.bid_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bento-card bg-primary-container text-on-primary-container flex flex-col justify-between">
              <div>
                <h3 className="font-label-md uppercase opacity-80 mb-stack-sm">{lang === 'hi' ? 'कुल पूल आकार' : 'Total Pot Amount'}</h3>
                <p className="font-financial-xl text-financial-xl mb-stack-lg">{formatINR(totalPoolSize)}</p>
                <div className="space-y-stack-md text-xs font-semibold">
                  <div className="flex justify-between items-center border-b border-on-primary-container/20 pb-stack-sm">
                    <span>{lang === 'hi' ? 'आयोजक कमीशन' : 'Organiser Fee'}</span>
                    <span className="font-bold">{group?.organiser_commission_pct}%</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-on-primary-container/20 pb-stack-sm">
                    <span>{lang === 'hi' ? 'आपकी वर्तमान बोली छूट' : 'Your Bid Discount'}</span>
                    <span className="font-bold">{formatINR(bidDiscount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{lang === 'hi' ? 'अनुमानित विजेता भुगतान' : 'Est. Winner Payout'}</span>
                    <span className="font-bold text-secondary-fixed">{formatINR(totalPoolSize - (bids[0]?.bid_amount || minBidDiscount))}</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-on-primary-container/20">
                <p className="text-[11px] opacity-80 leading-relaxed">
                  {lang === 'hi'
                    ? 'लाभांश अन्य सभी गैर-विजेता सदस्यों के बीच समान रूप से वितरित किया जाता है।'
                    : 'Dividends are distributed equally among all non-winning members at cycle settlement.'}
                </p>
              </div>
            </div>

            <div className="bento-card bg-on-background text-white">
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
        <div className="bento-card space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">{lang === 'hi' ? 'वित्तीय विवरण' : 'Financial Ledger'}</h3>
              <p className="text-xs text-on-surface-variant mt-1">Official settled cycles ledger.</p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant rounded-xl text-on-surface font-bold text-xs transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {l.exportCsv}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant text-xs font-bold uppercase tracking-wider">
                  <th className="pb-3 text-left">Cycle</th>
                  <th className="pb-3 text-left">Winner</th>
                  <th className="pb-3 text-left">Winner Payout</th>
                  <th className="pb-3 text-left">Dividend/Member</th>
                  <th className="pb-3 text-right">Blockchain Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {completedCycles.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="py-4 font-bold text-on-surface">Cycle {c.cycle_number}</td>
                    <td className="py-4 font-semibold text-on-surface">{getMemberName(c.winner_id)}</td>
                    <td className="py-4 font-black text-on-surface">{formatINR(c.pot_amount - c.winning_bid)}</td>
                    <td className="py-4 font-black text-secondary">+{formatINR(c.dividend_per_member)}</td>
                    <td className="py-4 text-right">
                      <BlockchainBadge txHash={c.blockchain_tx_hash} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {completedCycles.length === 0 && (
              <div className="py-8 text-center text-sm text-on-surface-variant font-semibold">
                No cycles have been settled yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bento-card space-y-6">
          <h3 className="font-headline-md text-headline-md text-on-surface">{lang === 'hi' ? 'चक्र इतिहास लॉग' : 'Cycle Activity History'}</h3>
          
          <div className="relative border-l-2 border-outline-variant/50 pl-6 ml-3 space-y-6">
            {completedCycles.map((c) => (
              <div key={c.id} className="relative">
                <span className="absolute -left-[33px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-white dark:ring-slate-900 text-white shadow-sm">
                  <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                </span>
                
                <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 max-w-2xl shadow-sm hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="text-xs font-bold text-on-surface-variant">
                      {new Date(c.updated_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <BlockchainBadge txHash={c.blockchain_tx_hash} />
                  </div>
                  <h4 className="text-sm font-bold text-on-surface mt-2">
                    {l.winnerAnnounced}
                  </h4>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    {lang === 'hi'
                      ? `चक्र ${c.cycle_number} में सदस्य ${memberLetters[c.winner_id] || 'A'} ने ₹${c.winning_bid} की छूट बोली लगाकर पॉट जीता। प्रत्येक सदस्य को ₹${c.dividend_per_member.toFixed(2)} का लाभांश प्राप्त हुआ।`
                      : `In Cycle ${c.cycle_number}, member ${memberLetters[c.winner_id] || 'A'} submitted a discount bid of ₹${c.winning_bid} and successfully claimed the pot. A total dividend of ₹${c.dividend_per_member.toFixed(2)} was distributed back to each participant.`}
                  </p>
                </div>
              </div>
            ))}

            {completedCycles.length === 0 && (
              <p className="text-xs text-on-surface-variant font-semibold py-4">No completed cycles recorded.</p>
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
        <div className="py-2 text-left text-xs font-semibold text-on-surface-variant leading-relaxed">
          {lang === 'hi'
            ? 'क्या आप वास्तव में इस चक्र को तय करना चाहते हैं? ऐसा करने से उच्चतम बोली (या डिफ़ॉल्ट रूप से एस्क्रो की सीमा) के अनुसार विजेता घोषित किया जाएगा और लाभांश सभी सदस्यों में वितरित कर दिया जाएगा।'
            : 'Are you sure you want to settle the current cycle? The highest submitted discount bid will be declared the winner. The remaining discount will be split as dividends among all members, and a smart contract certification will be generated on the blockchain.'}
        </div>
      </ConfirmModal>

    </div>
  );
}
