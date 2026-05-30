import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import api from '../lib/api';
import { useLanguageStore } from '../lib/languageStore';
import { formatINR, getErrorMessage } from '../lib/utils';
import StatusBadge from '../components/shared/StatusBadge';
import { toast } from 'react-hot-toast';

// Zod schema for Create Group
const createGroupSchema = z.object({
  name: z.string().min(3, 'Group name must be at least 3 characters'),
  description: z.string().optional(),
  member_count: z.number().min(5, 'Minimum 5 members').max(50, 'Maximum 50 members'),
  contribution_per_member: z.number().min(500, 'Minimum contribution is ₹500').max(50000, 'Maximum contribution is ₹50,000'),
  duration_months: z.number().min(2, 'Minimum 2 months').max(60, 'Maximum 60 months'),
  organiser_commission_pct: z.number().min(2, 'Minimum 2%').max(8, 'Maximum 8%')
});

// Custom resolver using Zod
const customZodResolver = (schema) => async (data) => {
  try {
    const parsedData = {};
    Object.keys(data).forEach(key => {
      const val = data[key];
      if (key === 'member_count' || key === 'contribution_per_member' || key === 'duration_months' || key === 'organiser_commission_pct') {
        parsedData[key] = val === '' ? undefined : Number(val);
      } else {
        parsedData[key] = val;
      }
    });

    const values = schema.parse(parsedData);
    return { values, errors: {} };
  } catch (error) {
    const errors = {};
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        const path = err.path[0];
        errors[path] = { type: 'validation', message: err.message };
      });
    }
    return { values: {}, errors };
  }
};

