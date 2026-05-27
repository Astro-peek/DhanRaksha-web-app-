import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';
import { useAuth } from '../components/shared/AuthProvider';
import { useLanguageStore } from '../lib/languageStore';
import { formatINR, getErrorMessage } from '../lib/utils';
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
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';

export default function Certificate() {
  const { user } = useAuth();
  const { lang, t } = useLanguageStore();

  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Generating state
  const [generatingId, setGeneratingId] = useState(null);
  const [generationStatus, setGenerationStatus] = useState(null);
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
    savingsIndex: lang === 'hi' ? 'बचत सुसंगतता' : '90-Day Savings',
    consistencyScore: lang === 'hi' ? 'विश्वसनीयता स्कोर' : 'Consistency Score',
    platformsTitle: lang === 'hi' ? 'संबद्ध प्लेटफॉर्म' : 'Associated Platforms',
    issuedDate: lang === 'hi' ? 'जारी तिथि' : 'Issued Date',
    validUntil: lang === 'hi' ? 'वैधता तिथि' : 'Valid Until',
    downloadPdf: lang === 'hi' ? 'पीडीएफ रसीद डाउनलोड करें' : 'Download PDF',
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

  const startPolling = (id) => {
    stopPolling();
    let step = 1;
    setActiveStep(1);
    
    pollingInterval.current = setInterval(async () => {
      step = Math.min(step + 1, 3);
      setActiveStep(step);

      try {
        const res = await api.get(`/api/certificate/${id}`);
        if (res.data?.success) {
          const cert = res.data.certificate;
          
          if (cert && cert.status === 'ready') {
            stopPolling();
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
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
    }, 4000);
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/certificate/generate');
      if (res.data?.success) {
        if (res.data.status === 'ready') {
          confetti({ particleCount: 100 });
          setCurrentCert(res.data.certificate);
          setGenerationStatus('ready');
          fetchCertificates();
        } else {
          setGeneratingId(res.data.certId);
          setGenerationStatus('generating');
          startPolling(res.data.certId);
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to generate certificate.'));
    } finally {
      setLoading(false);
    }
  };

  const getChartData = (avgIncome) => {
    const val = avgIncome || 32000;
    return [
      { month: lang === 'hi' ? 'मार्च' : 'Mar', Income: Math.round(val * 0.95) },
      { month: lang === 'hi' ? 'अप्रैल' : 'Apr', Income: Math.round(val * 1.05) },
      { month: lang === 'hi' ? 'मई' : 'May', Income: Math.round(val) }
    ];
  };

  const handlePrint = () => window.print();

  const displayCert = currentCert || certificates.find(c => c.status === 'ready');

  const steps = [
    { num: 1, label: l.step1, icon: 'manage_search' },
    { num: 2, label: l.step2, icon: 'bar_chart' },
    { num: 3, label: l.step3, icon: 'link' },
    { num: 4, label: l.step4, icon: 'verified' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6 py-6">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-background tracking-tight">
            {l.title}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1 max-w-xl">
            {l.subtitle}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Daily limit info */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary-fixed/40 border border-tertiary-fixed-dim rounded-full text-xs font-semibold text-on-tertiary-fixed-variant">
            <span className="material-symbols-outlined text-[14px]">info</span>
            {l.warningLimit}
          </div>
          {!generatingId && (
            <button
              onClick={handleGenerate}
              className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl active:scale-95 transition-all shadow-md flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
              {l.generateBtn}
            </button>
          )}
        </div>
      </div>

      {/* Stepper progress during generation */}
      {generationStatus === 'generating' && (
        <div className="bento-card max-w-xl mx-auto print:hidden">
          <div className="text-center space-y-2 mb-6">
            <span className="material-symbols-outlined text-[48px] text-primary animate-spin block">sync</span>
            <h3 className="font-headline-md text-headline-md">{l.loadingCert}</h3>
            <p className="text-xs text-on-surface-variant">
              {lang === 'hi' ? 'इसमें लगभग ३० सेकंड का समय लग सकता है...' : 'This will take approximately 30 seconds. Checking ledger logs...'}
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((s) => (
              <div key={s.num} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                activeStep === s.num ? 'bg-primary/5 border border-primary/20' : ''
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                  activeStep > s.num 
                    ? 'bg-secondary text-white' 
                    : activeStep === s.num 
                    ? 'bg-primary text-white animate-pulse' 
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}>
                  {activeStep > s.num 
                    ? <span className="material-symbols-outlined text-[16px]">check</span>
                    : s.num
                  }
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span className={`material-symbols-outlined text-[18px] ${
                    activeStep > s.num ? 'text-secondary' : activeStep === s.num ? 'text-primary' : 'text-on-surface-variant'
                  }`}>{s.icon}</span>
                  <span className={`text-sm font-semibold ${
                    activeStep === s.num ? 'text-primary font-bold' : 'text-on-surface'
                  }`}>{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certificate view and detail grid */}
      {displayCert && generationStatus !== 'generating' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Certificate Card (Printable) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* The Certificate itself */}
            <div className="relative border-8 border-double border-amber-600 bg-amber-50/15 p-6 md:p-10 rounded-2xl bg-white shadow-lg flex flex-col justify-between min-h-[500px] print:shadow-none print:border-amber-800">
              
              {/* Watermark */}
              <div className="absolute right-8 top-8 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-amber-700 text-[150px]" style={{ fontSize: '150px' }}>workspace_premium</span>
              </div>

              {/* Top header */}
              <div className="flex justify-between items-start border-b border-amber-200/50 pb-4">
                <div>
                  <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-amber-800 uppercase">
                    SafeKosh Trust Protocol
                  </h2>
                  <p className="text-[10px] text-on-surface-variant font-bold tracking-wider mt-0.5">DECENTRALIZED CREDIT REGISTER</p>
                </div>
                <div className="flex items-center gap-1 bg-secondary-container/30 border border-secondary-container text-on-secondary-container font-bold px-2.5 py-1 rounded-full text-[9px] uppercase shadow-sm">
                  <span className="material-symbols-outlined text-[12px]">verified</span>
                  {l.verifiedSeal}
                </div>
              </div>

              {/* Main content */}
              <div className="my-6 space-y-4 text-center">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">THIS CREDENTIAL OFFICIALLY ATTESTS THAT</p>
                <h3 className="text-2xl font-black text-on-surface tracking-tight">
                  {user?.name || 'Verified SafeKosh Member'}
                </h3>
                <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                  has completed active rotating savings circles and held collateralized credit assets audited on-chain under unique certificate reference:
                </p>
                <span className="inline-block px-4 py-1.5 font-mono text-sm font-black bg-primary/10 border border-primary/20 text-primary rounded-lg shadow-sm">
                  {displayCert.cert_ref}
                </span>
              </div>

              {/* Key Parameters */}
              <div className="grid grid-cols-3 gap-3 md:gap-4 my-4">
                {[
                  { label: l.monthlyAvg, value: formatINR(displayCert.monthly_avg || 32000) },
                  { label: l.savingsIndex, value: formatINR(displayCert.total_90_day || 12000) },
                  { label: l.consistencyScore, value: `${displayCert.consistency_score || 94}%` },
                ].map(stat => (
                  <div key={stat.label} className="p-3 bg-white border border-amber-100 rounded-xl text-center shadow-sm">
                    <span className="text-[9px] font-bold text-on-surface-variant uppercase block leading-none">{stat.label}</span>
                    <p className="text-sm font-black text-amber-800 mt-1.5">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-amber-200/50 pt-5 flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
                <div className="flex gap-6 text-left">
                  <div>
                    <span className="text-[9px] font-bold text-on-surface-variant uppercase">{l.issuedDate}</span>
                    <p className="text-xs font-bold text-on-surface mt-0.5">
                      {new Date(displayCert.created_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-on-surface-variant uppercase">{l.validUntil}</span>
                    <p className="text-xs font-bold text-on-surface mt-0.5">
                      {new Date(displayCert.valid_until).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                    </p>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex items-center gap-3">
                  <div className="bg-white p-1 rounded border border-outline-variant">
                    <QRCodeSVG 
                      value={`${window.location.origin}/verify/${displayCert.cert_ref}`} 
                      size={54} 
                    />
                  </div>
                  <div className="text-left">
                    <span className="text-[8px] font-mono text-on-surface-variant uppercase leading-none block">Verify URL</span>
                    <span className="text-[10px] font-bold text-primary hover:underline font-mono">
                      /verify/{displayCert.cert_ref}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print and PDF triggers */}
            <div className="flex gap-3 print:hidden justify-end">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant text-on-surface font-bold text-xs rounded-xl active:scale-95 transition-all shadow flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                {l.printBtn}
              </button>
              {displayCert.pdf_public_url && (
                <a
                  href={displayCert.pdf_public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl active:scale-95 transition-all shadow flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  {l.downloadPdf}
                </a>
              )}
            </div>
          </div>

          {/* Right Column: Chart + Blockchain proof */}
          <div className="space-y-6 print:hidden">
            
            {/* Income Chart */}
            <div className="bento-card">
              <h3 className="font-headline-md text-headline-md mb-4 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
                {lang === 'hi' ? 'आय रिकॉर्ड विश्लेषण' : 'Income Ledger Breakdown'}
              </h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getChartData(displayCert.monthly_avg)}>
                    <XAxis dataKey="month" stroke="#737686" fontSize={11} tickLine={false} />
                    <YAxis fontSize={10} stroke="#737686" tickLine={false} />
                    <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Income']} />
                    <Bar dataKey="Income" fill="#006c49" radius={[6, 6, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Platforms Card */}
            {displayCert.gig_platforms && displayCert.gig_platforms.length > 0 && (
              <div className="bento-card">
                <h3 className="font-headline-md text-headline-md mb-3">{l.platformsTitle}</h3>
                <div className="flex flex-wrap gap-2">
                  {displayCert.gig_platforms.map(p => (
                    <span 
                      key={p} 
                      className="px-2.5 py-1 bg-surface-container-low border border-outline-variant text-xs font-semibold text-on-surface rounded-lg"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* On-chain Proof */}
            <div className="bento-card">
              <h3 className="font-headline-md text-headline-md mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[20px]">verified_user</span>
                {lang === 'hi' ? 'ब्लॉकचेन रिकॉर्ड' : 'On-Chain Ledger'}
              </h3>
              <div className="space-y-3.5">
                <div>
                  <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Blockchain Hash</span>
                  <p className="text-xs font-mono font-bold text-on-surface break-all bg-surface-container-low p-2 rounded-lg border border-outline-variant mt-1">
                    {displayCert.blockchain_hash}
                  </p>
                </div>
                
                {displayCert.blockchain_tx_hash && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pt-2.5 border-t border-outline-variant/30">
                    <span className="text-xs font-bold text-on-surface-variant">Transaction Proof</span>
                    <BlockchainBadge txHash={displayCert.blockchain_tx_hash} className="self-start sm:self-auto" />
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Historical registry ledger */}
      <div className="bento-card print:hidden">
        <div className="flex items-center justify-between mb-stack-lg">
          <h3 className="font-headline-md text-headline-md">{l.registryTitle}</h3>
          <span className="text-xs text-on-surface-variant font-semibold">{certificates.length} {lang === 'hi' ? 'कुल' : 'total'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 text-on-surface-variant text-xs font-bold uppercase tracking-wider">
                <th className="pb-3">{l.certRefLabel}</th>
                <th className="pb-3">{l.issuedDate}</th>
                <th className="pb-3">{l.monthlyAvg}</th>
                <th className="pb-3">{l.validUntil}</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {certificates.map((c) => (
                <tr 
                  key={c.id} 
                  onClick={() => { if (c.status === 'ready') setCurrentCert(c); }}
                  className={`text-on-surface transition-colors ${c.status === 'ready' ? 'cursor-pointer hover:bg-surface-container-low/50' : ''}`}
                >
                  <td className="py-4 font-bold font-mono text-primary text-xs">{c.cert_ref}</td>
                  <td className="py-4 text-xs text-on-surface-variant">
                    {new Date(c.created_at).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                  </td>
                  <td className="py-4 font-bold text-sm">{formatINR(c.monthly_avg || 32000)}</td>
                  <td className="py-4 text-xs text-on-surface-variant">
                    {new Date(c.valid_until).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                  </td>
                  <td className="py-4 text-right">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      c.status === 'ready' 
                        ? 'bg-secondary-container/20 text-on-secondary-container border-secondary-container' 
                        : c.status === 'generating' 
                        ? 'bg-tertiary-fixed/30 text-on-tertiary-fixed-variant border-tertiary-fixed-dim animate-pulse' 
                        : 'bg-error-container/20 text-on-error-container border-error-container'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {certificates.length === 0 && (
            <div className="py-10 text-center text-sm text-on-surface-variant font-semibold">
              <span className="material-symbols-outlined text-[48px] text-outline-variant block mb-3">description</span>
              {l.noCerts}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
