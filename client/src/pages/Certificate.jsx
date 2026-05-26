import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import { useAuth } from '../components/shared/AuthProvider';
import { useLanguageStore } from '../lib/languageStore';
import { formatINR } from '../lib/utils';
import BlockchainBadge from '../components/shared/BlockchainBadge';
import { QRCodeSVG } from 'qrcode.react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Award, 
  FileText, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Printer, 
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';

export default function Certificate() {
  const { user } = useAuth();
  const { lang, t } = useLanguageStore();

  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Generating state
  const [generatingId, setGeneratingId] = useState(null);
  const [generationStatus, setGenerationStatus] = useState(null); // 'generating', 'ready', 'failed'
  const [activeStep, setActiveStep] = useState(1);
  const [currentCert, setCurrentCert] = useState(null);
  
  const pollingInterval = useRef(null);

  // Localized strings
  const l = {
    title: lang === 'hi' ? 'स्मार्ट सर्टिफिकेट रजिस्ट्री' : 'Income Certificate Registry',
    subtitle: lang === 'hi' ? 'सुरक्षित ब्लॉकचेन सत्यापित आय प्रमाणपत्र और साख रिकॉर्ड।' : 'Anchor your gig income and credit records onto public blockchain certificates.',
    generateBtn: lang === 'hi' ? 'नया सर्टिफिकेट उत्पन्न करें' : 'Generate Income Certificate',
    loadingCert: lang === 'hi' ? 'सर्टिफिकेट तैयार किया जा रहा है...' : 'Generating Income Certificate...',
    step1: lang === 'hi' ? 'लेजर लेनदेन का विश्लेषण' : 'Ledger Analysis',
    step2: lang === 'hi' ? 'आय स्थिरता स्कोरिंग' : 'Consistency Scoring',
    step3: lang === 'hi' ? 'पॉलीगॉन पर एंकरिंग' : 'Anchoring to Polygon',
    step4: lang === 'hi' ? 'सर्टिफिकेट तैयार है!' : 'Certificate Ready!',
    verifiedSeal: lang === 'hi' ? 'सत्यापित' : 'SafeKosh Verified',
    monthlyAvg: lang === 'hi' ? 'मासिक औसत आय' : 'Avg Monthly Income',
    savingsIndex: lang === 'hi' ? 'बचत सुसंगतता' : '90-Day Savings Index',
    consistencyScore: lang === 'hi' ? 'विश्वसनीयता स्कोर' : 'Consistency Score',
    platformsTitle: lang === 'hi' ? 'संबद्ध प्लेटफॉर्म' : 'Associated Platforms',
    issuedDate: lang === 'hi' ? 'जारी तिथि' : 'Issued Date',
    validUntil: lang === 'hi' ? 'वैधता तिथि' : 'Valid Until',
    downloadPdf: lang === 'hi' ? 'पीडीएफ रसीद डाउनलोड करें' : 'Download PDF Receipt',
    printBtn: lang === 'hi' ? 'प्रिंट करें' : 'Print Certificate',
    registryTitle: lang === 'hi' ? 'आपके जनरेट किए गए सर्टिफिकेट' : 'Historical Certificates',
    noCerts: lang === 'hi' ? 'अभी तक कोई प्रमाणपत्र जनरेट नहीं किया गया।' : 'No certificates generated yet.',
    certRefLabel: lang === 'hi' ? 'सर्टिफिकेट संदर्भ' : 'Certificate Reference',
    warningLimit: lang === 'hi' ? 'प्रति दिन अधिकतम ३ सर्टिफिकेट जनरेट किए जा सकते हैं।' : 'Daily limit of 3 certificate generations applies.'
  };

  const fetchCertificates = useCallback(async () => {
    try {
      const res = await api.get('/api/certificate/my-certificates');
      if (res.data?.success) {
        setCertificates(res.data.certificates || []);
        
        // Check if there is an active generating certificate
        const generating = res.data.certificates.find(c => c.status === 'generating');
        if (generating) {
          setGeneratingId(generating.id);
          setGenerationStatus('generating');
          startPolling(generating.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
    return () => stopPolling();
  }, [fetchCertificates]);

  // Polling logic
  const startPolling = (id) => {
    stopPolling();
    let step = 1;
    setActiveStep(1);
    
    pollingInterval.current = setInterval(async () => {
      // Simulate stepper steps progress visually
      step = Math.min(step + 1, 3);
      setActiveStep(step);

      try {
        const res = await api.get(`/api/certificate/${id}`);
        if (res.data?.success) {
          const cert = res.data.certificate;
          
          if (cert && cert.status === 'ready') {
            stopPolling();
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 }
            });
            toast.success(lang === 'hi' ? 'सर्टिफिकेट सफलतापूर्वक तैयार!' : 'Income certificate generated successfully!');
            setActiveStep(4);
            setGenerationStatus('ready');
            setCurrentCert(cert);
            fetchCertificates();
          } else if (cert && cert.status === 'failed') {
            stopPolling();
            toast.error('Certificate generation failed. Try again.');
            setGenerationStatus('failed');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 4000); // Poll every 4 seconds
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  // Trigger certificate generation
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/certificate/generate');
      if (res.data?.success) {
        if (res.data.status === 'ready') {
          // Returned pre-existing certificate
          confetti({ particleCount: 100 });
          setCurrentCert(res.data.certificate);
          setGenerationStatus('ready');
          fetchCertificates();
        } else {
          // Started async generation
          setGeneratingId(res.data.certId);
          setGenerationStatus('generating');
          startPolling(res.data.certId);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate certificate.');
    } finally {
      setLoading(false);
    }
  };

  // Mock Recharts chart dataset (Income Trend over last 3 months)
  const getChartData = (avgIncome) => {
    const val = avgIncome || 32000;
    return [
      { month: lang === 'hi' ? 'मार्च' : 'Mar', Income: Math.round(val * 0.95) },
      { month: lang === 'hi' ? 'अप्रैल' : 'Apr', Income: Math.round(val * 1.05) },
      { month: lang === 'hi' ? 'मई' : 'May', Income: Math.round(val) }
    ];
  };

  const handlePrint = () => {
    window.print();
  };

  // Get active ready certificate to display
  const displayCert = currentCert || certificates.find(c => c.status === 'ready');

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6 py-6">
      
      {/* Header section (Non-printable) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-brand-dark tracking-tight">
            {l.title}
          </h1>
          <p className="text-sm text-brand-textMuted mt-1">
            {l.subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          {!generatingId && (
            <button
              onClick={handleGenerate}
              className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input active:scale-95 transition-all shadow-md flex items-center gap-1.5"
            >
              <Award size={14} />
              {l.generateBtn}
            </button>
          )}
        </div>
      </div>

      {/* Stepper progress layout during generation */}
      {generationStatus === 'generating' && (
        <div className="premium-card p-6 border-brand-primary/10 max-w-xl mx-auto space-y-6 print:hidden">
          <div className="text-center space-y-2">
            <Clock className="w-10 h-10 text-brand-primary animate-spin-slow mx-auto" />
            <h3 className="text-md font-bold text-brand-dark">{l.loadingCert}</h3>
            <p className="text-xs text-brand-textMuted">{lang === 'hi' ? 'इसमें लगभग ३० सेकंड का समय लग सकता है...' : 'This will take approximately 30 seconds. Checking ledger logs...'}</p>
          </div>

          {/* Steps rendering */}
          <div className="space-y-4">
            {[
              { num: 1, label: l.step1 },
              { num: 2, label: l.step2 },
              { num: 3, label: l.step3 }
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeStep > s.num ? 'bg-emerald-500 text-white' : activeStep === s.num ? 'bg-brand-primary text-white animate-pulse' : 'bg-slate-100 text-slate-400'
                }`}>
                  {activeStep > s.num ? '✓' : s.num}
                </div>
                <span className={`text-xs font-bold ${
                  activeStep === s.num ? 'text-brand-primary' : 'text-brand-textPrimary'
                }`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certificate view and detail grid */}
      {displayCert && generationStatus !== 'generating' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Certificate Card display (Printable) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* The Certificate itself */}
            <div className="relative border-8 border-double border-amber-600 bg-amber-50/15 p-6 md:p-10 rounded-card bg-white dark:bg-slate-900 shadow-premium flex flex-col justify-between min-h-[500px]">
              
              {/* Watermark/seal details */}
              <div className="absolute right-8 top-8 opacity-10 pointer-events-none">
                <Award size={150} className="text-amber-700" />
              </div>

              {/* Top border header */}
              <div className="flex justify-between items-start border-b border-amber-200/50 pb-4">
                <div>
                  <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-amber-800 dark:text-amber-500 uppercase">
                    SafeKosh Trust Protocol
                  </h2>
                  <p className="text-[10px] text-brand-textMuted font-bold tracking-wider mt-0.5">DECENTRALIZED CREDIT REGISTER</p>
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-2 py-0.5 rounded text-[9px] uppercase shadow-sm">
                  <CheckCircle2 size={10} />
                  {l.verifiedSeal}
                </div>
              </div>

              {/* Main content body */}
              <div className="my-6 space-y-5 text-center">
                <p className="text-[10px] uppercase font-bold text-brand-textMuted tracking-widest">THIS CREDENTIAL OFFICIALLY ATTESTS THAT</p>
                <h3 className="text-2xl font-black text-brand-textPrimary tracking-tight">
                  {user?.name || 'Verified SafeKosh Member'}
                </h3>
                <p className="text-xs text-brand-textMuted max-w-md mx-auto leading-relaxed">
                  has completed active rotating savings circles and held collateralized credit assets audited on-chain under unique certificate reference:
                </p>
                <span className="inline-block px-4 py-1.5 font-mono text-sm font-black bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded shadow-sm">
                  {displayCert.cert_ref}
                </span>
              </div>

              {/* Key Parameters Cards */}
              <div className="grid grid-cols-3 gap-3 md:gap-4 my-4">
                <div className="p-3 bg-white dark:bg-slate-950 border border-amber-100 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] font-bold text-brand-textMuted uppercase block leading-none">{l.monthlyAvg}</span>
                  <p className="text-sm font-black text-amber-850 dark:text-amber-500 mt-1.5">{formatINR(displayCert.monthly_avg || 32000)}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-950 border border-amber-100 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] font-bold text-brand-textMuted uppercase block leading-none">{l.savingsIndex}</span>
                  <p className="text-sm font-black text-amber-850 dark:text-amber-500 mt-1.5">{formatINR(displayCert.total_90_day || 12000)}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-950 border border-amber-100 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] font-bold text-brand-textMuted uppercase block leading-none">{l.consistencyScore}</span>
                  <p className="text-sm font-black text-amber-850 dark:text-amber-500 mt-1.5">{displayCert.consistency_score || 94}%</p>
                </div>
              </div>

              {/* Bottom footer section */}
              <div className="border-t border-amber-200/50 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
                <div className="flex gap-6 text-left">
                  <div>
                    <span className="text-[9px] font-bold text-brand-textMuted uppercase">{l.issuedDate}</span>
                    <p className="text-xs font-bold text-brand-textPrimary mt-0.5">
                      {new Date(displayCert.created_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-brand-textMuted uppercase">{l.validUntil}</span>
                    <p className="text-xs font-bold text-brand-textPrimary mt-0.5">
                      {new Date(displayCert.valid_until).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                    </p>
                  </div>
                </div>

                {/* QR Code and link */}
                <div className="flex items-center gap-3">
                  <div className="bg-white p-1 rounded border border-slate-150">
                    <QRCodeSVG 
                      value={`${window.location.origin}/verify/${displayCert.cert_ref}`} 
                      size={54} 
                    />
                  </div>
                  <div className="text-left">
                    <span className="text-[8px] font-mono text-brand-textMuted uppercase leading-none block">Verify URL</span>
                    <span className="text-[10px] font-bold text-brand-primary hover:underline font-mono">
                      /verify/{displayCert.cert_ref}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Print and PDF download triggers (Non-printable) */}
            <div className="flex gap-3 print:hidden justify-end">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-250 font-bold text-xs rounded-input active:scale-95 transition-all shadow flex items-center gap-1.5"
              >
                <Printer size={14} />
                {l.printBtn}
              </button>
              {displayCert.pdf_public_url && (
                <a
                  href={displayCert.pdf_public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input active:scale-95 transition-all shadow flex items-center gap-1.5"
                >
                  <Download size={14} />
                  {l.downloadPdf}
                </a>
              )}
            </div>
          </div>

          {/* Right Column: Recharts breakdown + blockchain proof (Non-printable) */}
          <div className="space-y-6 print:hidden">
            
            {/* Chart Breakdown */}
            <div className="premium-card p-6">
              <h3 className="text-md font-bold text-brand-dark mb-4 flex items-center gap-1.5">
                <TrendingUp size={16} className="text-brand-primary" />
                {lang === 'hi' ? 'आय रिकॉर्ड विश्लेषण' : 'Income Ledger Breakdown'}
              </h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getChartData(displayCert.monthly_avg)}>
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis fontSize={10} stroke="#94A3B8" tickLine={false} />
                    <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Income']} />
                    <Bar dataKey="Income" fill="#028090" radius={[4, 4, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Platforms Card */}
            {displayCert.gig_platforms && displayCert.gig_platforms.length > 0 && (
              <div className="premium-card p-6">
                <h3 className="text-md font-bold text-brand-dark mb-3">{l.platformsTitle}</h3>
                <div className="flex flex-wrap gap-2">
                  {displayCert.gig_platforms.map(p => (
                    <span 
                      key={p} 
                      className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-250 rounded-lg"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* On-chain Proof details */}
            <div className="premium-card p-6">
              <h3 className="text-md font-bold text-brand-dark mb-3 flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-brand-primary" />
                {lang === 'hi' ? 'ब्लॉकचेन रिकॉर्ड' : 'On-Chain Ledger'}
              </h3>
              <div className="space-y-3.5">
                <div>
                  <span className="text-[9px] font-bold text-brand-textMuted uppercase">Blockchain Hash</span>
                  <p className="text-xs font-mono font-bold text-brand-textPrimary break-all bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-150 mt-1">
                    {displayCert.blockchain_hash}
                  </p>
                </div>
                
                {displayCert.blockchain_tx_hash && (
                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-brand-textMuted">Transaction Proof</span>
                    <BlockchainBadge txHash={displayCert.blockchain_tx_hash} />
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Historical registry ledger (Non-printable) */}
      <div className="premium-card p-6 print:hidden">
        <h3 className="text-lg font-bold text-brand-dark mb-4">{l.registryTitle}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-850 text-brand-textMuted text-xs font-bold uppercase tracking-wider">
                <th className="pb-3">{l.certRefLabel}</th>
                <th className="pb-3">{l.issuedDate}</th>
                <th className="pb-3">{l.monthlyAvg}</th>
                <th className="pb-3">{l.validUntil}</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {certificates.map((c) => (
                <tr 
                  key={c.id} 
                  onClick={() => { if (c.status === 'ready') setCurrentCert(c); }}
                  className={`text-brand-textPrimary ${c.status === 'ready' ? 'cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30' : ''}`}
                >
                  <td className="py-4 font-bold font-mono text-brand-primary">{c.cert_ref}</td>
                  <td className="py-4 text-xs text-brand-textMuted">
                    {new Date(c.created_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                  </td>
                  <td className="py-4 font-bold">{formatINR(c.monthly_avg || 32000)}</td>
                  <td className="py-4 text-xs text-brand-textMuted">
                    {new Date(c.valid_until).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                  </td>
                  <td className="py-4 text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      c.status === 'ready' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : c.status === 'generating' 
                        ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' 
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {certificates.length === 0 && (
            <div className="py-8 text-center text-sm text-brand-textMuted">
              {l.noCerts}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
