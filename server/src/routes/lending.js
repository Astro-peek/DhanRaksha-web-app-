/**
 * Lending Routes — /api/lending
 *
 *  GET  /api/lending/lenders              — List filtered lenders with live EMI
 *  POST /api/lending/track-click          — Record referral click / application intent
 *  POST /api/webhooks/lender-disbursement — NBFC disbursement callback (no auth)
 */

import express from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

// ── Fetch lenders from database ─────────────────────────────────────────────
const fetchLenders = async () => {
  try {
    const { data: lenders, error } = await supabaseAdmin
      .from('lenders')
      .select('*')
      .eq('approved', true);
    
    if (error) throw error;
    return lenders || [];
  } catch (err) {
    console.error('Error fetching lenders from database:', err);
    return [];
  }
};

// Cache lenders in memory for performance (refresh every 5 minutes)
let cachedLenders = [];
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getLenders = async () => {
  const now = Date.now();
  if (!cachedLenders.length || now - lastFetch > CACHE_DURATION) {
    cachedLenders = await fetchLenders();
    lastFetch = now;
  }
  return cachedLenders;
};

const getLenderMap = async () => {
  const lenders = await getLenders();
  return Object.fromEntries(lenders.map(l => [l.id, l]));
};

// ── Schemas ─────────────────────────────────────────────────────────────────
const trackClickSchema = z.object({
  lender_id: z.string().min(1, 'lender_id is required'),
  loan_amount: z.number().min(1000, 'Minimum loan amount is ₹1,000'),
  loan_purpose: z.string().min(2, 'Purpose is required')
});

const disbursementWebhookSchema = z.object({
  application_id: z.string().uuid(),
  disbursed: z.literal(true),
  disbursed_amount: z.number().positive(),
  lender_id: z.string().min(1)
});

// ── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Standard loan EMI amortisation:
 *   EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 */
function calcEmi(principal, annualRatePct, tenureMonths) {
  if (annualRatePct === 0) return Math.round(principal / tenureMonths);
  const r = annualRatePct / 12 / 100;
  const n = tenureMonths;
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi);
}

