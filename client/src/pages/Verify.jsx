import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatINR } from '../lib/utils';
import BlockchainBadge from '../components/shared/BlockchainBadge';
import LanguageToggle from '../components/shared/LanguageToggle';
import { useLanguageStore } from '../lib/languageStore';
import { 
  Award, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle,
  FileCheck2,
  Calendar,
  Layers,
  Link
} from 'lucide-react';

export default function Verify() {
  const { certRef } = useParams();
  const navigate = useNavigate();
  const { lang } = useLanguageStore();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  // Localized strings
  const l = {
    title: lang === 'hi' ? 'सार्वजनिक सत्यापन पोर्टल' : 'Public Verification Portal',
    subtitle: lang === 'hi' ? 'पॉलीगॉन ब्लॉकचेन पर दर्ज साख और आय प्रमाणपत्रों की तत्काल जांच करें।' : 'Instantly verify the authenticity of gig income credentials anchored on the Polygon blockchain.',
    validTitle: lang === 'hi' ? 'सर्टिफिकेट मान्य और सत्यापित है' : 'Certificate Valid & Verified',
    invalidTitle: lang === 'hi' ? 'अमान्य सर्टिफिकेट' : 'Invalid Certificate',
    verifiedSeal: lang === 'hi' ? 'सत्यापित' : 'SafeKosh Verified',
    monthlyAvg: lang === 'hi' ? 'मासिक औसत आय' : 'Avg Monthly Income',
    savingsIndex: lang === 'hi' ? 'बचत सुसंगतता' : '90-Day Savings Index',
    consistencyScore: lang === 'hi' ? 'विश्वसनीयता स्कोर' : 'Consistency Score',
    issuedTo: lang === 'hi' ? 'जारी किया गया' : 'Issued To',
    issuedOn: lang === 'hi' ? 'जारी करने की तिथि' : 'Issued On',
    validUntil: lang === 'hi' ? 'वैधता तिथि' : 'Valid Until',
    blockchainVerified: lang === 'hi' ? 'ब्लॉकचेन रिकॉर्ड सत्यापित किया गया' : 'Blockchain Record Verified',
    backBtn: lang === 'hi' ? 'पोर्टल पर जाएं' : 'Go to Portal',
    platforms: lang === 'hi' ? 'प्लेटफ़ॉर्म विवरण' : 'Verified Platforms',
    verifyReason: lang === 'hi' ? 'कारण' : 'Reason',
    contractVerified: lang === 'hi' ? 'स्मार्ट कॉन्ट्रैक्ट चेक' : 'Smart Contract Check'
  };

  useEffect(() => {
    const runVerification = async () => {
      setLoading(true);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const res = await axios.get(`${baseUrl}/api/certificate/verify/${certRef}`);
        setResult(res.data);
      } catch (err) {
        console.error('Verification query failed:', err);
        setResult({ valid: false, reason: 'Failed to communicate with verification registry.' });
      } finally {
        setLoading(false);
      }
    };
    if (certRef) {
      runVerification();
    }
  }, [certRef]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500 animate-pulse">Running smart contract ledger checks...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 flex flex-col justify-between items-center">
      
      {/* Top Header */}
      <div className="w-full max-w-4xl flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5 mb-8">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-primary text-white rounded-xl">
            <Award size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-brand-dark">SafeKosh Verify</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Decentralized Trust Network</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
        </div>
      </div>

      {/* Main Validation Result card */}
      <div className="w-full max-w-2xl">
        {result?.valid ? (
          <div className="space-y-6">
            
            {/* Status Alert Banner */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 text-emerald-800 dark:text-emerald-450 rounded-xl flex items-center gap-3 shadow-sm">
              <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-450 shrink-0" />
              <div>
                <h4 className="text-sm font-bold">{l.validTitle}</h4>
                <p className="text-[10px] text-emerald-600/90 font-medium">Polygon Amoy Registry Attestation matched successfully.</p>
              </div>
            </div>

            {/* The Certificate card */}
            <div className="relative border-8 border-double border-amber-600 bg-amber-50/15 p-6 md:p-10 rounded-card bg-white dark:bg-slate-900 shadow-premium flex flex-col justify-between min-h-[480px]">
              
              <div className="absolute right-8 top-8 opacity-10 pointer-events-none">
                <Award size={150} className="text-amber-700" />
              </div>

              <div className="flex justify-between items-start border-b border-amber-200/50 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-amber-800 dark:text-amber-500 uppercase">
                    SafeKosh Trust Protocol
                  </h2>
                  <p className="text-[10px] text-brand-textMuted font-bold tracking-wider mt-0.5">PUBLIC ATTESTATION RECORD</p>
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold px-2 py-0.5 rounded text-[9px] uppercase shadow-sm">
                  <CheckCircle size={10} />
                  {l.verifiedSeal}
                </div>
              </div>

              <div className="my-6 space-y-5 text-center">
                <p className="text-[10px] uppercase font-bold text-brand-textMuted tracking-widest font-mono">CERTIFICATE REFERENCE</p>
                <span className="inline-block px-4 py-1.5 font-mono text-sm font-black bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded shadow-sm">
                  {result.certRef}
                </span>
                <h3 className="text-2xl font-black text-brand-textPrimary tracking-tight mt-4">
                  {result.issuedFor}
                </h3>
              </div>

              {/* Data Table Parameters */}
              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="p-3 bg-white dark:bg-slate-950 border border-amber-100 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] font-bold text-brand-textMuted uppercase block leading-none">{l.monthlyAvg}</span>
                  <p className="text-sm font-black text-amber-850 dark:text-amber-500 mt-1.5">{formatINR(result.monthlyAvg)}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-950 border border-amber-100 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] font-bold text-brand-textMuted uppercase block leading-none">{l.savingsIndex}</span>
                  <p className="text-sm font-black text-amber-850 dark:text-amber-500 mt-1.5">{formatINR(result.total90Day)}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-950 border border-amber-100 rounded-xl text-center shadow-sm">
                  <span className="text-[9px] font-bold text-brand-textMuted uppercase block leading-none">{l.consistencyScore}</span>
                  <p className="text-sm font-black text-amber-850 dark:text-amber-500 mt-1.5">{result.consistencyScore}%</p>
                </div>
              </div>

              {/* Verified Platforms */}
              {result.gigPlatforms && result.gigPlatforms.length > 0 && (
                <div className="text-left mb-4 mt-2">
                  <span className="text-[9px] font-bold text-brand-textMuted uppercase block mb-1.5">{l.platforms}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.gigPlatforms.map(p => (
                      <span key={p} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-250 rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline Issuer Footer */}
              <div className="border-t border-amber-200/50 pt-4 flex items-center justify-between mt-4">
                <div className="flex gap-6 text-left">
                  <div>
                    <span className="text-[9px] font-bold text-brand-textMuted uppercase">{l.issuedOn}</span>
                    <p className="text-xs font-bold text-brand-textPrimary mt-0.5">
                      {new Date(result.issuedAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-brand-textMuted uppercase">{l.validUntil}</span>
                    <p className="text-xs font-bold text-brand-textPrimary mt-0.5">
                      {new Date(result.validUntil).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                    </p>
                  </div>
                </div>
                
                {result.blockchainTxHash && (
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-brand-textMuted uppercase block mb-0.5">{l.contractVerified}</span>
                    <BlockchainBadge txHash={result.blockchainTxHash} />
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          <div className="premium-card p-8 border-rose-200 bg-white dark:bg-slate-900 text-center space-y-4 shadow-md max-w-xl mx-auto">
            <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto animate-pulse" />
            <h3 className="text-lg font-black text-brand-dark">{l.invalidTitle}</h3>
            <p className="text-xs text-brand-textMuted leading-relaxed">
              We could not verify the authenticity of the requested certificate. The token registry returned:
            </p>
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/50 rounded-xl font-mono text-xs text-rose-700 dark:text-rose-400">
              {l.verifyReason}: {result?.reason || 'Access Refused or Certificate Revoked/Expired.'}
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-input active:scale-95 transition-all shadow-md"
              >
                {l.backBtn}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="mt-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
        © 2026 SafeKosh Blockchain Attestation Registry. All rights reserved.
      </div>

    </div>
  );
}
