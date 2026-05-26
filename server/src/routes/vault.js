import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { razorpay } from '../lib/razorpay.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { vaultLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ==========================================
// SCHEMAS
// ==========================================

const mandateSchema = z.object({
  upi_id: z.string().regex(/^[\w.\-]+@[\w.\-]+$/, 'Invalid UPI ID format')
});

const saveSchema = z.object({
  amount: z.number()
    .min(10, 'Minimum save amount is ₹10')
    .max(200, 'Maximum save amount is ₹200')
});

const withdrawSchema = z.object({
  amount: z.number()
    .min(100, 'Minimum withdrawal is ₹100'),
  destination_upi: z.string()
    .regex(/^[\w.\-]+@[\w.\-]+$/, 'Invalid destination UPI ID')
});

const settingsSchema = z.object({
  save_per_transaction: z.number().min(10).max(200).optional(),
  daily_limit: z.number().min(100).max(2000).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one setting must be provided'
});

// ==========================================
// HELPERS
// ==========================================

const logAudit = async (userId, action, data = {}, req) => {
  try {
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action,
      table_name: 'vault_accounts',
      new_data: { ...data, path: req.originalUrl },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null
    });
  } catch (err) {
    console.error(`[Audit] ${action} failed:`, err.message);
  }
};

const getOrCreateVault = async (userId) => {
  let { data: vault, error } = await supabaseAdmin
    .from('vault_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!vault) {
    const { data: newVault, error: createErr } = await supabaseAdmin
      .from('vault_accounts')
      .insert({ user_id: userId })
      .select()
      .single();
    if (createErr) throw createErr;
    vault = newVault;
  }

  // Auto-reset daily counter when date rolls over
  const today = new Date().toISOString().split('T')[0];
  if (vault.last_reset_date !== today) {
    const { data: resetVault } = await supabaseAdmin
      .from('vault_accounts')
      .update({ daily_saved_today: 0, last_reset_date: today })
      .eq('user_id', userId)
      .select()
      .single();
    vault = resetVault || vault;
  }

  return vault;
};

// ==========================================
// GET /api/vault/account
// ==========================================