const logAudit = async (userId, action, data = {}, req) => {
  try {
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action,
      table_name: 'lender_applications',
      new_data: { ...data, path: req.originalUrl },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null
    });
  } catch (err) {
    console.error(`[Audit] ${action} failed:`, err.message);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/lending/lenders
// ────────────────────────────────────────────────────────────────────────────
router.get('/lenders', requireAuth, async (req, res, next) => {
  try {
    const amount = parseFloat(req.query.amount) || null;
    const purpose = req.query.purpose || null;
    const acceptsGigCert = req.query.accepts_gig_cert === 'true';

    const lenders = await getLenders();
    let filtered = lenders.filter(l => l.approved);

    // Filter by loan amount range
    if (amount !== null && !isNaN(amount)) {
      filtered = filtered.filter(l => amount >= l.min_loan && amount <= l.max_loan);
    }

    // Filter by gig cert support
    if (acceptsGigCert) {
      filtered = filtered.filter(l => l.accepts_gig_cert === true);
    }

    // Sort by annual interest rate ascending (lowest first)
    filtered.sort((a, b) => a.interest_rate_annual - b.interest_rate_annual);

    // Enrich each lender with live EMI for the requested amount
    const principalForEmi = amount && !isNaN(amount) ? amount : 50000; // default preview
    const enriched = filtered.map(lender => ({
      ...lender,
      emi_monthly: calcEmi(principalForEmi, lender.interest_rate_annual, lender.max_tenure_months),
      processing_fee_amount: lender.processing_fee_pct > 0
        ? Math.round(principalForEmi * lender.processing_fee_pct / 100)
        : lender.processing_fee_flat
    }));

    return res.json({
      success: true,
      count: enriched.length,
      amount_requested: amount,
      lenders: enriched
    });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/lending/track-click
// ────────────────────────────────────────────────────────────────────────────
router.post('/track-click', requireAuth, validate(trackClickSchema), async (req, res, next) => {
  const { lender_id, loan_amount, loan_purpose } = req.body;

  try {
    const lenderMap = await getLenderMap();
    const lender = lenderMap[lender_id];
    if (!lender) {
      return res.status(404).json({ error: 'Lender not found', code: 'LENDER_NOT_FOUND' });
    }

    const { data: application, error } = await supabaseAdmin
      .from('lender_applications')
      .insert({
        user_id: req.user.id,
        lender_id,
        lender_name: lender.name,
        loan_amount,
        loan_purpose,
        utm_source: 'safekosh',
        commission_pct: lender.commission_pct,
        disbursed: false
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit(req.user.id, 'lending_click_tracked', {
      application_id: application.id,
      lender_id,
      loan_amount
    }, req);

    return res.json({ success: true, applicationId: application.id });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/lending/applications
// ────────────────────────────────────────────────────────────────────────────
router.get('/applications', requireAuth, async (req, res, next) => {
  try {
    const { data: applications, error } = await supabaseAdmin
      .from('lender_applications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('clicked_at', { ascending: false });

    if (error) throw error;

    // Attach live lender metadata
    const lenderMap = await getLenderMap();
    const enriched = applications.map(app => ({
      ...app,
      lender: lenderMap[app.lender_id] || null
    }));

    return res.json({ success: true, applications: enriched });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/lender-disbursement
// No auth — verified via X-SafeKosh-Webhook-Secret header
// ────────────────────────────────────────────────────────────────────────────
router.post('/webhook-disburse', async (req, res, next) => {
  try {
    // Verify shared secret
    const secret = req.headers['x-safekosh-webhook-secret'];
    const expected = process.env.SAFEKOSH_WEBHOOK_SECRET;

    if (!expected || secret !== expected) {
      return res.status(401).json({ error: 'Invalid webhook secret', code: 'UNAUTHORIZED' });
    }

    // Validate body
    const parsed = disbursementWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const { application_id, disbursed_amount, lender_id } = parsed.data;

    // Fetch existing application
    const { data: app, error: fetchErr } = await supabaseAdmin
      .from('lender_applications')
      .select('*')
      .eq('id', application_id)
      .single();

    if (fetchErr || !app) {
      return res.status(404).json({ received: false, error: 'Application not found' });
    }

    if (app.disbursed) {
      return res.json({ received: true, action: 'already_processed' });
    }

    // Calculate commission
    const lenderMap = await getLenderMap();
    const lender = lenderMap[lender_id] || { commission_pct: app.commission_pct || 0 };
    const commissionAmount = Math.round(disbursed_amount * (lender.commission_pct / 100) * 100) / 100;

    // Update application
    await supabaseAdmin
      .from('lender_applications')
      .update({
        disbursed: true,
        disbursed_at: new Date().toISOString(),
        disbursed_amount,
        commission_amount: commissionAmount,
        webhook_received_at: new Date().toISOString()
      })
      .eq('id', application_id);

    // Audit log
    await supabaseAdmin.from('audit_log').insert({
      user_id: app.user_id,
      action: 'lending_disbursement_webhook',
      table_name: 'lender_applications',
      record_id: application_id,
      new_data: { disbursed_amount, commission_amount: commissionAmount, lender_id }
    }).catch(() => {});

    // Nudge notification
    await supabaseAdmin.from('nudge_log').insert({
      user_id: app.user_id,
      nudge_type: 'loan_disbursed',
      nudge_id: `loan_${application_id}`,
      message_hi: `बधाई हो! ₹${disbursed_amount.toLocaleString('en-IN')} का ऋण ${app.lender_name} द्वारा आपके खाते में जमा हो गया है। 🎉`,
      message_en: `₹${disbursed_amount.toLocaleString('en-IN')} from ${app.lender_name} has been credited to your account. 🎉`,
      cta_action: 'open_lending'
    }).catch(() => {});

    return res.json({ received: true, action: 'disbursement_processed', commission_amount: commissionAmount });
  } catch (err) {
    console.error('[LenderWebhook]', err);
    return res.json({ received: true, action: 'internal_error' }); // always 200 for webhooks
  }
});

export default router;
