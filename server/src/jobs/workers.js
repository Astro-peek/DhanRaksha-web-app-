import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import admin from 'firebase-admin';
import { supabaseAdmin } from '../lib/supabase.js';
import blockchain from '../lib/blockchain.js';
import { processCertificateJob } from './generateCertificate.js';

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  password: process.env.UPSTASH_REDIS_TOKEN,
  tls: { rejectUnauthorized: false }
});

// Initialize Firebase Admin SDK
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.info('[Firebase] Firebase Admin SDK initialised successfully.');
    }
  } catch (err) {
    console.error('[Firebase] Failed to initialise Firebase Admin SDK:', err.message);
  }
} else {
  console.warn('[Firebase] Missing Firebase Admin config variables. Push notifications will run in mock simulation mode.');
}

// ─────────────────────────────────────────────────────────
// 1. CERTIFICATE GENERATION WORKER
// ─────────────────────────────────────────────────────────
const certWorker = new Worker('certificate-generation', async (job) => {
  if (job.name === 'generate_certificate') {
    await processCertificateJob(job);
  }
}, { connection });

// ─────────────────────────────────────────────────────────
// 2. PUSH NOTIFICATION WORKER
// ─────────────────────────────────────────────────────────
const notificationWorker = new Worker('notifications', async (job) => {
  const { userId, title_hi, body_hi, title_en, body_en, cta_action, fcm_token, nudge_id } = job.data;

  // Retrieve user's preferred language
  let lang = 'hi';
  try {
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('language')
      .eq('id', userId)
      .maybeSingle();
    if (userProfile?.language) {
      lang = userProfile.language;
    }
  } catch (err) {
    console.warn(`[NotificationWorker] Language fetch failed for user ${userId}. Defaulting to Hindi.`);
  }

  const title = lang === 'hi' ? title_hi : title_en;
  const body = lang === 'hi' ? body_hi : body_en;

  console.info(`[NotificationWorker] Sending push notification to ${userId}: "${title}"`);

  let delivered = false;

  if (fcm_token && admin.apps.length > 0) {
    try {
      await admin.messaging().send({
        token: fcm_token,
        notification: { title, body },
        data: {
          cta_action: cta_action || '',
          userId: userId || '',
        }
      });
      delivered = true;
      console.info(`[NotificationWorker] Push delivered via Firebase FCM to user ${userId}`);
    } catch (fcmErr) {
      console.error(`[NotificationWorker] Firebase FCM delivery failed for user ${userId}:`, fcmErr.message);
    }
  } else {
    // Simulated delivery (local fallback)
    delivered = true;
    console.info(`[NotificationWorker] [MOCK] Delivered push to user ${userId} internally.`);
  }

  if (delivered && nudge_id) {
    try {
      // Mark delivered in DB nudge_log
      await supabaseAdmin
        .from('nudge_log')
        .update({ delivered_at: new Date().toISOString() })
        .or(`id.eq.${nudge_id},nudge_id.eq.${nudge_id}`);
    } catch (err) {
      console.warn(`[NotificationWorker] Failed to update delivered_at timestamp for nudge ${nudge_id}:`, err.message);
    }
  }
}, { connection });

