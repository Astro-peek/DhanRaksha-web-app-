import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import api from '../lib/api';
import { useLanguageStore } from '../lib/languageStore';
import { formatINR } from '../lib/utils';
import StatusBadge from '../components/shared/StatusBadge';
import { 
  Users, 
  Plus, 
  ArrowRight, 
  Calendar, 
  Link2, 
  TrendingUp, 
  ShieldCheck, 
  Sparkles,
  Info,
  DollarSign
} from 'lucide-react';
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
    // Convert numeric strings to numbers before passing to Zod
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
  const { lang, t } = useLanguageStore();

  const [activeTab, setActiveTab] = useState('my-groups');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Localized strings
  const l = {
    title: lang === 'hi' ? 'पी2पी चिट फंड' : 'Decentralized Chit Funds',
    subtitle: lang === 'hi' ? 'स्मार्ट अनुबंध एस्क्रो द्वारा सुरक्षित पारदर्शी बचत चक्र।' : 'Transparent peer-to-peer savings circles backed by Smart Contract Escrow accounts.',
    tabMyGroups: lang === 'hi' ? 'मेरे समूह' : 'My Groups',
    tabJoin: lang === 'hi' ? 'समूह में शामिल हों' : 'Join Group',
    tabCreate: lang === 'hi' ? 'नया समूह बनाएं' : 'Create Circle',
    noGroups: lang === 'hi' ? 'आप किसी भी चिट समूह के सदस्य नहीं हैं।' : 'You are not a member of any Chit Circle yet.',
    poolSize: lang === 'hi' ? 'कुल पूल आकार' : 'Total Pool Size',
    monthlyDue: lang === 'hi' ? 'मासिक योगदान' : 'Monthly Contribution',
    duration: lang === 'hi' ? 'अवधि' : 'Duration',
    membersJoined: lang === 'hi' ? 'सदस्य शामिल हुए' : 'Members',
    nextAuction: lang === 'hi' ? 'अगला चक्र' : 'Next Auction',
    manageBtn: lang === 'hi' ? 'प्रबंधित करें' : 'Manage Circle',
    joinBtn: lang === 'hi' ? 'शामिल हों' : 'Join Circle',
    joinDesc: lang === 'hi' ? 'आमंत्रण टोकन दर्ज करें जिसे आपके आयोजक ने भेजा है:' : 'Enter the invitation token shared by your circle organiser:',
    inviteTokenLabel: lang === 'hi' ? 'आमंत्रण टोकन (UUID)' : 'Invite Token (UUID)',
    createBtn: lang === 'hi' ? 'समूह बनाएं' : 'Create Circle',
    nameLabel: lang === 'hi' ? 'समूह का नाम' : 'Circle Name',
    descLabel: lang === 'hi' ? 'विवरण (वैकल्पिक)' : 'Description (Optional)',
    memberCountLabel: lang === 'hi' ? 'कुल सदस्यों की संख्या (5 - 50)' : 'Total Members (5 - 50)',
    contributionLabel: lang === 'hi' ? 'प्रति सदस्य योगदान (₹500 - ₹50,000)' : 'Contribution per Member (₹500 - ₹50,000)',
    durationLabel: lang === 'hi' ? 'अवधि महीनों में (2 - 60)' : 'Duration (Months) (2 - 60)',
    commissionLabel: lang === 'hi' ? 'आयोजक कमीशन प्रतिशत (2% - 8%)' : 'Organiser Commission % (2% - 8%)',
    summaryTitle: lang === 'hi' ? 'लाइव चक्र कैलकुलेटर' : 'Live Summary Calculator',
    summaryPool: lang === 'hi' ? 'कुल एकत्रित पूल' : 'Total Collected Pool',
    summaryCommission: lang === 'hi' ? 'आयोजक कमीशन' : 'Organiser Commission',
    summaryPayout: lang === 'hi' ? 'शुद्ध पॉट आकार' : 'Net Payout Pot Size',
    infoTitle: lang === 'hi' ? 'चिट फंड कैसे काम करता है?' : 'How do Chit Funds work?',
    infoDesc: lang === 'hi' ? 'चिट फंड एक पारंपरिक बचत और ऋण मॉडल है। हर महीने सदस्य पैसे योगदान करते हैं। फिर कुल पूल के लिए बोली लगती है। जो सबसे कम बोली लगाता है उसे एकमुश्त राशि (पॉट) मिलती है, और शेष छूट राशि को सभी सदस्यों में लाभांश के रूप में बांट दिया जाता है।' : 'Chit funds are rotating peer-to-peer savings circles. In each cycle, members contribute a set amount. The total pool is put up for bidding. The lowest bidder wins the pool payout, and the remaining discount is returned to all participants as a dividend!'
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

  // Auto-set duration equal to member count when member count changes (standard chit fund rule)
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

  useEffect(() => {
    fetchGroups();
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
      toast.error(err.response?.data?.error || 'Failed to join group. Check the token validity.');
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
      toast.error(err.response?.data?.error || 'Failed to create group. Verify inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6 py-6">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-brand-dark tracking-tight">
            {l.title}
          </h1>
          <p className="text-sm text-brand-textMuted mt-1">
            {l.subtitle}
          </p>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('my-groups')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'my-groups' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {l.tabMyGroups}
        </button>
        <button
          onClick={() => setActiveTab('join')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'join' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {l.tabJoin}
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`py-3 px-6 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'create' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {l.tabCreate}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'my-groups' && (
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map(n => (
                <div key={n} className="premium-card p-6 h-56 animate-pulse bg-white dark:bg-slate-900" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="premium-card p-12 text-center max-w-xl mx-auto space-y-4">
              <Users className="w-16 h-16 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold text-brand-dark">{lang === 'hi' ? 'कोई सक्रिय समूह नहीं' : 'No Active Circles'}</h3>
              <p className="text-xs text-brand-textMuted leading-relaxed">
                {l.noGroups}
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('join')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-input transition-colors"
                >
                  {l.tabJoin}
                </button>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input transition-colors"
                >
                  {l.tabCreate}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {groups.map((group) => (
                <div key={group.id} className="premium-card p-6 flex flex-col justify-between hover:border-brand-primary/30">
                  <div>
                    <div className="flex justify-between items-start">
                      <StatusBadge status={group.status} />
                      <span className="text-xs font-bold text-slate-400 font-mono">
                        {group.invite_token ? `Token: ${group.invite_token.substring(0, 8)}...` : ''}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-brand-dark mt-4">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-brand-textMuted mt-1 leading-relaxed line-clamp-2">
                        {group.description}
                      </p>
                    )}
                    
                    <div className="grid grid-cols-3 gap-4 mt-6 bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-brand-textMuted">{l.poolSize}</p>
                        <p className="text-xs md:text-sm font-black text-brand-textPrimary mt-0.5">
                          {formatINR(group.member_count * group.contribution_per_member)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-brand-textMuted">{l.monthlyDue}</p>
                        <p className="text-xs md:text-sm font-black text-brand-textPrimary mt-0.5">
                          {formatINR(group.contribution_per_member)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-brand-textMuted">{l.duration}</p>
                        <p className="text-xs md:text-sm font-black text-brand-textPrimary mt-0.5">
                          {group.duration_months} {lang === 'hi' ? 'महीने' : 'Mo'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 mt-6 pt-4 flex items-center justify-between">
                    <span className="text-xs text-brand-textMuted flex items-center gap-1.5 font-medium">
                      <Calendar size={14} />
                      {group.status === 'forming' ? (lang === 'hi' ? 'निर्माण चरण' : 'Forming Phase') : l.nextAuction}
                    </span>
                    <button
                      onClick={() => navigate(`/chit/${group.id}`)}
                      className="flex items-center gap-1 text-xs font-bold text-brand-primary hover:text-brand-dark transition-all duration-200 group"
                    >
                      {l.manageBtn}
                      <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'join' && (
        <div className="max-w-xl mx-auto premium-card p-6 space-y-6">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl mt-0.5">
              <Link2 size={20} />
            </div>
            <div>
              <h3 className="text-md font-bold text-brand-dark">{lang === 'hi' ? 'बचत सर्कल में शामिल हों' : 'Join a Savings Circle'}</h3>
              <p className="text-xs text-brand-textMuted mt-0.5">{l.joinDesc}</p>
            </div>
          </div>

          <form onSubmit={handleJoinSubmit(onJoinSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{l.inviteTokenLabel}</label>
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
              className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input active:scale-98 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {l.joinBtn} <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Form */}
          <div className="lg:col-span-2 premium-card p-6">
            <h3 className="text-md font-bold text-brand-dark mb-5 flex items-center gap-2">
              <Plus size={18} className="text-brand-primary" />
              {lang === 'hi' ? 'एक नया बचत चक्र कॉन्फ़िगर करें' : 'Configure a New Savings Circle'}
            </h3>

            <form onSubmit={handleCreateSubmit(onCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{l.nameLabel}</label>
                  <input
                    type="text"
                    {...registerCreate('name')}
                    placeholder="e.g. Premier Circle"
                    className="input-premium text-sm"
                  />
                  {createErrors.name && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1">{createErrors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{l.memberCountLabel}</label>
                  <input
                    type="number"
                    {...registerCreate('member_count')}
                    className="input-premium text-sm"
                  />
                  {createErrors.member_count && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1">{createErrors.member_count.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{l.descLabel}</label>
                <textarea
                  {...registerCreate('description')}
                  rows="2"
                  placeholder="e.g. Monthly micro-savings pool for transport operators."
                  className="input-premium text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{l.contributionLabel}</label>
                  <input
                    type="number"
                    {...registerCreate('contribution_per_member')}
                    className="input-premium text-sm font-mono"
                  />
                  {createErrors.contribution_per_member && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1">{createErrors.contribution_per_member.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">
                    {l.durationLabel}
                  </label>
                  <input
                    type="number"
                    {...registerCreate('duration_months')}
                    className="input-premium text-sm"
                    disabled
                  />
                  <span className="text-[8px] text-brand-textMuted mt-1 block">Locked to number of members</span>
                  {createErrors.duration_months && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1">{createErrors.duration_months.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{l.commissionLabel}</label>
                  <input
                    type="number"
                    {...registerCreate('organiser_commission_pct')}
                    className="input-premium text-sm font-mono"
                  />
                  {createErrors.organiser_commission_pct && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1">{createErrors.organiser_commission_pct.message}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input active:scale-98 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {l.createBtn} <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Calculator Info Panel */}
          <div className="space-y-6">
            <div className="premium-card p-6 bg-gradient-to-br from-brand-primary/5 to-white dark:from-slate-900 dark:to-slate-900 border border-brand-primary/10">
              <h3 className="text-md font-bold text-brand-dark flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-brand-primary animate-pulse" />
                {l.summaryTitle}
              </h3>
              
              <div className="space-y-3.5 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="flex justify-between items-center py-2 first:pt-0">
                  <span className="text-xs font-semibold text-brand-textMuted">{l.summaryPool}</span>
                  <span className="text-sm font-black text-brand-textPrimary font-mono">{formatINR(totalPool)}</span>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-semibold text-brand-textMuted">{l.summaryCommission}</span>
                  <span className="text-sm font-black text-brand-textPrimary font-mono text-rose-500">-{formatINR(commission)}</span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-bold text-brand-primary">{l.summaryPayout}</span>
                  <span className="text-base font-black text-brand-primary font-mono">{formatINR(netPayout)}</span>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-brand-primary/5 border border-brand-primary/10 rounded-lg flex gap-2">
                <Info size={16} className="text-brand-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-brand-textMuted leading-relaxed">
                  {lang === 'hi'
                    ? 'प्रत्येक चक्र में जीतने वाले सदस्य को शुद्ध पॉट राशि में से विजेता की छूट घटाकर भुगतान किया जाएगा।'
                    : 'The cycle winning bidder will receive the net payout pot minus their submitted discount bid.'}
                </p>
              </div>
            </div>

            {/* Info Accordion */}
            <div className="premium-card p-6 bg-brand-dark text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 rounded-full bg-brand-secondary/20 blur-xl pointer-events-none" />
              <h3 className="text-md font-bold mb-2 flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-brand-secondary" />
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
