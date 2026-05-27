import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatINR } from '../lib/utils';
import BlockchainBadge from '../components/shared/BlockchainBadge';
import LanguageToggle from '../components/shared/LanguageToggle';
import { useLanguageStore } from '../lib/languageStore';

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
    savingsIndex: lang === 'hi' ? 'बचत सुसंगतता' : '90-Day Savings',
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <div className="bento-card text-center p-12 max-w-sm">
          <span className="material-symbols-outlined text-primary text-[64px] animate-spin block mb-4">sync</span>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-2">
            {lang === 'hi' ? 'सत्यापन चल रहा है...' : 'Verifying Certificate...'}
          </h3>
          <p className="text-sm font-semibold text-on-surface-variant animate-pulse">
            Running smart contract ledger checks...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 flex flex-col items-center">
      
      {/* Top Header */}
      <div className="w-full max-w-4xl flex items-center justify-between border-b border-outline-variant pb-5 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary text-on-primary rounded-xl shadow-md">
            <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md text-primary font-black">SafeKosh Verify</h1>
            <p className="text-[10px] text-on-surface-variant font-bold tracking-widest uppercase">Decentralized Trust Network</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
        </div>
      </div>

      {/* Portal Description */}
      <div className="w-full max-w-4xl mb-8 text-center">
        <h2 className="font-headline-lg text-headline-lg text-on-background mb-2">{l.title}</h2>
        <p className="text-body-md text-on-surface-variant max-w-xl mx-auto">{l.subtitle}</p>
      </div>

      {/* Main Validation Result */}
      <div className="w-full max-w-2xl">
        {result?.valid ? (
          <div className="space-y-6">
            
            {/* Status Alert Banner */}
            <div className="flex items-center gap-3 p-4 bg-secondary-container/20 border border-secondary-container rounded-2xl shadow-sm">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-[20px]">check_circle</span>
              </div>
              <div>
                <h4 className="font-label-md text-label-md font-bold text-on-secondary-container">{l.validTitle}</h4>
                <p className="text-[10px] text-on-surface-variant font-medium">Polygon Amoy Registry Attestation matched successfully.</p>
              </div>
            </div>

            {/* The Certificate Card */}
            <div className="relative border-8 border-double border-amber-600 bg-amber-50/15 p-6 md:p-10 rounded-2xl bg-white shadow-lg flex flex-col justify-between min-h-[480px]">
              
              {/* Watermark */}
              <div className="absolute right-8 top-8 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-amber-700" style={{ fontSize: '150px' }}>workspace_premium</span>
              </div>

              {/* Top Header */}
              <div className="flex justify-between items-start border-b border-amber-200/50 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-amber-800 uppercase">
                    SafeKosh Trust Protocol
                  </h2>
                  <p className="text-[10px] text-on-surface-variant font-bold tracking-wider mt-0.5">PUBLIC ATTESTATION RECORD</p>
                </div>
                <div className="flex items-center gap-1 bg-secondary-container/30 border border-secondary-container text-on-secondary-container font-bold px-2.5 py-1 rounded-full text-[9px] uppercase shadow-sm">
                  <span className="material-symbols-outlined text-[12px]">verified</span>
                  {l.verifiedSeal}
                </div>
              </div>

              {/* Main content */}
              <div className="my-6 space-y-4 text-center">
                <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest font-mono">CERTIFICATE REFERENCE</p>
                <span className="inline-block px-4 py-1.5 font-mono text-sm font-black bg-primary/10 border border-primary/20 text-primary rounded-lg shadow-sm">
                  {result.certRef}
                </span>
                <h3 className="text-2xl font-black text-on-surface tracking-tight mt-4">
                  {result.issuedFor}
                </h3>
              </div>

              {/* Data Table Parameters */}
              <div className="grid grid-cols-3 gap-3 my-4">
                {[
                  { label: l.monthlyAvg, value: formatINR(result.monthlyAvg) },
                  { label: l.savingsIndex, value: formatINR(result.total90Day) },
                  { label: l.consistencyScore, value: `${result.consistencyScore}%` },
                ].map(stat => (
                  <div key={stat.label} className="p-3 bg-white border border-amber-100 rounded-xl text-center shadow-sm">
                    <span className="text-[9px] font-bold text-on-surface-variant uppercase block leading-none">{stat.label}</span>
                    <p className="text-sm font-black text-amber-800 mt-1.5">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Verified Platforms */}
              {result.gigPlatforms && result.gigPlatforms.length > 0 && (
                <div className="text-left mb-4 mt-2">
                  <span className="text-[9px] font-bold text-on-surface-variant uppercase block mb-1.5">{l.platforms}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.gigPlatforms.map(p => (
                      <span key={p} className="px-2.5 py-1 bg-surface-container-low border border-outline-variant text-[10px] font-bold text-on-surface rounded-lg">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Timeline */}
              <div className="border-t border-amber-200/50 pt-4 flex items-center justify-between mt-4">
                <div className="flex gap-6 text-left">
                  <div>
                    <span className="text-[9px] font-bold text-on-surface-variant uppercase">{l.issuedOn}</span>
                    <p className="text-xs font-bold text-on-surface mt-0.5">
                      {new Date(result.issuedAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-on-surface-variant uppercase">{l.validUntil}</span>
                    <p className="text-xs font-bold text-on-surface mt-0.5">
                      {new Date(result.validUntil).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US')}
                    </p>
                  </div>
                </div>
                
                {result.blockchainTxHash && (
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-on-surface-variant uppercase block mb-0.5">{l.contractVerified}</span>
                    <BlockchainBadge txHash={result.blockchainTxHash} />
                  </div>
                )}
              </div>
            </div>

            {/* Collaborative Transparency Note */}
            <div className="glass-effect rounded-2xl p-stack-lg border border-primary/10">
              <div className="flex items-start gap-stack-md">
                <div className="bg-primary/10 p-2 rounded-xl shrink-0">
                  <span className="material-symbols-outlined text-primary text-[20px]">info</span>
                </div>
                <div>
                  <h4 className="font-label-md text-primary mb-1">
                    {lang === 'hi' ? 'पारदर्शी सत्यापन' : 'Collaborative Transparency'}
                  </h4>
                  <p className="text-body-md text-on-surface-variant text-xs leading-relaxed">
                    {lang === 'hi'
                      ? 'यह सत्यापन Polygon ब्लॉकचेन पर ऑन-चेन स्मार्ट कॉन्ट्रैक्ट रिकॉर्ड से मेल खाता है। यदि आपको कोई विसंगति मिलती है, तो SafeKosh सहायता से संपर्क करें।'
                      : 'This verification matches on-chain smart contract records on the Polygon network. If you find any discrepancy, please contact SafeKosh Support.'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="bento-card border-error/20 bg-white text-center space-y-5 shadow-md max-w-xl mx-auto p-8">
            <div className="w-20 h-20 rounded-full bg-error-container/30 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-error text-[40px] animate-pulse">gpp_bad</span>
            </div>
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{l.invalidTitle}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {lang === 'hi'
                  ? 'अनुरोधित प्रमाणपत्र की प्रामाणिकता सत्यापित नहीं की जा सकी।'
                  : 'We could not verify the authenticity of the requested certificate. The token registry returned:'}
              </p>
            </div>
            <div className="p-3.5 bg-error-container/20 border border-error-container rounded-xl font-mono text-xs text-on-error-container text-left">
              <span className="font-bold">{l.verifyReason}: </span>
              {result?.reason || 'Access Refused or Certificate Revoked/Expired.'}
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-xl active:scale-95 transition-all shadow-md"
              >
                {l.backBtn}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="mt-12 text-center text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
        © 2026 SafeKosh Blockchain Attestation Registry. All rights reserved.
      </div>

    </div>
  );
}