// ─────────────────────────────────────────────────────────
// 3. AUCTION / CHIT WORKER
// ─────────────────────────────────────────────────────────
const auctionWorker = new Worker('auction-management', async (job) => {
  const { groupId, cycleId } = job.data;

  if (job.name === 'open_auction') {
    console.info(`[AuctionWorker] Opening bidding for circle ${groupId}, cycle ${cycleId}`);
    
    // 1. Update cycle state to auction
    const { data: cycle, error: cycleErr } = await supabaseAdmin
      .from('chit_cycles')
      .update({
        status: 'auction',
        auction_opens_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', cycleId)
      .select()
      .single();

    if (cycleErr) throw cycleErr;

    // 2. Fetch circle details
    const { data: group } = await supabaseAdmin
      .from('chit_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    const { data: members } = await supabaseAdmin
      .from('chit_members')
      .select('*, user:users(id, fcm_token)')
      .eq('group_id', groupId);

    // 3. Notify all members that bidding has opened
    if (members) {
      for (const m of members) {
        // Insert nudge in DB
        await supabaseAdmin.from('nudge_log').insert({
          user_id: m.user_id,
          nudge_type: 'chit_auction_open',
          nudge_id: `auction_open_${cycleId}_${m.user_id}`,
          message_hi: `नीलामी खुल गई है! चिट ग्रुप ${group.name} के लिए अपनी बोली लगाएं। 🪙`,
          message_en: `Bidding is now open! Submit your bid for Chit Circle ${group.name}. 🪙`,
          cta_action: 'open_chit'
        }).catch(() => {});
      }
    }
  }

  if (job.name === 'close_auction') {
    console.info(`[AuctionWorker] Auto-closing auction for circle ${groupId}, cycle ${cycleId}`);

    // 1. Fetch current cycle status
    const { data: cycle } = await supabaseAdmin
      .from('chit_cycles')
      .select('*')
      .eq('id', cycleId)
      .single();

    if (!cycle || cycle.status !== 'auction') {
      console.info(`[AuctionWorker] Cycle ${cycleId} is not in auction state (currently: ${cycle?.status || 'unknown'}). Skipping auto-settlement.`);
      return;
    }

    // 2. Fetch group rules
    const { data: group } = await supabaseAdmin
      .from('chit_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    // 3. Fetch bids
    const { data: bids } = await supabaseAdmin
      .from('chit_bids')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('bid_amount', { ascending: false }); // Highest discount wins

    let winningBid;
    let winnerId;
    let winningDiscount = 0;

    const totalPool = group.member_count * group.contribution_per_member;
    const minCommission = totalPool * (group.organiser_commission_pct / 100);

    if (bids && bids.length > 0) {
      winningBid = bids[0];
      winnerId = winningBid.member_id;
      winningDiscount = Number(winningBid.bid_amount);
      
      await supabaseAdmin
        .from('chit_bids')
        .update({ is_winner: true })
        .eq('id', winningBid.id);
    } else {
      // Default fallback if no bids: organizer commission takes pot and random winner is picked
      winningDiscount = minCommission;
      const { data: availableMembers } = await supabaseAdmin
        .from('chit_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('has_won', false)
        .eq('status', 'active');

      if (availableMembers && availableMembers.length > 0) {
        winnerId = availableMembers[0].user_id;
      } else {
        winnerId = group.organiser_id;
      }
    }

    const organiserCommission = minCommission;
    const totalDividend = winningDiscount - organiserCommission;
    const dividendPerMember = Math.max(0, totalDividend / group.member_count);

    // Anchor on-chain proof
    const anchor = await blockchain.anchorCertificateHash(cycleId, cycleId);

    // Update cycle completed status
    await supabaseAdmin
      .from('chit_cycles')
      .update({
        winner_id: winnerId,
        winning_bid: winningDiscount,
        organiser_commission: organiserCommission,
        dividend_per_member: dividendPerMember,
        blockchain_tx_hash: anchor.transactionHash,
        blockchain_block_number: anchor.blockNumber,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', cycleId);

    // Mark winner
    await supabaseAdmin
      .from('chit_members')
      .update({ has_won: true, won_cycle: cycle.cycle_number })
      .eq('group_id', groupId)
      .eq('user_id', winnerId);

    // Distribute dividends
    const { data: members } = await supabaseAdmin
      .from('chit_members')
      .select('user_id, total_dividend_received')
      .eq('group_id', groupId);

    if (members) {
      for (const m of members) {
        const currentDividend = Number(m.total_dividend_received || 0);
        await supabaseAdmin
          .from('chit_members')
          .update({ total_dividend_received: currentDividend + dividendPerMember })
          .eq('group_id', groupId)
          .eq('user_id', m.user_id);
      }
    }

    // Advance cycle
    let nextStatus = 'active';
    let newCycleNum = cycle.cycle_number + 1;

    if (newCycleNum > group.duration_months) {
      nextStatus = 'completed';
      await supabaseAdmin
        .from('chit_groups')
        .update({ status: 'completed' })
        .eq('id', groupId);
    } else {
      await supabaseAdmin
        .from('chit_groups')
        .update({ current_cycle: newCycleNum })
        .eq('id', groupId);

      // Create next cycle record
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const endOfNextWeek = new Date(nextWeek.getTime() + 24 * 60 * 60 * 1000);

      await supabaseAdmin
        .from('chit_cycles')
        .insert({
          group_id: groupId,
          cycle_number: newCycleNum,
          pot_amount: totalPool,
          collection_opens_at: now.toISOString(),
          collection_closes_at: nextWeek.toISOString(),
          auction_opens_at: nextWeek.toISOString(),
          auction_closes_at: endOfNextWeek.toISOString(),
          status: 'collection'
        });
    }

    // DB Nudge Log for winner
    await supabaseAdmin.from('nudge_log').insert({
      user_id: winnerId,
      nudge_type: 'chit_auction_won',
      nudge_id: `won_chit_${cycleId}`,
      message_hi: `बधाई हो! आपने SafeKosh Chit Circle ${group.name} में ₹${(totalPool - winningDiscount).toFixed(2)} का पॉट जीता है। 🎉`,
      message_en: `Congratulations! You have won the pot of ₹${(totalPool - winningDiscount).toFixed(2)} in SafeKosh Chit Circle ${group.name}. 🎉`,
      cta_action: 'open_chit'
    }).catch(() => {});

    console.info(`[AuctionWorker] ✓ Cycle ${cycleId} auto-settled successfully.`);
  }
}, { connection });

// ─────────────────────────────────────────────────────────
// 4. DAILY RESET WORKER
// ─────────────────────────────────────────────────────────
const dailyResetWorker = new Worker('daily-reset', async (job) => {
  if (job.name === 'reset') {
    console.info('[DailyResetWorker] Running midnight daily limit reset...');
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabaseAdmin
        .from('vault_accounts')
        .update({ daily_saved_today: 0, last_reset_date: today })
        .lt('last_reset_date', today);

      if (error) throw error;
      console.info('[DailyResetWorker] ✓ Daily auto-save counters successfully cleared.');
    } catch (err) {
      console.error('[DailyResetWorker] ✗ Failed to reset counters:', err.message);
      throw err;
    }
  }
}, { connection });

export { certWorker, notificationWorker, auctionWorker, dailyResetWorker };
