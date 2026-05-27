import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useLanguageStore } from '../lib/languageStore';
import { formatINR } from '../lib/utils';
import StatusBadge from '../components/shared/StatusBadge';
import ConfirmModal from '../components/shared/ConfirmModal';
import { toast } from 'react-hot-toast';

export default function Lending() {
  const { lang, t } = useLanguageStore();

  // App States
  const [lenders, setLenders] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter States
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [onlyGigCert, setOnlyGigCert] = useState(false);
  const [sortBy, setSortBy] = useState('interest');

  // Calculator States
  const [loanAmount, setLoanAmount] = useState(50000);
  const [loanTenure, setLoanTenure] = useState(12);
  const [loanPurpose, setLoanPurpose] = useState('Business/Shop Expansion');

  // Application Modal States
  const [selectedLender, setSelectedLender] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);

  // Localized Strings
  const l = {
    title: lang === 'hi' ? 'पी2पी क्रेडिट और ऋण' : 'Fair Credit for Every Mile',
    subtitle: lang === 'hi' ? 'स्थानीय साहूकारों से बचें। आरबीआई-पंजीकृत एनबीएफसी से कम ब्याज दर पर ऋण लें।' : 'Stop the cycle of predatory debt. Our NBFC-partnered loans are designed specifically for gig workers with transparent rates.',
    lenderList: lang === 'hi' ? 'सत्यापित ऋण प्रदाता' : 'Verified Lending Partners',
    applicationsTracker: lang === 'hi' ? 'आपके आवेदन ट्रैकर' : 'Credit Request History',
    searchPlaceholder: lang === 'hi' ? 'प्रदाता का नाम खोजें...' : 'Search lenders by name...',
    sortByInterest: lang === 'hi' ? 'कम ब्याज दर' : 'Lowest Interest Rate',
    sortByMaxLoan: lang === 'hi' ? 'उच्च ऋण सीमा' : 'Highest Loan Limit',
    gigCertFilter: lang === 'hi' ? 'गिग सर्टिफिकेट स्वीकार्य' : 'Accepts Gig Certificate',
    emiCalcTitle: lang === 'hi' ? 'ईएमआई (EMI) कैलकुलेटर' : 'Impact Calculator',
    loanAmountLabel: lang === 'hi' ? 'ऋण राशि' : 'Loan Amount',
    tenureLabel: lang === 'hi' ? 'ऋण अवधि (महीने)' : 'Tenure (Months)',
    purposeLabel: lang === 'hi' ? 'ऋण का उद्देश्य' : 'Loan Purpose',
    emiTitle: lang === 'hi' ? 'मासिक ईएमआई' : 'Est. Monthly EMI',
    totalInterest: lang === 'hi' ? 'कुल देय ब्याज' : 'Total Interest Due',
    totalPayment: lang === 'hi' ? 'कुल पुनर्भुगतान' : 'Total Repayment',
    comparisonTitle: lang === 'hi' ? 'साहूकार बनाम SafeKosh बचत तुलना' : 'Predatory Lender vs SafeKosh',
    comparisonDesc: lang === 'hi' ? 'स्थानीय साहूकार आमतौर पर ३% प्रति माह (३६% वार्षिक) फ्लैट ब्याज वसूलते हैं।' : 'Informal moneylenders typically charge a predatory 45% APR flat rate.',
    moneylenderInterest: lang === 'hi' ? 'साहूकार का ब्याज' : 'Unregulated Lenders',
    safekoshInterest: lang === 'hi' ? 'SafeKosh पर ब्याज' : 'SafeKosh (NBFC Partnered)',
    youSave: lang === 'hi' ? 'आपकी कुल बचत' : 'You Save with SafeKosh',
    applyBtn: lang === 'hi' ? 'ऋण के लिए आवेदन करें' : 'Apply for Loan',
    documentsNeeded: lang === 'hi' ? 'आवश्यक दस्तावेज' : 'Documents Required',
    rbiRegistered: lang === 'hi' ? 'आरबीआई पंजीकरण संख्या' : 'RBI Reg.',
    viewAmortization: lang === 'hi' ? 'पुनर्भुगतान अनुसूची देखें' : 'View Repayment Schedule',
    hideAmortization: lang === 'hi' ? 'अनुसूची छिपाएं' : 'Hide Schedule',
    noLenders: lang === 'hi' ? 'कोई ऋणदाता नहीं मिला।' : 'No lenders match your search filters.',
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

  // Moneylender calculations (45% APR simplified)
  const timeInYears = loanTenure / 12;
  const predatoryTotal = Math.round(loanAmount + (loanAmount * 0.45 * timeInYears));
  const predatoryInterest = predatoryTotal - loanAmount;

  // Selected or lowest interest lender stats for comparison
  const selectedInterestRate = lenders.length > 0 ? lenders[0].interest_rate_annual : 15.0;
  const safekoshEmi = calculateEMI(loanAmount, selectedInterestRate, loanTenure);
  const safekoshTotalRepay = safekoshEmi * loanTenure;
  const safekoshTotalInterest = Math.max(0, safekoshTotalRepay - loanAmount);
  const netSavings = Math.max(0, predatoryInterest - safekoshTotalInterest);

  // Visual bar widths
  const maxVal = loanAmount * 1.6;
  const predatoryBarW = Math.min(100, Math.round((predatoryTotal / maxVal) * 100));
  const safeBarW = Math.min(100, Math.round((safekoshTotalRepay / maxVal) * 100));

  // Search & Filter Logic
  const filteredLenders = lenders.filter(ldr => {
    const matchesSearch = ldr.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || ldr.type === typeFilter;
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

  const tenureOptions = [3, 6, 12, 24, 36];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6 py-6">
      
      {/* Hero Section */}
      <section className="mb-stack-lg text-center md:text-left">
        <h1 className="font-headline-lg text-headline-lg md:text-display-lg text-primary mb-stack-sm tracking-tight">
          {l.title}
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          {l.subtitle}
        </p>
      </section>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-lg">
        
        {/* Impact Calculator — Large Feature (8 cols) */}
        <div className="md:col-span-8 glass-effect rounded-2xl p-stack-lg shadow-sm border border-outline-variant/30">
          <div className="flex items-center gap-stack-sm mb-stack-lg">
            <span className="material-symbols-outlined text-primary text-3xl">analytics</span>
            <h2 className="font-headline-md text-headline-md">{l.emiCalcTitle}</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-stack-lg">
            {/* Inputs */}
            <div className="space-y-stack-lg">
              {/* Loan Amount Slider */}
              <div className="space-y-stack-sm">
                <div className="flex justify-between items-center">
                  <label className="font-label-md text-label-md text-on-surface-variant block">{l.loanAmountLabel}</label>
                  <span className="font-label-md text-primary font-bold">{formatINR(loanAmount)}</span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="500000"
                  step="5000"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full h-2 bg-surface-variant rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between font-label-md text-label-md text-on-surface-variant text-[11px]">
                  <span>₹5,000</span>
                  <span>₹5,00,000</span>
                </div>
              </div>

              {/* Tenure Button Group */}
              <div className="space-y-stack-sm">
                <label className="font-label-md text-label-md text-on-surface-variant block">{l.tenureLabel}</label>
                <div className="grid grid-cols-5 gap-2">
                  {tenureOptions.map(mo => (
                    <button
                      key={mo}
                      onClick={() => setLoanTenure(mo)}
                      className={`py-2 rounded-lg border font-label-md text-label-md active:scale-95 transition-all text-xs ${
                        loanTenure === mo
                          ? 'border-2 border-primary bg-primary-fixed text-on-primary-fixed font-bold'
                          : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      {mo}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Purpose Input */}
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant block mb-1">{l.purposeLabel}</label>
                <input
                  type="text"
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  className="input-premium text-sm"
                  required
                />
              </div>

              {/* Financial Literacy Tip */}
              <div className="p-stack-md bg-surface-container rounded-lg border border-outline-variant/30">
                <h3 className="font-label-md text-label-md text-primary mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  {lang === 'hi' ? 'वित्तीय साक्षरता टिप' : 'Financial Literacy Tip'}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant text-xs leading-relaxed">
                  {lang === 'hi'
                    ? 'साहूकार अक्सर "प्रोसेसिंग फीस" में ऊंचे ब्याज को छुपाते हैं। हमेशा कुल पुनर्भुगतान राशि की जाँच करें।'
                    : 'Predatory lenders often hide high interest in "processing fees." Always check the total repayment amount before signing.'}
                </p>
              </div>
            </div>

            {/* Visual Contrast — Comparison Bars */}
            <div className="space-y-stack-md">
              {/* Predatory lender card */}
              <div className="p-stack-md rounded-xl border-l-4 border-error bg-error-container/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-label-md text-label-md text-error font-semibold">{l.moneylenderInterest}</span>
                  <span className="material-symbols-outlined text-error text-[20px]">warning</span>
                </div>
                <div className="font-financial-xl text-financial-xl text-on-surface mb-1">
                  {formatINR(predatoryTotal)}
                </div>
                <p className="font-label-md text-label-md text-on-surface-variant text-xs">
                  {lang === 'hi' ? 'कुल पुनर्भुगतान (Avg. 45% APR)' : 'Total repayment (Avg. 45% APR)'}
                </p>
                <div className="mt-4 h-2 bg-outline-variant rounded-full overflow-hidden">
                  <div
                    className="h-full bg-error transition-all duration-500 rounded-full"
                    style={{ width: `${predatoryBarW}%` }}
                  />
                </div>
              </div>

              {/* SafeKosh card */}
              <div className="p-stack-md rounded-xl border-l-4 border-secondary bg-secondary-container/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-label-md text-label-md text-secondary font-semibold">{l.safekoshInterest}</span>
                  <span className="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
                </div>
                <div className="font-financial-xl text-financial-xl text-on-surface mb-1">
                  {formatINR(safekoshTotalRepay)}
                </div>
                <p className="font-label-md text-label-md text-on-surface-variant text-xs">
                  {lang === 'hi' ? `कुल पुनर्भुगतान (${selectedInterestRate}% APR)` : `Total repayment (${selectedInterestRate}% APR)`}
                </p>
                <div className="mt-4 h-2 bg-outline-variant rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary transition-all duration-500 rounded-full"
                    style={{ width: `${safeBarW}%` }}
                  />
                </div>
              </div>

              {/* Savings Summary */}
              <div className="p-stack-md rounded-xl bg-primary-container text-on-primary-container text-center">
                <p className="text-label-md font-bold mb-1">{l.youSave}</p>
                <p className="font-financial-xl text-financial-xl">{formatINR(netSavings)}</p>
                <p className="text-xs opacity-80 mt-1">
                  {lang === 'hi' ? 'SafeKosh NBFC पार्टनर के साथ' : 'with SafeKosh NBFC partners vs. moneylenders'}
                </p>
              </div>

              {/* EMI Output */}
              <div className="pt-3 border-t border-outline-variant/30 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-on-surface-variant">{l.emiTitle}</span>
                  <span className="font-black text-on-surface font-mono">{formatINR(safekoshEmi)} / mo</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-on-surface-variant">{l.totalInterest}</span>
                  <span className="font-bold text-on-surface font-mono">{formatINR(safekoshTotalInterest)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-primary">{l.totalPayment}</span>
                  <span className="font-black text-primary font-mono">{formatINR(safekoshTotalRepay)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Toggle Repayment Schedule */}
          <button
            onClick={() => setShowAmortization(!showAmortization)}
            className="mt-stack-lg w-full py-2.5 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant rounded-xl text-on-surface font-label-md flex items-center justify-center gap-1.5 focus:outline-none transition-all cursor-pointer text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">{showAmortization ? 'expand_less' : 'expand_more'}</span>
            {showAmortization ? l.hideAmortization : l.viewAmortization}
          </button>
        </div>

        {/* Right Panel: Empowerment Cards (4 cols) */}
        <div className="md:col-span-4 space-y-4">
          {[
            { icon: 'speed', title: lang === 'hi' ? 'त्वरित स्वीकृति' : 'Quick Approval', desc: lang === 'hi' ? '12 घंटे में अपने वॉलेट में पैसा पाएं।' : 'Get funds in your wallet within 12 hours of verification.', color: 'text-primary' },
            { icon: 'trending_up', title: lang === 'hi' ? 'क्रेडिट स्कोर बनाएं' : 'Build Credit Score', desc: lang === 'hi' ? 'नियमित भुगतान आपके भविष्य में मदद करेगा।' : 'Regular payments are reported to bureaus to help your future.', color: 'text-secondary' },
            { icon: 'event_repeat', title: lang === 'hi' ? 'लेट पेनल्टी नहीं' : 'No Late Penalties', desc: lang === 'hi' ? 'कम कमाई के दौरान एक सप्ताह का भुगतान छोड़ें।' : 'Skip one week\'s payment during low-earnings without a fine.', color: 'text-tertiary' },
          ].map((card) => (
            <div key={card.icon} className="glass-effect rounded-2xl p-stack-md relative overflow-hidden group border border-outline-variant/20 hover:border-primary/20 transition-all shadow-sm">
              <div className="relative z-10">
                <span className={`material-symbols-outlined ${card.color} mb-2 text-[28px]`}>{card.icon}</span>
                <h3 className="font-label-md text-label-md font-bold mb-1">{card.title}</h3>
                <p className="font-body-md text-on-surface-variant text-xs leading-relaxed">{card.desc}</p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <span className="material-symbols-outlined text-[100px]">{card.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Amortization Table (Full width, conditional) */}
        {showAmortization && (
          <div className="md:col-span-12 bento-card max-h-80 overflow-y-auto animate-fade-in">
            <h3 className="font-headline-md text-headline-md mb-4">
              {lang === 'hi' ? 'पुनर्भुगतान अनुसूची' : 'Repayment Amortization Schedule'}
            </h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-container-low">
                <tr className="border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider">
                  <th className="pb-2 p-2">Month</th>
                  <th className="pb-2 p-2">EMI Payment</th>
                  <th className="pb-2 p-2">Principal</th>
                  <th className="pb-2 p-2">Interest</th>
                  <th className="pb-2 p-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-mono">
                {amortizationData.map((row) => (
                  <tr key={row.month} className="text-on-surface hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-2.5 p-2 font-bold">Mo {row.month}</td>
                    <td className="py-2.5 p-2">{formatINR(row.payment)}</td>
                    <td className="py-2.5 p-2 text-secondary font-semibold">{formatINR(row.principal)}</td>
                    <td className="py-2.5 p-2 text-error">{formatINR(row.interest)}</td>
                    <td className="py-2.5 p-2 text-right font-bold">{formatINR(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Lenders Listings Card (8 cols) */}
        <div className="md:col-span-8 bento-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-headline-md text-headline-md">{l.lenderList}</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Regulated institutional NBFC micro-credits.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="interest">{l.sortByInterest}</option>
                <option value="max_loan">{l.sortByMaxLoan}</option>
              </select>

              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-xs font-bold text-on-surface cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyGigCert}
                  onChange={(e) => setOnlyGigCert(e.target.checked)}
                  className="accent-primary rounded"
                />
                <span>{l.gigCertFilter}</span>
              </label>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative mb-5">
            <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={l.searchPlaceholder}
              className="input-premium pl-10 text-xs py-3"
            />
          </div>

          {/* Lenders List */}
          <div className="space-y-4">
            {filteredLenders.map((lender) => {
              const isTenureCapped = loanTenure > lender.max_tenure_months;
              const activeTenure = isTenureCapped ? lender.max_tenure_months : loanTenure;
              const dynamicEmi = calculateEMI(loanAmount, lender.interest_rate_annual, activeTenure);

              return (
                <div 
                  key={lender.id} 
                  className="p-5 border border-outline-variant/30 rounded-2xl bg-surface-container-lowest hover:border-primary/20 hover:shadow-md shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all duration-200"
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
                          <h4 className="font-extrabold text-on-surface text-sm">{lender.name}</h4>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary-fixed text-on-primary-fixed">
                            {lender.type}
                          </span>
                          {lender.accepts_gig_cert && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-secondary-container/30 text-on-secondary-container flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[10px]">verified_user</span>
                              Gig Cert OK
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-on-surface-variant font-mono">
                          {l.rbiRegistered}: {lender.rbi_registration}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {lang === 'hi' ? lender.description_hi : lender.description_en}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 border-t md:border-t-0 md:border-l border-outline-variant/30 pt-4 md:pt-0 md:pl-6 shrink-0">
                    <div>
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">{l.emiTitle}</span>
                      <p className="text-sm font-black text-on-surface mt-0.5">{formatINR(dynamicEmi)}</p>
                      {isTenureCapped && (
                        <span className="text-[8px] text-error font-semibold leading-none mt-0.5 block">
                          (Max {lender.max_tenure_months}m)
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Rate</span>
                      <p className="text-sm font-black text-on-surface mt-0.5">{lender.interest_rate_annual}%</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Proc. Fee</span>
                      <p className="text-sm font-bold text-on-surface mt-0.5">
                        {lender.processing_fee_pct > 0 ? `${lender.processing_fee_pct}%` : 'Free'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 pt-2 md:pt-0">
                    <button
                      onClick={() => handleApplyClick(lender)}
                      className="w-full md:w-auto px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all duration-200"
                    >
                      {l.applyBtn}
                      <span className="material-symbols-outlined text-[16px]">arrow_outward</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredLenders.length === 0 && (
              <div className="py-12 text-center text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[48px] text-outline-variant block mb-3">search_off</span>
                {l.noLenders}
              </div>
            )}
          </div>
        </div>

        {/* Applications Tracker (4 cols) */}
        <div className="md:col-span-4 bento-card">
          <h3 className="font-headline-md text-headline-md mb-stack-lg">{l.applicationsTracker}</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant text-xs font-bold uppercase tracking-wider">
                  <th className="pb-3">Lender</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {applications.map((app) => (
                  <tr key={app.id} className="text-on-surface hover:bg-surface-container-low/30 transition-colors">
                    <td className="py-3 font-bold text-xs">
                      <div>{app.lender_name}</div>
                      <div className="text-[10px] text-on-surface-variant font-normal">
                        {new Date(app.clicked_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="py-3 font-black text-xs">{formatINR(app.loan_amount)}</td>
                    <td className="py-3 text-right">
                      <StatusBadge status={app.disbursed ? 'completed' : 'pending'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {applications.length === 0 && (
              <div className="py-8 text-center text-sm text-on-surface-variant font-semibold">
                <span className="material-symbols-outlined text-[36px] text-outline-variant block mb-2">receipt_long</span>
                {l.noApplications}
              </div>
            )}
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
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {lang === 'hi'
              ? `SafeKosh के माध्यम से ${selectedLender?.name} पर आवेदन दर्ज करने के लिए पुष्टि करें।`
              : `Proceeding will record your referral click on SafeKosh and redirect you to ${selectedLender?.name}'s secure application portal in a new browser tab.`}
          </p>

          <div className="bg-surface-container-low border border-outline-variant/30 p-4 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-on-surface">
              <span>{l.loanAmountLabel}</span>
              <span className="font-mono">{formatINR(loanAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-on-surface">
              <span>{l.tenureLabel}</span>
              <span className="font-mono">{loanTenure} mo</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-on-surface">
              <span>{l.purposeLabel}</span>
              <span>{loanPurpose}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-on-surface">{l.documentsNeeded}</label>
            <div className="flex flex-wrap gap-1.5">
              {selectedLender?.documents.map((doc) => (
                <span key={doc} className="px-2 py-0.5 rounded bg-surface-container-highest border border-outline-variant text-[10px] font-bold text-on-surface-variant">
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
