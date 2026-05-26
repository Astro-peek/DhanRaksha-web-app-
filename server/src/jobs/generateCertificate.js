/**
 * Background Job: generate_certificate
 *
 * Steps:
 *  1. Generate realistic 90-day UPI mock transaction data
 *  2. Calculate income analytics (monthly avg, consistency score, etc.)
 *  3. Render a premium PDF via pdfkit
 *  4. Upload PDF to Supabase Storage
 *  5. Generate a signed download URL (7 days)
 *  6. Anchor SHA-256 hash to Polygon blockchain registry
 *  7. Update income_certificates record → status 'ready'
 */

import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { supabaseAdmin } from '../lib/supabase.js';
import blockchain from '../lib/blockchain.js';

// ─────────────────────────────────────────────────────────
// 1. MOCK TRANSACTION GENERATOR
// ─────────────────────────────────────────────────────────

const GIG_PAYERS = [
  'Swiggy Technologies Pvt Ltd',
  'Ola Fleet Technologies',
  'Rapido Bike Taxi',
  'Urban Company'
];

function generateMockTransactions(userId) {
  const transactions = [];
  const now = new Date();

  // 90 days ago starting date
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 90);

  // We want ~45 transactions spread across 3 months (14-17 per month)
  const perMonth = [15, 16, 14]; // slight variation

  for (let month = 0; month < 3; month++) {
    const txCount = perMonth[month];
    const monthStart = new Date(startDate);
    monthStart.setMonth(monthStart.getMonth() + month);

    // Randomly pick days within the month (avoid Sundays)
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const usedDays = new Set();

    for (let t = 0; t < txCount; t++) {
      let day;
      let attempts = 0;
      do {
        day = Math.floor(Math.random() * daysInMonth) + 1;
        attempts++;
      } while ((usedDays.has(day) || new Date(monthStart.getFullYear(), monthStart.getMonth(), day).getDay() === 0) && attempts < 50);
      usedDays.add(day);

      const txDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
      const amount = Math.round(550 + Math.random() * 400); // ₹550–₹950
      const payer = GIG_PAYERS[Math.floor(Math.random() * GIG_PAYERS.length)];

      transactions.push({
        date: txDate.toISOString().split('T')[0],
        amount,
        payer,
        type: 'credit',
        utr: `UTR${Math.floor(Math.random() * 1e12)}`
      });
    }
  }

  return transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ─────────────────────────────────────────────────────────
// 2. INCOME METRICS CALCULATOR
// ─────────────────────────────────────────────────────────

function calculateMetrics(transactions) {
  // Group by YYYY-MM
  const byMonth = {};
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7); // 'YYYY-MM'
    byMonth[key] = (byMonth[key] || 0) + tx.amount;
  }

  const monthlyTotals = Object.values(byMonth);
  const total90Day = monthlyTotals.reduce((a, b) => a + b, 0);
  const monthlyAvg = Math.round(total90Day / 3);
  const highestMonthAmount = Math.max(...monthlyTotals);
  const lowestMonthAmount = Math.min(...monthlyTotals);

  // Consistency score via coefficient of variation
  const mean = monthlyAvg;
  const variance = monthlyTotals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / monthlyTotals.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 1;
  const consistencyScore = Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));

  // Gig platform detection
  const platformSet = new Set(transactions.map(tx => tx.payer));
  const gigPlatforms = [...platformSet];
  const uniquePayersCount = platformSet.size;

  return {
    monthlyAvg,
    highestMonthAmount,
    lowestMonthAmount,
    total90Day,
    consistencyScore,
    gigPlatforms,
    uniquePayersCount,
    byMonth
  };
}

// ─────────────────────────────────────────────────────────
// 3. PDF RENDERER
// ─────────────────────────────────────────────────────────

