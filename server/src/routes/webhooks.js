import express from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';

const router = express.Router();

// ==========================================
// HELPERS
// ==========================================

const logAudit = async (userId, action, data = {}) => {
  try {
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action,
      table_name: 'vault_transactions',
      new_data: data
    });
  } catch (err) {
    console.error(`[Audit] ${action} failed:`, err.message);
  }
};

/**
 * Send FCM push notification (stub — wire to Firebase Admin SDK when ready)
 * @param {string} fcmToken
 * @param {string} title
 * @param {string} body
 */
const sendFcm = async (fcmToken, title, body) => {
  if (!fcmToken) return;
  // TODO: integrate firebase-admin sendEachForMulticast here
  console.info(`[FCM] → ${fcmToken.slice(0, 12)}…  "${title}: ${body}"`);
};

// ==========================================
// POST /api/webhooks/razorpay
// Raw body needed for signature verification — must be mounted BEFORE express.json()
// ==========================================

router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    // 1. Verify Razorpay webhook signature
    const signature  = req.headers['x-razorpay-signature'];
    const secret     = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret) {
      console.warn('[Webhook] Missing signature or RAZORPAY_WEBHOOK_SECRET');
      return res.status(400).json({ error: 'Missing signature config' });
    }

    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expected !== signature) {
      console.warn('[Webhook] Signature mismatch — possible spoofed request');
      return res.status(401).json({ error: 'Invalid signature', code: 'SIGNATURE_INVALID' });
    }

    // 2. Parse payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: 'Malformed JSON payload' });
    }

    const event   = payload.event;
    const entity  = payload.payload;

    console.info(`[Webhook] Razorpay event: ${event}`);

    try {
      // ----------------------------------------
      // payout.processed → confirm withdrawal
      // ----------------------------------------
      if (event === 'payout.processed') {
        const payout = entity?.payout?.entity;
        const payoutId = payout?.id;

        if (!payoutId) return res.json({ received: true, action: 'skipped_no_payout_id' });

        // Mark transaction as success
        await supabaseAdmin
          .from('vault_transactions')
          .update({ status: 'success' })
          .eq('razorpay_payment_id', payoutId)
          .eq('direction', 'debit');

        const userId = payout?.notes?.user_id;
        if (userId) {
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('fcm_token')
            .eq('id', userId)
            .maybeSingle();

          const amount = (payout.amount / 100).toFixed(2);
          await sendFcm(
            user?.fcm_token,
            'Withdrawal Successful',
            `₹${amount} has been sent to your UPI account.`
          );
          await logAudit(userId, 'payout_confirmed', { payout_id: payoutId, amount });
        }

        return res.json({ received: true, action: 'payout_confirmed' });
      }

      // ----------------------------------------
      // payout.failed → reverse balance
      // ----------------------------------------
      if (event === 'payout.failed') {
        const payout   = entity?.payout?.entity;
        const payoutId = payout?.id;
        const userId   = payout?.notes?.user_id;

        if (!payoutId) return res.json({ received: true, action: 'skipped' });

        // Mark original transaction failed
        const { data: failedTxns } = await supabaseAdmin
          .from('vault_transactions')
          .update({ status: 'failed' })
          .eq('razorpay_payment_id', payoutId)
          .eq('direction', 'debit')
          .select();

        const amount = failedTxns?.[0]?.amount ?? payout.amount / 100;

        if (userId && amount > 0) {
          // Reverse the optimistic balance deduction
          const { data: vault } = await supabaseAdmin
            .from('vault_accounts')
            .select('balance')
            .eq('user_id', userId)
            .maybeSingle();

          if (vault) {
            const restoredBalance = Number(vault.balance) + Number(amount);

            await supabaseAdmin
              .from('vault_accounts')
              .update({ balance: restoredBalance })
              .eq('user_id', userId);

            // Credit reversal transaction record
            await supabaseAdmin.from('vault_transactions').insert({
              user_id: userId,
              amount,
              direction: 'credit',
              trigger_type: 'withdrawal',
              razorpay_payment_id: payoutId,
              status: 'reversed',
              note: 'Reversal — payout failed'
            });

            const { data: user } = await supabaseAdmin
              .from('users')
              .select('fcm_token')
              .eq('id', userId)
              .maybeSingle();

            await sendFcm(
              user?.fcm_token,
              'Withdrawal Failed',
              `Withdrawal of ₹${Number(amount).toFixed(2)} failed. Amount has been returned to your vault.`
            );
            await logAudit(userId, 'payout_reversed', { payout_id: payoutId, amount, restored_balance: restoredBalance });
          }
        }

        return res.json({ received: true, action: 'payout_reversed' });
      }

      // ----------------------------------------
      // subscription.activated → mandate active
      // ----------------------------------------
      if (event === 'subscription.activated') {
        const sub = entity?.subscription?.entity;
        const mandateId = sub?.id;
        const userId    = sub?.notes?.user_id;

        if (mandateId) {
          await supabaseAdmin
            .from('vault_accounts')
            .update({ mandate_status: 'active' })
            .eq('razorpay_mandate_id', mandateId);
        }

        if (userId) {
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('fcm_token')
            .eq('id', userId)
            .maybeSingle();

          await sendFcm(
            user?.fcm_token,
            'AutoSave Activated!',
            'Your UPI AutoPay mandate is now active. Savings will be collected automatically.'
          );
          await logAudit(userId, 'mandate_activated', { mandate_id: mandateId });
        }

        return res.json({ received: true, action: 'mandate_activated' });
      }

      // ----------------------------------------
      // subscription.cancelled → mandate cancelled
      // ----------------------------------------
      if (event === 'subscription.cancelled') {
        const sub       = entity?.subscription?.entity;
        const mandateId = sub?.id;
        const userId    = sub?.notes?.user_id;

        if (mandateId) {
          await supabaseAdmin
            .from('vault_accounts')
            .update({ mandate_status: 'cancelled' })
            .eq('razorpay_mandate_id', mandateId);
        }

        if (userId) {
          await logAudit(userId, 'mandate_cancelled', { mandate_id: mandateId });
        }

        return res.json({ received: true, action: 'mandate_cancelled' });
      }

      // Default: unhandled event — still return 200 to avoid Razorpay retries
      return res.json({ received: true, action: 'unhandled_event', event });

    } catch (err) {
      console.error('[Webhook] Handler error:', err);
      // Always 200 to Razorpay — failures are logged internally
      return res.json({ received: true, action: 'internal_error' });
    }
  }
);

export default router;