export default function ChitFund() {
  const navigate = useNavigate();
  const { lang } = useLanguageStore();

  const [activeTab, setActiveTab] = useState('my-groups');
  const [groups, setGroups] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Localized strings
  const l = {
    title: lang === 'hi' ? 'पी2पी चिट फंड लॉबी' : 'Chit Fund Lobby',
    subtitle: lang === 'hi' ? 'स्मार्ट अनुबंध एस्क्रो द्वारा सुरक्षित पारदर्शी बचत चक्र।' : 'Join community-powered savings circles for reliable returns.',
    tabMyGroups: lang === 'hi' ? 'सक्रिय सर्कल' : 'Active Circles',
    tabJoin: lang === 'hi' ? 'कोड से जुड़ें' : 'Join with Invite Code',
    tabCreate: lang === 'hi' ? 'नया सर्कल बनाएं' : 'Create New Circle',
    noGroups: lang === 'hi' ? 'आप किसी भी चिट समूह के सदस्य नहीं हैं।' : 'You are not a member of any Chit Circle yet.',
    poolSize: lang === 'hi' ? 'कुल पूल आकार' : 'Total Pool Size',
    monthlyDue: lang === 'hi' ? 'मासिक योगदान' : 'Monthly Contribution',
    duration: lang === 'hi' ? 'अवधि' : 'Duration',
    membersJoined: lang === 'hi' ? 'सदस्य' : 'Members',
    nextAuction: lang === 'hi' ? 'बोली' : 'Next Auction',
    manageBtn: lang === 'hi' ? 'प्रबंधित करें' : 'Manage Fund',
    joinBtn: lang === 'hi' ? 'शामिल हों' : 'Join Circle',
    joinDesc: lang === 'hi' ? 'अपने आयोजक द्वारा साझा किया गया आमंत्रण टोकन दर्ज करें:' : 'Enter the invitation token shared by your circle organiser:',
    inviteTokenLabel: lang === 'hi' ? 'आमंत्रण टोकन (UUID)' : 'Invite Token (UUID)',
    createBtn: lang === 'hi' ? 'सर्कल बनाएं' : 'Create Circle',
    nameLabel: lang === 'hi' ? 'समूह का नाम' : 'Circle Name',
    descLabel: lang === 'hi' ? 'विवरण (वैकल्पिक)' : 'Description (Optional)',
    memberCountLabel: lang === 'hi' ? 'कुल सदस्यों की संख्या (5 - 50)' : 'Total Members (5 - 50)',
    contributionLabel: lang === 'hi' ? 'प्रति सदस्य योगदान (₹500 - ₹50,000)' : 'Contribution per Member (₹500 - ₹50,000)',
    durationLabel: lang === 'hi' ? 'अवधि महीनों में (2 - 60)' : 'Duration (Months)',
    commissionLabel: lang === 'hi' ? 'आयोजक कमीशन प्रतिशत (2% - 8%)' : 'Organiser Commission % (2% - 8%)',
    summaryTitle: lang === 'hi' ? 'लाइव चक्र कैलकुलेटर' : 'Live Summary Calculator',
    summaryPool: lang === 'hi' ? 'कुल एकत्रित पूल' : 'Total Collected Pool',
    summaryCommission: lang === 'hi' ? 'आयोजक कमीशन' : 'Organiser Commission',
    summaryPayout: lang === 'hi' ? 'शुद्ध पॉट आकार' : 'Net Payout Pot Size',
    infoTitle: lang === 'hi' ? 'चिट फंड कैसे काम करता है?' : 'How do Chit Funds work?',
    infoDesc: lang === 'hi' ? 'चिट फंड एक पारंपरिक बचत और ऋण मॉडल है। हर महीने सदस्य पैसे योगदान करते हैं। फिर कुल पूल के लिए बोली लगती है। जो सबसे कम बोली लगाता है उसे एकमुश्त राशि (पॉट) मिलती है, और शेष छूट राशि को सभी सदस्यों में लाभांश के रूप में बांट दिया जाता है।' : 'Chit funds are rotating peer-to-peer savings circles. In each cycle, members contribute a set amount. The total pool is put up for bidding. The lowest bidder wins the pool payout, and the remaining discount is returned to all participants as a dividend!',
    historyBtn: lang === 'hi' ? 'इतिहास देखें' : 'View All History',
    totalSavings: lang === 'hi' ? 'कुल संचित बचत' : 'Total Savings',
    availableTitle: lang === 'hi' ? 'शामिल होने के लिए उपलब्ध' : 'Available to Join',
    popularTab: lang === 'hi' ? 'लोकप्रिय' : 'Popular',
    lowEntryTab: lang === 'hi' ? 'कम शुल्क' : 'Low Entry',
    viewDetailsJoin: lang === 'hi' ? 'विवरण देखें और शामिल हों' : 'View Details & Join',
    guideTitle: lang === 'hi' ? 'चिट फंड में नए हैं?' : 'New to Chit Funds?',
    guideDesc: lang === 'hi' ? 'SafeKosh आपके मूलधन की गारंटी देता है। जानें कि हमारे सुरक्षित, समुदाय-समर्थित बचत चक्र आपके लाभ के लिए कैसे काम करते हैं।' : 'SafeKosh guarantees your principal amount. Learn how our secure, community-backed savings circles work for your benefit.',
    guideBtn: lang === 'hi' ? 'मार्गदर्शन वीडियो देखें' : 'Watch How-to Guide'
  };

  // Form setups
  const { register: registerJoin, handleSubmit: handleJoinSubmit, reset: resetJoin } = useForm();
  
  const { 
    register: registerCreate, 
    handleSubmit: handleCreateSubmit, 
    watch, 
    formState: { errors: createErrors },
    setValue: setCreateValue,
    reset: resetCreate 
  } = useForm({
    resolver: customZodResolver(createGroupSchema),
    defaultValues: {
      member_count: 10,
      contribution_per_member: 2000,
      duration_months: 10,
      organiser_commission_pct: 5
    }
  });

  // Watch fields for live calculation
  const watchMembers = watch('member_count');
  const watchContribution = watch('contribution_per_member');
  const watchCommission = watch('organiser_commission_pct');

  // Auto-set duration equal to member count when member count changes
  useEffect(() => {
    if (watchMembers) {
      setCreateValue('duration_months', watchMembers);
    }
  }, [watchMembers, setCreateValue]);

  // Live calculations
  const totalPool = (Number(watchMembers) || 0) * (Number(watchContribution) || 0);
  const commission = Math.round(totalPool * ((Number(watchCommission) || 0) / 100));
  const netPayout = totalPool - commission;

  // Fetch joined/created groups
  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/chitfund/groups');
      if (res.data?.success) {
        setGroups(res.data.groups || []);
      }
    } catch (err) {
      console.error('Error fetching chit groups:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available groups to join (forming status)
  const fetchAvailableGroups = async () => {
    try {
      const res = await api.get('/api/chitfund/groups?filter=forming');
      if (res.data?.success) {
        setAvailableGroups(res.data.groups || []);
      }
    } catch (err) {
      console.error('Error fetching available chit groups:', err);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchAvailableGroups();
  }, []);

  // Join group handler
  const onJoinSubmit = async (data) => {
    if (!data.invite_token) {
      toast.error('Please enter an invite token.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/api/chitfund/join', { invite_token: data.invite_token });
      if (res.data?.success) {
        toast.success(lang === 'hi' ? 'समूह में सफलतापूर्वक शामिल हुए!' : 'Successfully joined the Chit Circle!');
        resetJoin();
        fetchGroups();
        setActiveTab('my-groups');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to join group. Check the token validity.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Create group handler
  const onCreateSubmit = async (data) => {
    setSubmitting(true);
    try {
      const res = await api.post('/api/chitfund/groups', data);
      if (res.data?.success) {
        toast.success(lang === 'hi' ? 'नया चिट समूह बनाया गया!' : 'New Chit Circle created successfully!');
        resetCreate();
        fetchGroups();
        setActiveTab('my-groups');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create group. Verify inputs.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate total active contributions
  const getSumActiveContributions = () => {
    return groups.reduce((acc, curr) => {
      if (curr.status === 'active') {
        return acc + (curr.member_count * curr.contribution_per_member);
      }
      return acc;
    }, 0);
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-1 md:px-2 py-4">
      
      {/* Header Info Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-primary tracking-tight">
            {l.title}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {l.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setActiveTab('join')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
              activeTab === 'join' 
                ? 'bg-primary text-white border-primary shadow-sm' 
                : 'bg-surface border-outline-variant text-primary hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">vpn_key</span>
            {l.tabJoin}
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
              activeTab === 'create' 
                ? 'bg-primary text-white border-primary shadow-sm' 
                : 'bg-primary text-on-primary border-primary hover:opacity-90'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            {l.tabCreate}
          </button>
        </div>
      </section>

      {/* Tabs Menu navigation */}
      <div className="flex border-b border-outline-variant/35">
        <button
          onClick={() => setActiveTab('my-groups')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'my-groups' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {l.tabMyGroups}
        </button>
      </div>

      {/* Tab content layouts */}
      {activeTab === 'my-groups' && (
        <div className="space-y-8 animate-fade-in text-left">
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
              <div className="md:col-span-8 bg-surface-container-low rounded-3xl p-stack-lg h-60 animate-pulse border border-outline-variant/30" />
              <div className="md:col-span-4 bg-surface-container-low rounded-3xl p-stack-lg h-60 animate-pulse border border-outline-variant/30" />
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
              <span className="material-symbols-outlined text-outline text-6xl">diversity_3</span>
              <h3 className="text-lg font-bold text-primary">{lang === 'hi' ? 'कोई सक्रिय समूह नहीं' : 'No Active Circles'}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {l.noGroups}
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('join')}
                  className="px-4 py-2.5 bg-surface-container-high hover:bg-surface-variant text-on-surface font-bold text-xs rounded-xl border border-outline-variant/30 transition-colors cursor-pointer"
                >
                  {l.tabJoin}
                </button>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2.5 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {l.tabCreate}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              
              {/* Bento style active circles grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
                
                {/* Large Featured Active Card (Spans first active group, or default structure) */}
                <div className="lg:col-span-8 bg-surface-container-lowest rounded-3xl p-stack-lg border border-outline-variant shadow-sm flex flex-col md:flex-row gap-stack-lg items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {groups[0].status === 'forming' ? (lang === 'hi' ? 'गठन चरण' : 'Forming Phase') : (lang === 'hi' ? 'बोली सक्रिय' : 'Auction Active')}
                    </span>
                  </div>
                  <div className="w-full md:w-1/3 flex flex-col items-center py-4">
                    <div className="w-20 h-20 rounded-full bg-primary-container/20 flex items-center justify-center text-primary mb-4 shadow-inner">
                      <span className="material-symbols-outlined text-4xl filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
                    </div>
                    <h3 className="text-headline-md font-bold text-on-surface text-center line-clamp-1">{groups[0].name}</h3>
                    <p className="text-on-surface-variant text-xs font-bold text-center mt-0.5 font-mono">
                      {groups[0].invite_token ? `Token: ${groups[0].invite_token.substring(0, 8)}` : ''}
                    </p>
                  </div>
                  <div className="flex-grow grid grid-cols-2 gap-stack-md w-full">
                    <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30">
                      <p className="text-on-surface-variant text-xs font-bold mb-1">{l.monthlyDue}</p>
                      <p className="font-extrabold text-lg text-primary">{formatINR(groups[0].contribution_per_member)}<span className="text-xs font-bold text-on-surface-variant">/mo</span></p>
                    </div>
                    <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30">
                      <p className="text-on-surface-variant text-xs font-bold mb-1">{l.duration}</p>
                      <p className="font-extrabold text-lg text-primary">{groups[0].duration_months} Months</p>
                    </div>
                    <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30">
                      <p className="text-on-surface-variant text-xs font-bold mb-1">{l.membersJoined}</p>
                      <p className="font-extrabold text-lg text-on-surface">{groups[0].member_count} Members</p>
                    </div>
                    <div 
                      onClick={() => navigate(`/chit/${groups[0].id}`)}
                      className="bg-primary hover:bg-primary/95 text-white p-4 rounded-2xl flex flex-col justify-center items-center cursor-pointer transition-colors active:scale-95 shadow-sm group"
                    >
                      <p className="text-white text-xs font-bold">{l.manageBtn}</p>
                      <span className="material-symbols-outlined text-white text-xl mt-1 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </div>
                  </div>
                </div>

                {/* Small Stats Card (cols 4) */}
                <div className="lg:col-span-4 bg-primary-container text-on-primary-container rounded-3xl p-stack-lg flex flex-col justify-between overflow-hidden relative border border-primary/20 shadow-md">
                  <div className="absolute -right-4 -bottom-4 opacity-10">
                    <span className="material-symbols-outlined text-[100px] filled-icon" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
                  </div>
                  <div>
                    <h3 className="text-headline-md font-bold mb-2 text-primary-fixed">{l.totalSavings}</h3>
                    <p className="text-4xl font-black mb-1 text-on-primary-container">
                      {formatINR(getSumActiveContributions())}
                    </p>
                    <p className="text-xs font-bold opacity-80 text-primary-fixed">Across active circles</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-on-primary-container/20">
                    <div className="flex justify-between items-center mb-2 text-xs font-bold">
                      <span>Formation Circles</span>
                      <span>{groups.filter(g => g.status === 'forming').length} Circles</span>
                    </div>
                    <div className="w-full bg-on-primary-container/20 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-secondary-fixed h-full w-[45%] rounded-full"></div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Grid of the rest of the groups if there are more than 1 */}
              {groups.length > 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter mt-6">
                  {groups.slice(1).map((group) => (
                    <div key={group.id} className="bg-surface-container-lowest rounded-3xl border border-outline-variant p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div>
                        <div className="flex justify-between items-start">
                          <StatusBadge status={group.status} />
                          <span className="text-[10px] font-bold text-outline font-mono">
                            {group.invite_token ? `Token: ${group.invite_token.substring(0, 8)}` : ''}
                          </span>
                        </div>
                        <h3 className="text-md font-extrabold text-on-surface mt-4">{group.name}</h3>
                        {group.description && (
                          <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed line-clamp-2">
                            {group.description}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-3 gap-2 mt-4 bg-surface-container-low p-3 rounded-xl border border-outline-variant/30">
                          <div>
                            <span className="text-[8px] font-bold text-on-surface-variant uppercase">{l.poolSize}</span>
                            <p className="text-xs font-black text-on-surface mt-0.5">
                              {formatINR(group.member_count * group.contribution_per_member)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[8px] font-bold text-on-surface-variant uppercase">{l.monthlyDue}</span>
                            <p className="text-xs font-black text-on-surface mt-0.5">
                              {formatINR(group.contribution_per_member)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[8px] font-bold text-on-surface-variant uppercase">{l.duration}</span>
                            <p className="text-xs font-black text-on-surface mt-0.5">{group.duration_months} Mo</p>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-outline-variant/35 mt-6 pt-4 flex items-center justify-between">
                        <span className="text-xs text-on-surface-variant flex items-center gap-1 font-bold">
                          <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                          {group.status === 'forming' ? (lang === 'hi' ? 'गठन' : 'Forming') : l.nextAuction}
                        </span>
                        <button
                          onClick={() => navigate(`/chit/${group.id}`)}
                          className="flex items-center gap-0.5 text-xs font-bold text-primary hover:underline cursor-pointer"
                        >
                          {l.manageBtn}
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Available to Join section */}
              <section className="pt-6">
                <div className="flex items-center justify-between mb-stack-md">
                  <h2 className="text-headline-md font-bold text-on-background flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">explore</span>
                    {l.availableTitle}
                  </h2>
                  <div className="flex gap-2">
                    <button className="bg-surface-container-high px-4 py-1.5 rounded-full text-on-surface text-xs font-bold hover:bg-surface-container-highest transition-colors cursor-pointer border border-outline-variant/35">{l.popularTab}</button>
                    <button className="bg-surface border border-outline-variant px-4 py-1.5 rounded-full text-on-surface-variant text-xs font-bold hover:bg-surface-container-low transition-colors cursor-pointer">{l.lowEntryTab}</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                  {availableGroups.length > 0 ? (
                    availableGroups.map((group) => {
                      const slotsFilled = group.member_count || 0;
                      const totalSlots = group.member_count || 0;
                      const fillPercent = totalSlots > 0 ? Math.round((slotsFilled / totalSlots) * 100) : 0;
                      const isPrimary = availableGroups.indexOf(group) % 2 === 0;
                      
                      return (
                        <div key={group.id} className="bg-surface-container-lowest rounded-3xl border border-outline-variant p-0 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow group text-left">
                          <div className={`h-28 bg-gradient-to-br ${isPrimary ? 'from-primary-container to-primary' : 'from-tertiary-container to-tertiary'} relative overflow-hidden p-6 flex flex-col justify-end`}>
                            <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white text-[9px] font-bold uppercase">
                              {group.status === 'forming' ? 'Open' : 'Limited'}
                            </div>
                            <h3 className="text-white text-md font-bold">{group.name}</h3>
                            <p className="text-white/80 text-xs font-bold">{group.description || 'Community Circle'}</p>
                          </div>
                          <div className="p-6 flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-on-surface-variant text-[10px] font-bold uppercase">Contribution</p>
                                <p className={`font-extrabold text-sm ${isPrimary ? 'text-primary' : 'text-tertiary'}`}>
                                  {formatINR(group.contribution_per_member)}<span className="text-xs font-bold">/mo</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-on-surface-variant text-[10px] font-bold uppercase">Duration</p>
                                <p className={`font-extrabold text-sm ${isPrimary ? 'text-primary' : 'text-tertiary'}`}>
                                  {group.duration_months} Months
                                </p>
                              </div>
                            </div>
                            <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/20">
                              <div className="flex justify-between items-center mb-1.5 text-xs font-bold">
                                <span className="text-on-surface-variant">Slots filled</span>
                                <span className="text-on-surface">{slotsFilled}/{totalSlots}</span>
                              </div>
                              <div className="w-full bg-outline-variant/40 h-1.5 rounded-full overflow-hidden">
                                <div className={`${isPrimary ? 'bg-secondary' : 'bg-tertiary'} h-full rounded-full`} style={{ width: `${fillPercent}%` }}></div>
                              </div>
                            </div>
                            <button 
                              onClick={() => { setActiveTab('join'); }}
                              className={`w-full bg-surface-container-high py-3 rounded-xl font-bold text-xs ${isPrimary ? 'text-primary group-hover:bg-primary' : 'text-tertiary group-hover:bg-tertiary'} group-hover:text-white transition-all active:scale-95 cursor-pointer`}
                            >
                              {l.viewDetailsJoin}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center py-12 text-on-surface-variant text-sm">
                      No chit circles available to join at the moment. Create your own or check back later!
                    </div>
                  )}
                </div>
              </section>

              {/* CTA Support Section */}
              <section className="mt-16 bg-surface-variant/30 border border-outline-variant/35 rounded-3xl p-stack-lg flex flex-col md:flex-row items-center gap-stack-lg text-left">
                <div className="flex-shrink-0 w-20 h-20 bg-surface rounded-full flex items-center justify-center border-4 border-white shadow-inner">
                  <span className="material-symbols-outlined text-primary text-4xl">shield_person</span>
                </div>
                <div className="flex-grow">
                  <h3 className="text-headline-md font-bold mb-1">{l.guideTitle}</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {l.guideDesc}
                  </p>
                </div>
                <button 
                  onClick={() => toast.success('Video tutorial link dispatched!')}
                  className="bg-white text-primary border border-primary px-8 h-11 rounded-full font-bold text-xs hover:bg-primary-container active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  {l.guideBtn}
                </button>
              </section>

            </div>
          )}
        </div>
      )}

      {/* Join Tab Content Form */}
      {activeTab === 'join' && (
        <div className="max-w-xl mx-auto bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 space-y-6 text-left animate-fade-in shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl mt-0.5">
              <span className="material-symbols-outlined text-xl">link2</span>
            </div>
            <div>
              <h3 className="text-md font-bold text-on-surface">{l.tabJoin}</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">{l.joinDesc}</p>
            </div>
          </div>

          <form onSubmit={handleJoinSubmit(onJoinSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">{l.inviteTokenLabel}</label>
              <input
                type="text"
                {...registerJoin('invite_token', { required: true })}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="input-premium font-mono text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl active:scale-98 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {l.joinBtn} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Create Tab Content Form */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left animate-fade-in">
          {/* Create Form */}
          <div className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-3xl p-6">
            <h3 className="text-md font-bold text-on-surface mb-5 flex items-center gap-2 border-b border-outline-variant/35 pb-3">
              <span className="material-symbols-outlined text-primary text-xl">add_circle</span>
              {lang === 'hi' ? 'एक नया बचत चक्र कॉन्फ़िगर करें' : 'Configure a New Savings Circle'}
            </h3>

            <form onSubmit={handleCreateSubmit(onCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5">{l.nameLabel}</label>
                  <input
                    type="text"
                    {...registerCreate('name')}
                    placeholder="e.g. Premier Circle"
                    className="input-premium text-sm"
                  />
                  {createErrors.name && (
                    <p className="text-[10px] text-red-500 font-bold mt-1">{createErrors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5">{l.memberCountLabel}</label>
                  <input
                    type="number"
                    {...registerCreate('member_count')}
                    className="input-premium text-sm"
                  />
                  {createErrors.member_count && (
                    <p className="text-[10px] text-red-500 font-bold mt-1">{createErrors.member_count.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface mb-1.5">{l.descLabel}</label>
                <textarea
                  {...registerCreate('description')}
                  rows="2"
                  placeholder="e.g. Monthly micro-savings pool for transport operators."
                  className="input-premium text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5">{l.contributionLabel}</label>
                  <input
                    type="number"
                    {...registerCreate('contribution_per_member')}
                    className="input-premium text-sm font-mono"
                  />
                  {createErrors.contribution_per_member && (
                    <p className="text-[10px] text-red-500 font-bold mt-1">{createErrors.contribution_per_member.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5">
                    {l.durationLabel}
                  </label>
                  <input
                    type="number"
                    {...registerCreate('duration_months')}
                    className="input-premium text-sm opacity-60"
                    disabled
                  />
                  <span className="text-[8px] text-on-surface-variant font-bold mt-1 block">Locked to number of members</span>
                  {createErrors.duration_months && (
                    <p className="text-[10px] text-red-500 font-bold mt-1">{createErrors.duration_months.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1.5">{l.commissionLabel}</label>
                  <input
                    type="number"
                    {...registerCreate('organiser_commission_pct')}
                    className="input-premium text-sm font-mono"
                  />
                  {createErrors.organiser_commission_pct && (
                    <p className="text-[10px] text-red-500 font-bold mt-1">{createErrors.organiser_commission_pct.message}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl active:scale-98 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md cursor-pointer mt-4"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {l.createBtn} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Calculator Info Panel (cols 4) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 shadow-sm border-primary/10">
              <h3 className="text-md font-bold text-primary flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-sm">bolt</span>
                {l.summaryTitle}
              </h3>
              
              <div className="space-y-3.5 divide-y divide-outline-variant/40">
                <div className="flex justify-between items-center py-2 first:pt-0">
                  <span className="text-xs font-bold text-on-surface-variant">{l.summaryPool}</span>
                  <span className="text-sm font-black text-on-surface font-mono">{formatINR(totalPool)}</span>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-bold text-on-surface-variant">{l.summaryCommission}</span>
                  <span className="text-sm font-black text-rose-500 font-mono">-{formatINR(commission)}</span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-bold text-primary">{l.summaryPayout}</span>
                  <span className="text-base font-black text-primary font-mono">{formatINR(netPayout)}</span>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-xl flex gap-2">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5 shrink-0">info</span>
                <p className="text-[10px] text-on-surface-variant leading-relaxed font-bold">
                  {lang === 'hi'
                    ? 'प्रत्येक चक्र में जीतने वाले सदस्य को शुद्ध पॉट राशि में से विजेता की छूट घटाकर भुगतान किया जाएगा।'
                    : 'The cycle winning bidder will receive the net payout pot minus their submitted discount bid.'}
                </p>
              </div>
            </div>

            {/* Info Accordion */}
            <div className="bg-primary p-6 rounded-3xl text-on-primary relative overflow-hidden shadow-sm">
              <div className="absolute right-0 top-0 w-24 h-24 bg-secondary/20 blur-xl pointer-events-none" />
              <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                {l.infoTitle}
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                {l.infoDesc}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