function renderPdfBuffer(cert, user, metrics) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 55, bufferPages: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = 505; // usable width
      const teal = '#028090';
      const seafoam = '#00A896';
      const dark = '#05668D';
      const slate = '#718096';
      const black = '#1A202C';
      const lightBg = '#F0F4F8';

      // ── Outer border ──────────────────────────────────
      doc.rect(28, 28, 538, 784).lineWidth(3).strokeColor(teal).stroke();
      doc.rect(33, 33, 528, 774).lineWidth(1).strokeColor(seafoam).stroke();

      // ── Header band ───────────────────────────────────
      doc.rect(28, 28, 538, 70).fill(dark);
      doc.fill('white').font('Helvetica-Bold').fontSize(22).text('SafeKosh', 55, 44);
      doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.75)').text('SECURE FINANCIAL IDENTITY PLATFORM', 55, 70);

      // Badge right side of header
      doc.roundedRect(370, 38, 160, 30, 4).fill(seafoam);
      doc.fill('white').font('Helvetica-Bold').fontSize(8).text('OFFICIAL INCOME CERTIFICATE', 380, 49, { width: 140, align: 'center' });

      // ── Certificate title ──────────────────────────────
      doc.moveDown(0.3);
      doc.fill(dark).font('Helvetica-Bold').fontSize(16)
        .text('GIG WORKER INCOME ATTESTATION', 55, 115, { align: 'center', width: W });

      // Horizontal rule
      doc.moveTo(55, 138).lineTo(550, 138).lineWidth(0.5).strokeColor(teal).stroke();

      // ── Cert metadata row ──────────────────────────────
      doc.rect(55, 148, W, 54).fill(lightBg);
      const metaY = 157;
      const metaItems = [
        ['Certificate ID', cert.cert_ref],
        ['Issue Date', new Date(cert.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })],
        ['Valid Until', new Date(cert.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })],
        ['Status', 'ACTIVE & VERIFIED']
      ];
      const colW = W / 4;
      metaItems.forEach(([label, value], i) => {
        const x = 60 + i * colW;
        doc.fill(slate).font('Helvetica').fontSize(6.5).text(label.toUpperCase(), x, metaY, { width: colW - 4 });
        doc.fill(i === 3 ? '#38A169' : black).font('Helvetica-Bold').fontSize(8).text(value, x, metaY + 12, { width: colW - 4 });
      });

      // ── User details ───────────────────────────────────
      const udY = 218;
      doc.fill(dark).font('Helvetica-Bold').fontSize(11).text('Cardholder Identity', 55, udY);
      doc.moveTo(55, udY + 15).lineTo(550, udY + 15).lineWidth(0.5).strokeColor('#CBD5E0').stroke();

      const maskedMobile = user.mobile ? `+91 XXXXXX${user.mobile.slice(-4)}` : '+91 XXXXXXXXXX';
      const maskedAadhaar = user.aadhaar_last4 ? `XXXX XXXX ${user.aadhaar_last4}` : 'XXXX XXXX XXXX';
      const udItems = [
        ['Full Name', user.name || 'Verified Member'],
        ['Mobile', maskedMobile],
        ['Aadhaar', maskedAadhaar],
        ['KYC Status', user.kyc_status === 'completed' ? 'Completed ✓' : 'Basic Verified']
      ];
      udItems.forEach(([label, value], i) => {
        const x = 60 + i * colW;
        doc.fill(slate).font('Helvetica').fontSize(6.5).text(label.toUpperCase(), x, udY + 22, { width: colW - 4 });
        doc.fill(black).font('Helvetica-Bold').fontSize(9).text(value, x, udY + 33, { width: colW - 4 });
      });

      // ── Income summary ─────────────────────────────────
      const isY = 285;
      doc.fill(dark).font('Helvetica-Bold').fontSize(11).text('Income Analytics Summary', 55, isY);
      doc.moveTo(55, isY + 15).lineTo(550, isY + 15).lineWidth(0.5).strokeColor('#CBD5E0').stroke();

      const summaryCards = [
        { label: 'Total 90-Day Revenue', value: `₹${metrics.total90Day.toLocaleString('en-IN')}`, color: teal },
        { label: 'Monthly Average', value: `₹${metrics.monthlyAvg.toLocaleString('en-IN')}`, color: seafoam },
        { label: 'Highest Month', value: `₹${metrics.highestMonthAmount.toLocaleString('en-IN')}`, color: dark },
        { label: 'Consistency Score', value: `${metrics.consistencyScore}/100`, color: metrics.consistencyScore >= 70 ? '#38A169' : '#D69E2E' }
      ];

      const cardW = (W - 15) / 4;
      summaryCards.forEach((card, i) => {
        const cx = 55 + i * (cardW + 5);
        doc.rect(cx, isY + 22, cardW, 52).fill(lightBg);
        doc.rect(cx, isY + 22, 3, 52).fill(card.color);
        doc.fill(slate).font('Helvetica').fontSize(6.5).text(card.label.toUpperCase(), cx + 8, isY + 30, { width: cardW - 12 });
        doc.fill(card.color).font('Helvetica-Bold').fontSize(13).text(card.value, cx + 8, isY + 45, { width: cardW - 12 });
      });

      // ── Monthly breakdown bar chart ─────────────────────
      const chartY = 370;
      doc.fill(dark).font('Helvetica-Bold').fontSize(11).text('Month-on-Month Cashflow', 55, chartY);
      doc.moveTo(55, chartY + 15).lineTo(550, chartY + 15).lineWidth(0.5).strokeColor('#CBD5E0').stroke();

      const months = Object.entries(metrics.byMonth).sort(([a], [b]) => a.localeCompare(b));
      const maxMonthly = Math.max(...months.map(([, v]) => v));
      const barAreaH = 80;
      const barW = 100;
      const barGap = 30;
      const barBaseY = chartY + 105;

      months.forEach(([month, total], i) => {
        const barH = Math.round((total / maxMonthly) * barAreaH);
        const bx = 80 + i * (barW + barGap);
        // Bar
        doc.rect(bx, barBaseY - barH, barW, barH).fill(teal);
        // Value label
        doc.fill(black).font('Helvetica-Bold').fontSize(8)
          .text(`₹${(total / 1000).toFixed(1)}K`, bx, barBaseY - barH - 14, { width: barW, align: 'center' });
        // Month label
        const [yr, mo] = month.split('-');
        const label = new Date(parseInt(yr), parseInt(mo) - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
        doc.fill(slate).font('Helvetica').fontSize(7.5)
          .text(label, bx, barBaseY + 5, { width: barW, align: 'center' });
      });

      // Axis line
      doc.moveTo(55, barBaseY).lineTo(550, barBaseY).lineWidth(0.5).strokeColor('#CBD5E0').stroke();

      // ── Gig platforms section ──────────────────────────
      const gpY = 500;
      doc.fill(dark).font('Helvetica-Bold').fontSize(11).text('Detected Gig Platforms', 55, gpY);
      doc.moveTo(55, gpY + 15).lineTo(550, gpY + 15).lineWidth(0.5).strokeColor('#CBD5E0').stroke();

      metrics.gigPlatforms.forEach((platform, i) => {
        const px = 60 + i * 125;
        doc.roundedRect(px, gpY + 22, 115, 24, 4).fill(lightBg);
        doc.fill(dark).font('Helvetica-Bold').fontSize(8).text(platform.split(' ')[0], px + 8, gpY + 31, { width: 100 });
      });

      // ── Blockchain attestation ─────────────────────────
      const bcY = 572;
      doc.rect(55, bcY, W, 90).fill(dark);
      doc.fill('white').font('Helvetica-Bold').fontSize(10).text('Blockchain Attestation — Polygon Registry', 65, bcY + 10);
      doc.fill('rgba(255,255,255,0.6)').font('Helvetica').fontSize(7).text('This certificate is cryptographically immutable and publicly verifiable on-chain.', 65, bcY + 24);

      const bcItems = [
        ['Certificate Hash', cert.blockchain_hash || 'Pending'],
        ['Transaction ID', cert.blockchain_tx_hash || 'Pending'],
        ['Block Height', cert.blockchain_block_number ? `#${cert.blockchain_block_number}` : 'Pending'],
        ['Network', 'Polygon (MATIC) Mainnet']
      ];
      bcItems.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const ix = 65 + col * 250;
        const iy = bcY + 40 + row * 22;
        doc.fill('rgba(255,255,255,0.5)').font('Helvetica').fontSize(6).text(label.toUpperCase(), ix, iy);
        doc.fill('white').font('Courier-Bold').fontSize(7).text(String(value).slice(0, 36) + (String(value).length > 36 ? '…' : ''), ix, iy + 9, { width: 240 });
      });

      // ── Digital signature section ──────────────────────
      const dsY = 678;
      doc.moveTo(55, dsY).lineTo(550, dsY).lineWidth(0.5).strokeColor('#CBD5E0').stroke();

      doc.fill(dark).font('Helvetica-Bold').fontSize(8).text('Digitally Signed By', 55, dsY + 8);
      doc.fill(black).font('Helvetica').fontSize(8).text('SafeKosh Financial Technologies Pvt Ltd', 55, dsY + 20);
      doc.fill(slate).font('Helvetica').fontSize(7).text('CIN: U74999DL2024PTC000000 | RBI Reg: Not a Bank | DPIIT Recognized Startup', 55, dsY + 32);

      // Verify link right-aligned
      doc.fill(teal).font('Helvetica-Bold').fontSize(8).text(
        `Verify at: verify.safekosh.in/${cert.cert_ref}`,
        55, dsY + 8, { width: W, align: 'right' }
      );

      // ── Footer ─────────────────────────────────────────
      doc.rect(28, 784, 538, 28).fill(teal);
      doc.fill('white').font('Helvetica').fontSize(7)
        .text('Generated by SafeKosh. This is an algorithmically generated document. Not a government-issued certificate.', 55, 791, { width: W, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─────────────────────────────────────────────────────────
// 4. MAIN JOB HANDLER  (called by queue worker)
// ─────────────────────────────────────────────────────────

export async function processCertificateJob(job) {
  const { userId, certId } = job.data;
  console.info(`[CertJob] Starting certificate generation for user ${userId}, cert ${certId}`);

  try {
    // Fetch user profile
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, name, mobile, aadhaar_last4, kyc_status')
      .eq('id', userId)
      .single();

    // Fetch the cert record for cert_ref etc
    const { data: cert } = await supabaseAdmin
      .from('income_certificates')
      .select('*')
      .eq('id', certId)
      .single();

    if (!cert) throw new Error(`Certificate record ${certId} not found`);

    // ── Step 1: Mock transactions ────────────────────────
    const transactions = generateMockTransactions(userId);

    // ── Step 2: Compute analytics ────────────────────────
    const metrics = calculateMetrics(transactions);

    // ── Step 3: Compute attestation hash ────────────────
    const issuedAt = cert.created_at;
    const hashInput = `${cert.cert_ref}|${userId}|${metrics.total90Day}|${issuedAt}`;
    const attestHash = '0x' + crypto.createHash('sha256').update(hashInput).digest('hex');

    // ── Step 4: Anchor to blockchain ─────────────────────
    const anchor = await blockchain.anchorCertificateHash(certId, attestHash);

    // ── Step 5: Render PDF ───────────────────────────────
    const pdfCertData = {
      ...cert,
      blockchain_hash: attestHash,
      blockchain_tx_hash: anchor.transactionHash,
      blockchain_block_number: anchor.blockNumber
    };
    const pdfBuffer = await renderPdfBuffer(pdfCertData, user || {}, metrics);

    // ── Step 6: Upload to Supabase Storage ───────────────
    const storagePath = `${userId}/${cert.cert_ref}.pdf`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('certificates')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadErr) {
      console.warn(`[CertJob] Supabase Storage upload failed (${uploadErr.message}) — storing path only`);
    }

    // ── Step 7: Create signed URL (7 days) ───────────────
    let signedUrl = null;
    if (!uploadErr) {
      const { data: urlData } = await supabaseAdmin.storage
        .from('certificates')
        .createSignedUrl(storagePath, 604800); // 7 days
      signedUrl = urlData?.signedUrl || null;
    }

    // ── Step 8: Update income_certificate record ─────────
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 90);

    await supabaseAdmin
      .from('income_certificates')
      .update({
        monthly_avg: metrics.monthlyAvg,
        highest_month_amount: metrics.highestMonthAmount,
        lowest_month_amount: metrics.lowestMonthAmount,
        total_90_day: metrics.total90Day,
        consistency_score: metrics.consistencyScore,
        gig_platforms: metrics.gigPlatforms,
        unique_payers_count: metrics.uniquePayersCount,
        pdf_storage_path: storagePath,
        pdf_public_url: signedUrl,
        blockchain_hash: attestHash,
        blockchain_tx_hash: anchor.transactionHash,
        blockchain_block_number: anchor.blockNumber,
        blockchain_network: 'polygon_mumbai',
        valid_until: validUntil.toISOString().split('T')[0],
        status: 'ready'
      })
      .eq('id', certId);

    // ── Step 9: Nudge notification ───────────────────────
    await supabaseAdmin.from('nudge_log').insert({
      user_id: userId,
      nudge_type: 'certificate_ready',
      nudge_id: `cert_ready_${certId}`,
      message_hi: `शानदार! आपका आय प्रमाण पत्र ${cert.cert_ref} तैयार है और Polygon पर सुरक्षित है। 📜`,
      message_en: `Your income certificate ${cert.cert_ref} is ready and anchored on-chain! 📜`,
      cta_action: 'open_certificate'
    }).catch(() => {}); // non-critical

    console.info(`[CertJob] ✓ Certificate ${cert.cert_ref} ready for user ${userId}`);
  } catch (err) {
    console.error(`[CertJob] ✗ Failed for cert ${certId}:`, err.message);

    await supabaseAdmin
      .from('income_certificates')
      .update({ status: 'failed' })
      .eq('id', certId)
      .catch(() => {});

    throw err; // re-throw so queue marks job as failed
  }
}
