/**
 * Certificate Routes — /api/certificate
 *
 *  GET  /api/certificate/my-certificates     — List user's certificates
 *  POST /api/certificate/generate            — Kick off async certificate generation
 *  GET  /api/certificate/:certId             — Poll / fetch single certificate
 *  GET  /api/certificate/verify/:certRef     — Public verification endpoint (no auth)
 */

import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { enqueue, registerWorker } from '../lib/queue.js';
import { processCertificateJob } from '../jobs/generateCertificate.js';
import blockchain from '../lib/blockchain.js';

const router = express.Router();

// ── Register background worker once at module load ───────────────────────────
registerWorker('generate_certificate', processCertificateJob);

// ── Per-user daily rate limiter (3 generations / day) ───────────────────────
const generationAttempts = new Map(); // userId → { count, date }

function checkDailyLimit(userId) {
  const today = new Date().toISOString().split('T')[0];
  const entry = generationAttempts.get(userId);
  if (!entry || entry.date !== today) {
    generationAttempts.set(userId, { count: 1, date: today });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count += 1;
  return true;
}

// ── Helper: refresh signed URL if needed ────────────────────────────────────
async function refreshSignedUrl(cert) {
  if (!cert.pdf_storage_path) return cert;
  try {
    const { data } = await supabaseAdmin.storage
      .from('certificates')
      .createSignedUrl(cert.pdf_storage_path, 604800); // 7 days
    if (data?.signedUrl) {
      await supabaseAdmin
        .from('income_certificates')
        .update({ pdf_public_url: data.signedUrl })
        .eq('id', cert.id);
      return { ...cert, pdf_public_url: data.signedUrl };
    }
  } catch (_) { /* non-critical */ }
  return cert;
}

// ── Audit helper ─────────────────────────────────────────────────────────────
const logAudit = async (userId, action, data = {}) => {
  try {
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action,
      table_name: 'income_certificates',
      new_data: data
    });
  } catch (_) {}
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/certificate/my-certificates
// ────────────────────────────────────────────────────────────────────────────
router.get('/my-certificates', requireAuth, async (req, res, next) => {
  try {
    const { data: certificates, error } = await supabaseAdmin
      .from('income_certificates')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, certificates });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/certificate/generate
// ────────────────────────────────────────────────────────────────────────────
router.post('/generate', requireAuth, async (req, res, next) => {
  const userId = req.user.id;

  try {
    // 1. Daily rate limit (3 per day)
    if (!checkDailyLimit(userId)) {
      return res.status(429).json({
        error: 'Daily generation limit reached. You can generate up to 3 certificates per day.',
        code: 'DAILY_LIMIT_EXCEEDED'
      });
    }

    // 2. Check for a valid non-expired, non-revoked cert from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: existing } = await supabaseAdmin
      .from('income_certificates')
      .select('*')
      .eq('user_id', userId)
      .eq('revoked', false)
      .eq('status', 'ready')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const fresh = await refreshSignedUrl(existing);
      return res.json({
        success: true,
        certId: fresh.id,
        certRef: fresh.cert_ref,
        status: 'ready',
        certificate: fresh,
        message: 'Returning your most recent certificate (generated in the last 30 days).'
      });
    }

    // 3. Generate a unique cert reference  SK-XXXXXXXX
    const certRef = 'SK-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    // Valid for 90 days
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 90);

    // 4. Insert record with status 'generating'
    const { data: cert, error: insertErr } = await supabaseAdmin
      .from('income_certificates')
      .insert({
        user_id: userId,
        cert_ref: certRef,
        status: 'generating',
        valid_until: validUntil.toISOString().split('T')[0]
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 5. Dispatch background job
    await enqueue('generate_certificate', { userId, certId: cert.id });

    await logAudit(userId, 'certificate_generation_started', { cert_id: cert.id, cert_ref: certRef });

    // 6. Return immediately
    return res.status(202).json({
      success: true,
      certId: cert.id,
      certRef,
      status: 'generating',
      message: 'Certificate generation started. Check back in 30 seconds.'
    });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/certificate/verify/:certRef   — PUBLIC (no auth)
// Must be defined BEFORE /:certId to avoid routing collision
// ────────────────────────────────────────────────────────────────────────────
router.get('/verify/:certRef', async (req, res, next) => {
  const { certRef } = req.params;

  try {
    const { data: cert } = await supabaseAdmin
      .from('income_certificates')
      .select('*, user:users(id, name)')
      .eq('cert_ref', certRef)
      .maybeSingle();

    if (!cert) {
      return res.json({ valid: false, reason: 'Certificate not found', certRef });
    }

    if (cert.revoked) {
      return res.json({ valid: false, reason: 'Certificate has been revoked', certRef });
    }

    const today = new Date().toISOString().split('T')[0];
    if (cert.valid_until < today) {
      return res.json({ valid: false, reason: 'Certificate has expired', certRef, expired_on: cert.valid_until });
    }

    if (cert.status !== 'ready') {
      return res.json({ valid: false, reason: 'Certificate is not yet ready', status: cert.status });
    }

    // Blockchain hash verification (simulated smart contract view call)
    let blockchainVerified = false;
    if (cert.blockchain_hash && cert.id) {
      blockchainVerified = await blockchain.verifyCertificateHash(cert.id, cert.blockchain_hash);
    }

    return res.json({
      valid: true,
      certRef,
      issuedFor: cert.user?.name || 'Verified Member',
      monthlyAvg: cert.monthly_avg,
      total90Day: cert.total_90_day,
      consistencyScore: cert.consistency_score,
      gigPlatforms: cert.gig_platforms,
      issuedAt: cert.created_at,
      validUntil: cert.valid_until,
      blockchainHash: cert.blockchain_hash,
      blockchainTxHash: cert.blockchain_tx_hash,
      blockchainBlockNumber: cert.blockchain_block_number,
      blockchainVerified
    });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/certificate/:certId
// ────────────────────────────────────────────────────────────────────────────
router.get('/:certId', requireAuth, async (req, res, next) => {
  const { certId } = req.params;

  try {
    const { data: cert, error } = await supabaseAdmin
      .from('income_certificates')
      .select('*')
      .eq('id', certId)
      .single();

    if (error || !cert) {
      return res.status(404).json({ error: 'Certificate not found', code: 'NOT_FOUND' });
    }

    // Ownership check
    if (cert.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
    }

    // Still generating — frontend should poll every 5 s
    if (cert.status === 'generating') {
      return res.json({ success: true, status: 'generating', certId, certRef: cert.cert_ref });
    }

    // For 'ready' certs, refresh the signed URL so it never expires on the user
    if (cert.status === 'ready') {
      const fresh = await refreshSignedUrl(cert);
      return res.json({ success: true, certificate: fresh });
    }

    // 'failed' or other states
    return res.json({ success: true, certificate: cert });
  } catch (err) {
    next(err);
  }
});

export default router;
