import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useLanguageStore } from '../lib/languageStore';
import { formatINR } from '../lib/utils';
import StatusBadge from '../components/shared/StatusBadge';
import { 
  Coins, 
  ShieldCheck, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Info, 
  Star,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Lending() {
  const { lang, t } = useLanguageStore();

  // App States
  const [lenders, setLenders] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter States
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'NBFC', 'P2P', 'SHG', 'MFI'
  const [onlyGigCert, setOnlyGigCert] = useState(false);
  const [sortBy, setSortBy] = useState('interest'); // 'interest', 'max_loan'

  // Calculator States
  const [loanAmount, setLoanAmount] = useState(50000);
  const [loanTenure, setLoanTenure] = useState(12); // months
  const [loanPurpose, setLoanPurpose] = useState('Business/Shop Expansion');

  // Application Modal States
  const [selectedLender, setSelectedLender] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);

  // Localized Strings
  const l = {
    title: lang === 'hi' ? 'पी2पी क्रेडिट और ऋण' : 'Verified P2P Credit',
    subtitle: lang === 'hi' ? 'स्थानीय साहूकारों से बचें। आरबीआई-पंजीकृत एनबीएफसी से कम ब्याज दर पर ऋण लें।' : 'Avoid predatory moneylenders. Borrow from RBI-registered NBFCs starting at 9.9% p.a.',
    lenderList: lang === 'hi' ? 'सत्यापित ऋण प्रदाता' : 'Verified Lending Partners',
    applicationsTracker: lang === 'hi' ? 'आपके आवेदन ट्रैकर' : 'Credit Request History',
    searchPlaceholder: lang === 'hi' ? 'प्रदाता का नाम खोजें...' : 'Search lenders by name...',
    sortByInterest: lang === 'hi' ? 'कम ब्याज दर' : 'Lowest Interest Rate',
    sortByMaxLoan: lang === 'hi' ? 'उच्च ऋण सीमा' : 'Highest Loan Limit',
    gigCertFilter: lang === 'hi' ? 'गिग सर्टिफिकेट स्वीकार्य' : 'Accepts Gig Certificate',
    emiCalcTitle: lang === 'hi' ? 'ईएमआई (EMI) कैलकुलेटर' : 'EMI Calculator & Estimator',
    loanAmountLabel: lang === 'hi' ? 'ऋण राशि' : 'Loan Amount',
    tenureLabel: lang === 'hi' ? 'ऋण अवधि (महीने)' : 'Tenure (Months)',
    purposeLabel: lang === 'hi' ? 'ऋण का उद्देश्य' : 'Loan Purpose',
    emiTitle: lang === 'hi' ? 'मासिक ईएमआई' : 'Estimated Monthly EMI',
    totalInterest: lang === 'hi' ? 'कुल देय ब्याज' : 'Total Interest Due',
    totalPayment: lang === 'hi' ? 'कुल पुनर्भुगतान' : 'Total Repayment',
    comparisonTitle: lang === 'hi' ? 'साहूकार बनाम SafeKosh बचत तुलना' : 'Predatory Moneylender vs SafeKosh Saving',
    comparisonDesc: lang === 'hi' ? 'स्थानीय साहूकार आमतौर पर ३% प्रति माह (३६% वार्षिक) फ्लैट ब्याज वसूलते हैं।' : 'Informal moneylenders typically charge a predatory 3% per month flat rate (36% p.a.).',
    moneylenderInterest: lang === 'hi' ? 'साहूकार का ब्याज' : 'Moneylender Interest',
    safekoshInterest: lang === 'hi' ? 'SafeKosh पर ब्याज' : 'SafeKosh Partner Interest',
    youSave: lang === 'hi' ? 'आपकी कुल बचत' : 'Your Total Net Savings',
    applyBtn: lang === 'hi' ? 'ऋण के लिए आवेदन करें' : 'Apply for Loan',
    documentsNeeded: lang === 'hi' ? 'आवश्यक दस्तावेज' : 'Documents Required',
    rbiRegistered: lang === 'hi' ? 'आरबीआई पंजीकरण संख्या' : 'RBI Registration',
    viewAmortization: lang === 'hi' ? 'पुनर्भुगतान अनुसूची (Amortization) देखें' : 'View Repayment Schedule (Amortization)',
    hideAmortization: lang === 'hi' ? 'अनुसूची छिपाएं' : 'Hide Amortization',
    noLenders: lang === 'hi' ? 'कोई ऋणदाता नहीं मिला जो आपकी शर्तों से मेल खाता हो।' : 'No lenders match your search filters.',
    noApplications: lang === 'hi' ? 'आपने अभी तक किसी ऋण के लिए आवेदन नहीं किया है।' : 'No credit application history found.'
  };

  // Helper formula: EMI = [P x r x (1+r)^n]/[((1+r)^n)-1]
  const calculateEMI = (principal, annualRate, tenureMonths) => {
    if (annualRate === 0) return Math.round(principal / tenureMonths);
    const r = annualRate / 12 / 100;
    const n = tenureMonths;
    const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.round(emi);
  };

  // Generate Amortization Table
  const generateAmortization = (principal, annualRate, tenureMonths) => {
    const table = [];
    const emi = calculateEMI(principal, annualRate, tenureMonths);
    const r = annualRate / 12 / 100;
    let balance = principal;

    for (let month = 1; month <= tenureMonths; month++) {
      const interestPaid = Math.round(balance * r);
      const principalPaid = Math.round(emi - interestPaid);
      balance = Math.max(0, balance - principalPaid);
      
      table.push({
        month,
        payment: emi,
        principal: principalPaid,
        interest: interestPaid,
        balance: month === tenureMonths ? 0 : balance
      });
    }
    return table;
  };

  const fetchLenders = useCallback(async () => {
    try {
      const res = await api.get(`/api/lending/lenders?amount=${loanAmount}&accepts_gig_cert=${onlyGigCert}`);
      if (res.data?.success) {
        setLenders(res.data.lenders || []);
      }
    } catch (err) {
      console.error('Error fetching lenders:', err);
    }
  }, [loanAmount, onlyGigCert]);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await api.get('/api/lending/applications');
      if (res.data?.success) {
        setApplications(res.data.applications || []);
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
    }
  }, []);

  // Initialize
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchLenders(), fetchApplications()]);
      setLoading(false);
    };
    init();
  }, [fetchLenders, fetchApplications]);

  // Refetch when loan amount or gig certificate filter changes
  useEffect(() => {
    fetchLenders();
  }, [loanAmount, onlyGigCert, fetchLenders]);

  // Apply Click Handler
  const handleApplyClick = (lender) => {
    setSelectedLender(lender);
    setShowApplyModal(true);
  };

  // Trigger track-click webhook simulation
  const handleConfirmApply = async () => {
    setApplying(true);
    try {
      const res = await api.post('/api/lending/track-click', {
        lender_id: selectedLender.id,
        loan_amount: loanAmount,
        loan_purpose: loanPurpose
      });
      if (res.data?.success) {
        toast.success(
          lang === 'hi' 
            ? `${selectedLender.name} पर आपका आवेदन दर्ज हो गया!` 
            : `Application registered for ${selectedLender.name}!`
        );
        setShowApplyModal(false);
        fetchApplications();
        
        // Open NBFC application website
        if (selectedLender.apply_url && selectedLender.apply_url !== '#') {
          window.open(selectedLender.apply_url, '_blank');
        }
      }
    } catch (err) {
      toast.error('Failed to submit loan request.');
    } finally {
      setApplying(false);
    }
  };

  // Moneylender calculations (3% flat per month)
  const moneylenderTotalInterest = Math.round(loanAmount * 0.03 * loanTenure);
  const moneylenderTotalRepay = loanAmount + moneylenderTotalInterest;

  // Selected or lowest interest lender stats for comparison
  const selectedInterestRate = lenders.length > 0 ? lenders[0].interest_rate_annual : 15.0;
  const safekoshEmi = calculateEMI(loanAmount, selectedInterestRate, loanTenure);
  const safekoshTotalRepay = safekoshEmi * loanTenure;
  const safekoshTotalInterest = Math.max(0, safekoshTotalRepay - loanAmount);
  const netSavings = Math.max(0, moneylenderTotalInterest - safekoshTotalInterest);

  // Search & Filter Logic
  const filteredLenders = lenders.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || l.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Sort Logic
  if (sortBy === 'interest') {
    filteredLenders.sort((a, b) => a.interest_rate_annual - b.interest_rate_annual);
  } else if (sortBy === 'max_loan') {
    filteredLenders.sort((a, b) => b.max_loan - a.max_loan);
  }

  // Get Amortization dataset
  const amortizationData = generateAmortization(loanAmount, selectedInterestRate, loanTenure);

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
      </div>

      {/* Moneylender Savings Comparison Card */}
      <div className="premium-card p-6 bg-gradient-to-r from-emerald-50 via-white to-teal-50/20 border border-emerald-150 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <h3 className="text-md font-bold text-brand-dark flex items-center gap-1.5 mb-2">
          <ShieldCheck className="text-brand-primary" />
          {l.comparisonTitle}
        </h3>
        <p className="text-xs text-brand-textMuted mb-4 leading-relaxed">{l.comparisonDesc}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
            <span className="text-[10px] font-bold text-rose-500 uppercase">{l.moneylenderInterest} (36% Flat)</span>
            <p className="text-xl font-black text-rose-700 mt-1">{formatINR(moneylenderTotalInterest)}</p>
          </div>
          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
            <span className="text-[10px] font-bold text-emerald-600 uppercase">{l.safekoshInterest} ({selectedInterestRate}% Avg)</span>
            <p className="text-xl font-black text-emerald-700 mt-1">{formatINR(safekoshTotalInterest)}</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl shadow-md flex flex-col justify-between">
            <span className="text-[10px] font-bold text-white/80 uppercase">{l.youSave}</span>
            <p className="text-2xl font-black mt-1">
              {formatINR(netSavings)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Calculator + Lender Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: EMI Calculator */}
        <div className="space-y-6">
          <div className="premium-card p-6">
            <h3 className="text-md font-bold text-brand-dark mb-5 flex items-center gap-2">
              <Coins size={18} className="text-brand-primary" />
              {l.emiCalcTitle}
            </h3>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-brand-textPrimary">{l.loanAmountLabel}</label>
                  <span className="text-xs font-black text-brand-primary">{formatINR(loanAmount)}</span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="500000"
                  step="5000"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                />
                <div className="flex justify-between text-[9px] text-brand-textMuted mt-1">
                  <span>₹5,000</span>
                  <span>₹5,00,000</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-brand-textPrimary">{l.tenureLabel}</label>
                  <span className="text-xs font-black text-brand-primary">{loanTenure} {lang === 'hi' ? 'महीने' : 'Months'}</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="60"
                  step="3"
                  value={loanTenure}
                  onChange={(e) => setLoanTenure(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                />
                <div className="flex justify-between text-[9px] text-brand-textMuted mt-1">
                  <span>3 Mo</span>
                  <span>60 Mo</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-textPrimary mb-1.5">{l.purposeLabel}</label>
                <input
                  type="text"
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  className="input-premium text-sm"
                  required
                />
              </div>

              {/* Calculator Output Display */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-brand-textMuted">{l.emiTitle}</span>
                  <span className="text-base font-black text-brand-dark font-mono">{formatINR(safekoshEmi)} / mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-brand-textMuted">{l.totalInterest}</span>
                  <span className="text-sm font-bold text-brand-textPrimary font-mono">{formatINR(safekoshTotalInterest)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-brand-primary">{l.totalPayment}</span>
                  <span className="text-sm font-black text-brand-primary font-mono">{formatINR(safekoshTotalRepay)}</span>
                </div>
              </div>

              {/* Toggle Repayment Schedule */}
              <button
                onClick={() => setShowAmortization(!showAmortization)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-input transition-all flex items-center justify-center gap-1 focus:outline-none"
              >
                {showAmortization ? l.hideAmortization : l.viewAmortization}
                {showAmortization ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Lenders Grid & Application tracker */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Amortization Table Accordion Block */}
          {showAmortization && (
            <div className="premium-card p-6 animate-fade-in max-h-96 overflow-y-auto">
              <h3 className="text-md font-bold text-brand-dark mb-4">Repayment Amortization Table</h3>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-brand-textMuted font-bold uppercase tracking-wider pb-2">
                    <th className="pb-2">Month</th>
                    <th className="pb-2">EMI Payment</th>
                    <th className="pb-2">Principal Repaid</th>
                    <th className="pb-2">Interest Paid</th>
                    <th className="pb-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-mono">
                  {amortizationData.map((row) => (
                    <tr key={row.month} className="text-brand-textPrimary hover:bg-slate-50/50">
                      <td className="py-2.5 font-bold">Month {row.month}</td>
                      <td className="py-2.5">{formatINR(row.payment)}</td>
                      <td className="py-2.5 text-emerald-600">{formatINR(row.principal)}</td>
                      <td className="py-2.5 text-rose-500">{formatINR(row.interest)}</td>
                      <td className="py-2.5 text-right font-bold">{formatINR(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Lenders Listings Card */}
          <div className="premium-card p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-brand-dark">{l.lenderList}</h3>
                <p className="text-xs text-brand-textMuted">Regulated institutional NBFC micro-credits.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Sort dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="interest">{l.sortByInterest}</option>
                  <option value="max_loan">{l.sortByMaxLoan}</option>
                </select>

                {/* Gig certificate filter toggle */}
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyGigCert}
                    onChange={(e) => setOnlyGigCert(e.target.checked)}
                    className="accent-brand-primary rounded"
                  />
                  <span>{l.gigCertFilter}</span>
                </label>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-5">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={l.searchPlaceholder}
                className="input-premium pl-10 text-xs py-3"
              />
            </div>

            {/* Lenders List cards */}
            <div className="space-y-4">
              {filteredLenders.map((lender) => {
                const isTenureCapped = loanTenure > lender.max_tenure_months;
                const activeTenure = isTenureCapped ? lender.max_tenure_months : loanTenure;
                const dynamicEmi = calculateEMI(loanAmount, lender.interest_rate_annual, activeTenure);

                return (
                  <div 
                    key={lender.id} 
                    className="p-5 border border-slate-100 dark:border-slate-800 rounded-card bg-white dark:bg-slate-900 hover:border-brand-primary/20 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all duration-200"
                  >
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-sm"
                          style={{ backgroundColor: `#${lender.logo_color}` }}
                        >
                          {lender.logo_initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-brand-textPrimary text-sm">{lender.name}</h4>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400">
                              {lender.type}
                            </span>
                            {lender.accepts_gig_cert && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 flex items-center gap-0.5">
                                <ShieldCheck size={10} />
                                Gig Cert Accepted
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-brand-textMuted font-mono">
                            {l.rbiRegistered}: {lender.rbi_registration}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-xs text-brand-textMuted leading-relaxed">
                        {lang === 'hi' ? lender.description_hi : lender.description_en}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6 shrink-0">
                      <div>
                        <span className="text-[9px] font-bold text-brand-textMuted uppercase">{l.emiTitle}</span>
                        <p className="text-sm font-black text-brand-dark mt-0.5">{formatINR(dynamicEmi)}</p>
                        {isTenureCapped && (
                          <span className="text-[8px] text-rose-500 font-semibold leading-none mt-0.5 block">
                            (Capped at {lender.max_tenure_months} mo)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-brand-textMuted uppercase">Interest Rate</span>
                        <p className="text-sm font-black text-brand-textPrimary mt-0.5">{lender.interest_rate_annual}%</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-brand-textMuted uppercase">Processing Fee</span>
                        <p className="text-sm font-bold text-brand-textPrimary mt-0.5">
                          {lender.processing_fee_pct > 0 ? `${lender.processing_fee_pct}%` : 'Free'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pt-2 md:pt-0">
                      <button
                        onClick={() => handleApplyClick(lender)}
                        className="w-full md:w-auto px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all duration-200"
                      >
                        {l.applyBtn}
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredLenders.length === 0 && (
                <div className="py-12 text-center text-sm text-brand-textMuted">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  {l.noLenders}
                </div>
              )}
            </div>
          </div>

          {/* Applications tracker logs */}
          <div className="premium-card p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-4">{l.applicationsTracker}</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-brand-textMuted text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Lender</th>
                    <th className="pb-3">Amount Requested</th>
                    <th className="pb-3">Date Applied</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {applications.map((app) => (
                    <tr key={app.id} className="text-brand-textPrimary hover:bg-slate-50/50">
                      <td className="py-4 font-bold">{app.lender_name}</td>
                      <td className="py-4 font-black">{formatINR(app.loan_amount)}</td>
                      <td className="py-4 text-xs text-brand-textMuted">
                        {new Date(app.clicked_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-4 text-right">
                        <StatusBadge status={app.disbursed ? 'completed' : 'pending'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {applications.length === 0 && (
                <div className="py-8 text-center text-sm text-brand-textMuted">
                  {l.noApplications}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Apply Loan Modal */}
      <ConfirmModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title={lang === 'hi' ? `${selectedLender?.name} ऋण आवेदन` : `${selectedLender?.name} Credit Application`}
        confirmText={lang === 'hi' ? 'वेबसाइट खोलें और आवेदन करें' : 'Open Website & Apply'}
        cancelText={lang === 'hi' ? 'रद्द करें' : 'Cancel'}
        onConfirm={handleConfirmApply}
        loading={applying}
        variant="safe"
      >
        <div className="space-y-4 py-2 text-left">
          <p className="text-xs text-brand-textMuted leading-relaxed">
            {lang === 'hi'
              ? `SafeKosh के माध्यम से ${selectedLender?.name} पर आवेदन दर्ज करने के लिए पुष्टि करें। आवेदन पूरा करने के लिए NBFC की वेबसाइट एक सुरक्षित नई टैब में खुल जाएगी।`
              : `Proceeding will record your referral click on SafeKosh and redirect you to ${selectedLender?.name}'s secure application portal in a new browser tab.`}
          </p>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-brand-textPrimary">
              <span>{l.loanAmountLabel}</span>
              <span className="font-mono">{formatINR(loanAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-brand-textPrimary">
              <span>{l.tenureLabel}</span>
              <span className="font-mono">{loanTenure} mo</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-brand-textPrimary">
              <span>{l.purposeLabel}</span>
              <span>{loanPurpose}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-brand-textPrimary">{l.documentsNeeded}</label>
            <div className="flex flex-wrap gap-1.5">
              {selectedLender?.documents.map((doc) => (
                <span key={doc} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-[10px] font-bold text-slate-700 dark:text-slate-350">
                  {doc}
                </span>
              ))}
            </div>
          </div>
        </div>
      </ConfirmModal>

    </div>
  );
}