router.get('/account', requireAuth, vaultLimiter, async (req, res, next) => {
  try {
    const vault = await getOrCreateVault(req.user.id);
    return res.json({
      success: true,
      account: {
        balance: vault.balance,
        save_per_transaction: vault.save_per_transaction,
        daily_limit: vault.daily_limit,
        daily_saved_today: vault.daily_saved_today,
        mandate_status: vault.mandate_status,
        last_reset_date: vault.last_reset_date
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// GET /api/vault/transactions
// ==========================================

router.get('/transactions', requireAuth, vaultLimiter, async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const direction = req.query.direction;

  try {
    let query = supabaseAdmin
      .from('vault_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (direction && ['credit', 'debit'].includes(direction)) {
      query = query.eq('direction', direction);
    }

    const { data: transactions, error, count } = await query;
    if (error) throw error;

    return res.json({
      success: true,
      transactions,
      total: count,
      page,
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /api/vault/setup-mandate
// ==========================================

router.post('/setup-mandate', requireAuth, vaultLimiter, validate(mandateSchema), async (req, res, next) => {
  const { upi_id } = req.body;

  try {
    const vault = await getOrCreateVault(req.user.id);

    if (vault.mandate_status === 'active') {
      return res.status(400).json({
        error: 'An active mandate already exists for this vault.',
        code: 'MANDATE_ALREADY_ACTIVE'
      });
    }

    // Create Razorpay UPI AutoPay subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_VAULT_PLAN_ID || 'plan_vault_default',
      customer_notify: 1,
      quantity: 1,
      total_count: 120,   // 10 years
      addons: [],
      notes: {
        user_id: req.user.id,
        upi_id,
        purpose: 'vault_autosave'
      }
    });

    // Persist mandate reference with pending status
    await supabaseAdmin
      .from('vault_accounts')
      .update({
        razorpay_mandate_id: subscription.id,
        mandate_status: 'pending'
      })
      .eq('user_id', req.user.id);

    // Update UPI ID on user profile
    await supabaseAdmin
      .from('users')
      .update({ upi_id })
      .eq('id', req.user.id);

    await logAudit(req.user.id, 'mandate_setup_initiated', { mandate_id: subscription.id }, req);

    return res.json({
      success: true,
      mandateId: subscription.id,
      shortUrl: subscription.short_url
    });
  } catch (err) {
    if (err.error?.description) {
      return res.status(400).json({
        error: err.error.description,
        code: 'RAZORPAY_ERROR'
      });
    }
    next(err);
  }
});

// ==========================================
// POST /api/vault/save   (manual save)
// ==========================================

router.post('/save', requireAuth, vaultLimiter, validate(saveSchema), async (req, res, next) => {
  const { amount } = req.body;

  try {
    const vault = await getOrCreateVault(req.user.id);

    const dailySoFar = Number(vault.daily_saved_today);
    const dailyLimit = Number(vault.daily_limit);

    if (dailySoFar + amount > dailyLimit) {
      const remaining = Math.max(0, dailyLimit - dailySoFar);
      return res.status(400).json({
        error: `Daily limit reached. You can save ₹${remaining.toFixed(2)} more today.`,
        code: 'DAILY_LIMIT_EXCEEDED',
        remaining
      });
    }

    const newBalance = Number(vault.balance) + amount;
    const newDailySaved = dailySoFar + amount;

    // Update vault balance
    await supabaseAdmin
      .from('vault_accounts')
      .update({ balance: newBalance, daily_saved_today: newDailySaved })
      .eq('user_id', req.user.id);

    // Create transaction record
    const { data: transaction } = await supabaseAdmin
      .from('vault_transactions')
      .insert({
        user_id: req.user.id,
        amount,
        direction: 'credit',
        trigger_type: 'manual',
        status: 'success',
        note: 'Manual vault save'
      })
      .select()
      .single();

    await logAudit(req.user.id, 'vault_save_manual', { amount, new_balance: newBalance }, req);

    return res.json({ success: true, transaction, newBalance });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /api/vault/auto-save   (Razorpay webhook — no auth)
// ==========================================

router.post('/auto-save', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    // 1. Verify Razorpay webhook signature
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret) {
      return res.status(400).json({ error: 'Missing webhook signature or secret' });
    }

    const rawBody = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== signature) {
      return res.status(401).json({ error: 'Invalid webhook signature', code: 'SIGNATURE_INVALID' });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    // We only handle payment captured events for auto-save
    if (event !== 'payment.captured') {
      return res.json({ received: true, action: 'skipped' });
    }

    const payment = payload.payload?.payment?.entity;
    const notes = payment?.notes || {};
    const userId = notes.user_id;

    if (!userId) {
      console.warn('[AutoSave] Webhook missing user_id in notes. Skipping.');
      return res.json({ received: true, action: 'skipped_no_user' });
    }

    // 2. Fetch vault account
    const vault = await getOrCreateVault(userId);

    const dailySoFar = Number(vault.daily_saved_today);
    const dailyLimit = Number(vault.daily_limit);
    const savePerTx = Number(vault.save_per_transaction);

    // 3. Calculate how much to save respecting daily limit
    const saveAmount = Math.min(savePerTx, Math.max(0, dailyLimit - dailySoFar));

    if (saveAmount <= 0) {
      console.info(`[AutoSave] Daily limit reached for user ${userId}. Skipping.`);
      return res.json({ received: true, action: 'daily_limit_reached' });
    }

    const newBalance = Number(vault.balance) + saveAmount;
    const newDailySaved = dailySoFar + saveAmount;

    // 4. Update vault
    await supabaseAdmin
      .from('vault_accounts')
      .update({ balance: newBalance, daily_saved_today: newDailySaved })
      .eq('user_id', userId);

    // 5. Record transaction
    await supabaseAdmin
      .from('vault_transactions')
      .insert({
        user_id: userId,
        amount: saveAmount,
        direction: 'credit',
        trigger_type: 'auto_upi',
        upi_ref_id: payment.id,
        razorpay_payment_id: payment.id,
        status: 'success',
        note: 'Auto-save from UPI payment'
      });

    // 6. Milestone nudge logic
    let nudgeHi = null;
    let nudgeEn = null;
    if (newBalance >= 10000 && Number(vault.balance) < 10000) {
      nudgeHi = `बधाई हो! आपकी बचत ₹10,000 हो गई! 🎉`;
      nudgeEn = `Congratulations! Your vault crossed ₹10,000! 🎉`;
    } else if (newBalance >= 5000 && Number(vault.balance) < 5000) {
      nudgeHi = `शाबाश! ₹${saveAmount} जमा हुए। कुल बचत: ₹${newBalance.toFixed(2)}`;
      nudgeEn = `Great! ₹${saveAmount} auto-saved. Total: ₹${newBalance.toFixed(2)}`;
    } else {
      nudgeHi = `₹${saveAmount} आपके Vault में जमा हुए।`;
      nudgeEn = `₹${saveAmount} auto-saved to your Vault.`;
    }

    // 7. Insert nudge log
    await supabaseAdmin.from('nudge_log').insert({
      user_id: userId,
      nudge_type: 'vault_auto_save',
      nudge_id: `autosave_${payment.id}`,
      message_hi: nudgeHi,
      message_en: nudgeEn,
      cta_action: 'open_vault'
    });

    return res.json({ received: true, action: 'saved', saveAmount, newBalance });
  } catch (err) {
    console.error('[AutoSave Webhook Error]:', err);
    // Always return 200 to Razorpay so it doesn't retry
    return res.json({ received: true, action: 'error' });
  }
});

// ==========================================
// POST /api/vault/withdraw
// ==========================================

router.post('/withdraw', requireAuth, vaultLimiter, validate(withdrawSchema), async (req, res, next) => {
  const { amount, destination_upi } = req.body;

  try {
    // 1. Fetch user profile for contact details
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('name, mobile')
      .eq('id', req.user.id)
      .single();

    // 2. Fetch vault
    const vault = await getOrCreateVault(req.user.id);
    const currentBalance = Number(vault.balance);

    if (amount > currentBalance) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ₹${currentBalance.toFixed(2)}`,
        code: 'INSUFFICIENT_BALANCE',
        available: currentBalance
      });
    }

    // 3. Create Razorpay Payout via RazorpayX
    let payout;
    try {
      payout = await razorpay.payouts.create({
        account_number: process.env.RAZORPAY_X_ACCOUNT_NUMBER,
        fund_account: {
          account_type: 'vpa',
          vpa: { address: destination_upi },
          contact: {
            name: user?.name || 'SafeKosh User',
            contact: `+91${user?.mobile || '0000000000'}`,
            type: 'self'
          }
        },
        amount: Math.round(amount * 100), // paise
        currency: 'INR',
        mode: 'UPI',
        purpose: 'payout',
        queue_if_low_balance: false,
        notes: { user_id: req.user.id }
      });
    } catch (razorpayErr) {
      console.error('[Withdraw] Razorpay payout creation failed:', razorpayErr);
      return res.status(400).json({
        error: razorpayErr?.error?.description || 'Payout initiation failed',
        code: 'PAYOUT_FAILED'
      });
    }

    // 4. Optimistic balance deduction
    const newBalance = currentBalance - amount;

    await supabaseAdmin
      .from('vault_accounts')
      .update({ balance: newBalance })
      .eq('user_id', req.user.id);

    // 5. Record debit transaction (pending — will confirm via webhook)
    const { data: transaction } = await supabaseAdmin
      .from('vault_transactions')
      .insert({
        user_id: req.user.id,
        amount,
        direction: 'debit',
        trigger_type: 'withdrawal',
        razorpay_payment_id: payout.id,
        status: 'pending',
        note: `Withdrawal to ${destination_upi}`
      })
      .select()
      .single();

    await logAudit(req.user.id, 'vault_withdrawal_initiated', {
      amount,
      destination_upi,
      payout_id: payout.id,
      new_balance: newBalance
    }, req);

    return res.json({
      success: true,
      payoutId: payout.id,
      newBalance,
      eta: '60 seconds'
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// PUT /api/vault/settings
// ==========================================

router.put('/settings', requireAuth, vaultLimiter, validate(settingsSchema), async (req, res, next) => {
  try {
    const { data: account, error } = await supabaseAdmin
      .from('vault_accounts')
      .update(req.body)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    await logAudit(req.user.id, 'vault_settings_updated', req.body, req);

    return res.json({ success: true, account });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /api/vault/simulate-webhook
// ==========================================
router.post('/simulate-webhook', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const vault = await getOrCreateVault(userId);

    const dailySoFar = Number(vault.daily_saved_today);
    const dailyLimit = Number(vault.daily_limit);
    const savePerTx = Number(vault.save_per_transaction);

    // Calculate how much to save respecting daily limit
    const saveAmount = Math.min(savePerTx, Math.max(0, dailyLimit - dailySoFar));

    if (saveAmount <= 0) {
      return res.status(400).json({ error: 'Daily limit reached or savings amount is zero' });
    }

    const newBalance = Number(vault.balance) + saveAmount;
    const newDailySaved = dailySoFar + saveAmount;

    // Update vault
    await supabaseAdmin
      .from('vault_accounts')
      .update({ balance: newBalance, daily_saved_today: newDailySaved })
      .eq('user_id', userId);

    const paymentId = `sim_${crypto.randomBytes(6).toString('hex')}`;

    // Record transaction
    const { data: transaction } = await supabaseAdmin
      .from('vault_transactions')
      .insert({
        user_id: userId,
        amount: saveAmount,
        direction: 'credit',
        trigger_type: 'auto_upi',
        upi_ref_id: paymentId,
        razorpay_payment_id: paymentId,
        status: 'success',
        note: 'Simulated Auto-save from UPI payment'
      })
      .select()
      .single();

    // Milestone nudge logic
    let nudgeHi = null;
    let nudgeEn = null;
    if (newBalance >= 10000 && Number(vault.balance) < 10000) {
      nudgeHi = `बधाई हो! आपकी बचत ₹10,000 हो गई! 🎉`;
      nudgeEn = `Congratulations! Your vault crossed ₹10,000! 🎉`;
    } else if (newBalance >= 5000 && Number(vault.balance) < 5000) {
      nudgeHi = `शाबाश! ₹${saveAmount} जमा हुए। कुल बचत: ₹${newBalance.toFixed(2)}`;
      nudgeEn = `Great! ₹${saveAmount} auto-saved. Total: ₹${newBalance.toFixed(2)}`;
    } else {
      nudgeHi = `₹${saveAmount} आपके Vault में जमा हुए।`;
      nudgeEn = `₹${saveAmount} auto-saved to your Vault.`;
    }

    // Insert nudge log
    await supabaseAdmin.from('nudge_log').insert({
      user_id: userId,
      nudge_type: 'vault_auto_save',
      nudge_id: `autosave_${paymentId}`,
      message_hi: nudgeHi,
      message_en: nudgeEn,
      cta_action: 'open_vault'
    });

    return res.json({ success: true, transaction, newBalance, nudge: { message_hi: nudgeHi, message_en: nudgeEn } });
  } catch (err) {
    next(err);
  }
});

export default router;

