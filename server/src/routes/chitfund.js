import express from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import blockchain from '../lib/blockchain.js';

const router = express.Router();

// ==========================================
// SCHEMAS
// ==========================================

const createGroupSchema = z.object({
  name: z.string().min(3, 'Group name must be at least 3 characters'),
  description: z.string().optional(),
  member_count: z.number().min(5).max(50),
  contribution_per_member: z.number().min(500).max(50000),
  duration_months: z.number().min(2).max(60),
  organiser_commission_pct: z.number().min(2).max(8).default(5)
});

const joinGroupSchema = z.object({
  invite_token: z.string().uuid('Invalid invite token format')
});

const bidSchema = z.object({
  bid_amount: z.number().min(0, 'Bid discount cannot be negative')
});

const contributionSchema = z.object({
  cycle_id: z.string().uuid(),
  amount: z.number().min(10)
});

// ==========================================
// HELPERS
// ==========================================

const logAudit = async (userId, action, data = {}, req) => {
  try {
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action,
      table_name: 'chit_groups',
      new_data: { ...data, path: req.originalUrl },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null
    });
  } catch (err) {
    console.error(`[Audit] ${action} failed:`, err.message);
  }
};

// ==========================================
// POST /api/chitfund/groups (Create a new Group)
// ==========================================

router.post('/groups', requireAuth, validate(createGroupSchema), async (req, res, next) => {
  try {
    const { name, description, member_count, contribution_per_member, duration_months, organiser_commission_pct } = req.body;

    // 1. Insert chit group
    const { data: group, error: groupErr } = await supabaseAdmin
      .from('chit_groups')
      .insert({
        name,
        description,
        organiser_id: req.user.id,
        member_count,
        contribution_per_member,
        duration_months,
        organiser_commission_pct,
        status: 'forming'
      })
      .select()
      .single();

    if (groupErr) throw groupErr;

    // 2. Automatically add the organiser as the first joined member
    const { error: memberErr } = await supabaseAdmin
      .from('chit_members')
      .insert({
        group_id: group.id,
        user_id: req.user.id,
        status: 'joined',
        joined_at: new Date().toISOString()
      });

    if (memberErr) throw memberErr;

    await logAudit(req.user.id, 'chit_group_created', { group_id: group.id, name }, req);

    return res.json({
      success: true,
      group
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// GET /api/chitfund/groups (List Groups)
// ==========================================

router.get('/groups', requireAuth, async (req, res, next) => {
  const { filter } = req.query; // 'joined', 'organised', 'forming', 'all'
  try {
    let query = supabaseAdmin.from('chit_groups').select('*');

    if (filter === 'organised') {
      query = query.eq('organiser_id', req.user.id);
    } else if (filter === 'forming') {
      query = query.eq('status', 'forming');
    } else if (filter === 'joined') {
      // Find groups where user is a member
      const { data: memberships } = await supabaseAdmin
        .from('chit_members')
        .select('group_id')
        .eq('user_id', req.user.id);
      
      const groupIds = memberships?.map(m => m.group_id) || [];
      query = query.in('id', groupIds);
    } else {
      // default: get all groups where user is either organiser OR a member
      const { data: memberships } = await supabaseAdmin
        .from('chit_members')
        .select('group_id')
        .eq('user_id', req.user.id);
      
      const groupIds = memberships?.map(m => m.group_id) || [];
      query = query.or(`organiser_id.eq.${req.user.id},id.in.(${groupIds.join(',') || '00000000-0000-0000-0000-000000000000'})`);
    }

    const { data: groups, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    return res.json({ success: true, groups });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// GET /api/chitfund/groups/:groupId (Detail View)
// ==========================================

router.get('/groups/:groupId', requireAuth, async (req, res, next) => {
  const { groupId } = req.params;

  try {
    // 1. Fetch group details
    const { data: group, error: groupErr } = await supabaseAdmin
      .from('chit_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupErr) throw groupErr;

    // 2. Fetch members list with profiles
    const { data: members, error: membersErr } = await supabaseAdmin
      .from('chit_members')
      .select('*, user:users(id, name, mobile)')
      .eq('group_id', groupId);

    if (membersErr) throw membersErr;

    // Check if current user is part of the group
    const isMember = members.some(m => m.user_id === req.user.id) || group.organiser_id === req.user.id;
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this Chit Circle', code: 'ACCESS_DENIED' });
    }

    // 3. Fetch active cycles and status
    const { data: cycles, error: cyclesErr } = await supabaseAdmin
      .from('chit_cycles')
      .select('*')
      .eq('group_id', groupId)
      .order('cycle_number', { ascending: true });

    if (cyclesErr) throw cyclesErr;

    return res.json({
      success: true,
      group,
      members,
      cycles
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /api/chitfund/join (Join a Group via invite token)
// ==========================================

router.post('/join', requireAuth, validate(joinGroupSchema), async (req, res, next) => {
  const { invite_token } = req.body;

  try {
    // 1. Find group by invite token
    const { data: group, error: groupErr } = await supabaseAdmin
      .from('chit_groups')
      .select('*')
      .eq('invite_token', invite_token)
      .maybeSingle();

    if (groupErr) throw groupErr;
    if (!group) {
      return res.status(404).json({ error: 'Invalid invite token. Circle not found.', code: 'CIRCLE_NOT_FOUND' });
    }

    if (group.status !== 'forming') {
      return res.status(400).json({ error: 'This Chit Circle has already started or is completed.', code: 'CIRCLE_ALREADY_STARTED' });
    }

    // 2. Check current member count
    const { count, error: countErr } = await supabaseAdmin
      .from('chit_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', group.id);

    if (countErr) throw countErr;

    if (count >= group.member_count) {
      return res.status(400).json({ error: 'This savings circle is already full.', code: 'CIRCLE_FULL' });
    }

    // 3. Add user to members
    const { data: member, error: memberErr } = await supabaseAdmin
      .from('chit_members')
      .insert({
        group_id: group.id,
        user_id: req.user.id,
        status: 'joined',
        joined_at: new Date().toISOString()
      })
      .select()
      .single();

    if (memberErr) {
      if (memberErr.code === '23505') {
        return res.status(400).json({ error: 'You are already a member of this circle.', code: 'ALREADY_MEMBER' });
      }
      throw memberErr;
    }

    // 4. If circle is now full, transition it to active and create Cycle 1
    const newCount = count + 1;
    if (newCount === group.member_count) {
      // Set group status active
      await supabaseAdmin
        .from('chit_groups')
        .update({ status: 'active', current_cycle: 1 })
        .eq('id', group.id);

      // Create cycle 1 details
      const potAmount = group.member_count * group.contribution_per_member;
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const endOfNextWeek = new Date(nextWeek.getTime() + 24 * 60 * 60 * 1000);

      await supabaseAdmin
        .from('chit_cycles')
        .insert({
          group_id: group.id,
          cycle_number: 1,
          pot_amount: potAmount,
          collection_opens_at: now.toISOString(),
          collection_closes_at: nextWeek.toISOString(),
          auction_opens_at: nextWeek.toISOString(),
          auction_closes_at: endOfNextWeek.toISOString(),
          status: 'collection'
        });

      // Update all members to status 'active'
      await supabaseAdmin
        .from('chit_members')
        .update({ status: 'active' })
        .eq('group_id', group.id);
    }

    await logAudit(req.user.id, 'chit_group_joined', { group_id: group.id }, req);

    return res.json({
      success: true,
      message: 'Successfully joined Chit Circle!',
      group: { ...group, status: newCount === group.member_count ? 'active' : 'forming' }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /api/chitfund/groups/:groupId/bid (Submit an auction bid)
// ==========================================

router.post('/groups/:groupId/bid', requireAuth, validate(bidSchema), async (req, res, next) => {
  const { groupId } = req.params;
  const { bid_amount } = req.body; // In Indian Chits, bid_amount is the DISCOUNT they agree to give up.

  try {
    // 1. Fetch group
    const { data: group } = await supabaseAdmin
      .from('chit_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (!group || group.status !== 'active') {
      return res.status(400).json({ error: 'Chit Circle is not currently active.', code: 'CIRCLE_NOT_ACTIVE' });
    }

    // 2. Fetch member
    const { data: member } = await supabaseAdmin
      .from('chit_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', req.user.id)
      .single();

    if (!member || member.status !== 'active') {
      return res.status(403).json({ error: 'You are not an active member in this group', code: 'FORBIDDEN' });
    }

    if (member.has_won) {
      return res.status(400).json({ error: 'You have already won a pot in a previous cycle of this circle.', code: 'ALREADY_WON' });
    }

    // 3. Fetch current active cycle
    const { data: cycle } = await supabaseAdmin
      .from('chit_cycles')
      .select('*')
      .eq('group_id', groupId)
      .eq('cycle_number', group.current_cycle)
      .single();

    if (!cycle || cycle.status !== 'auction') {
      return res.status(400).json({ error: 'Auction period is not currently open for this cycle.', code: 'AUCTION_CLOSED' });
    }

    // 4. Validate bid amount (the discount)
    // Minimum discount: Organiser commission. Maximum discount: 40% of pool size
    const totalPool = group.member_count * group.contribution_per_member;
    const minBid = totalPool * (group.organiser_commission_pct / 100);
    const maxBid = totalPool * 0.40;

    if (bid_amount < minBid || bid_amount > maxBid) {
      return res.status(400).json({
        error: `Bid discount must be between ${minBid} and ${maxBid}.`,
        code: 'INVALID_BID_LIMITS'
      });
    }

    // 5. Submit or update the bid
    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('chit_bids')
      .insert({
        cycle_id: cycle.id,
        group_id: groupId,
        member_id: req.user.id,
        bid_amount
      })
      .select()
      .single();

    if (bidErr) {
      if (bidErr.code === '23505') {
        // Update bid if already exists
        const { data: updatedBid } = await supabaseAdmin
          .from('chit_bids')
          .update({ bid_amount, submitted_at: new Date().toISOString() })
          .eq('cycle_id', cycle.id)
          .eq('member_id', req.user.id)
          .select()
          .single();
        return res.json({ success: true, bid: updatedBid });
      }
      throw bidErr;
    }

    await logAudit(req.user.id, 'chit_bid_submitted', { cycle_id: cycle.id, bid_amount }, req);

    return res.json({ success: true, bid });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /api/chitfund/contribute (Submit a cycle contribution payment)
// ==========================================

router.post('/contribute', requireAuth, validate(contributionSchema), async (req, res, next) => {
  const { cycle_id, amount } = req.body;

  try {
    const { data: cycle } = await supabaseAdmin
      .from('chit_cycles')
      .select('*, group:chit_groups(*)')
      .eq('id', cycle_id)
      .single();

    if (!cycle || cycle.status !== 'collection') {
      return res.status(400).json({ error: 'Collection period is not active for this cycle.', code: 'COLLECTION_INACTIVE' });
    }

    // Record the contribution (mock payment transaction)
    const orderId = `order_${Math.random().toString(36).substr(2, 9)}`;
    const paymentId = `pay_${Math.random().toString(36).substr(2, 9)}`;

    const { data: contrib, error: contribErr } = await supabaseAdmin
      .from('chit_contributions')
      .insert({
        cycle_id,
        group_id: cycle.group_id,
        member_id: req.user.id,
        amount,
        cashfree_order_id: orderId,
        cashfree_payment_id: paymentId,
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .select()
      .single();

    if (contribErr) {
      if (contribErr.code === '23505') {
        return res.status(400).json({ error: 'You have already paid your contribution for this cycle.', code: 'ALREADY_PAID' });
      }
      throw contribErr;
    }

    // Increment member total contributed
    const { data: member } = await supabaseAdmin
      .from('chit_members')
      .select('total_contributed')
      .eq('group_id', cycle.group_id)
      .eq('user_id', req.user.id)
      .single();

    const currentContributed = Number(member?.total_contributed || 0);

    await supabaseAdmin
      .from('chit_members')
      .update({ total_contributed: currentContributed + amount })
      .eq('group_id', cycle.group_id)
      .eq('user_id', req.user.id);

    await logAudit(req.user.id, 'chit_contribution_paid', { cycle_id, amount }, req);

    return res.json({
      success: true,
      contribution: contrib,
      paymentId
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /api/chitfund/groups/:groupId/start-auction
// ==========================================
router.post('/groups/:groupId/start-auction', requireAuth, async (req, res, next) => {
  const { groupId } = req.params;

  try {
    const { data: group } = await supabaseAdmin
      .from('chit_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (!group || group.status !== 'active') {
      return res.status(400).json({ error: 'Circle is not active.', code: 'CIRCLE_NOT_ACTIVE' });
    }

    if (group.organiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the organiser can open the bidding period.', code: 'FORBIDDEN' });
    }

    const { data: cycle } = await supabaseAdmin
      .from('chit_cycles')
      .select('*')
      .eq('group_id', groupId)
      .eq('cycle_number', group.current_cycle)
      .single();

    if (!cycle) {
      return res.status(404).json({ error: 'Active cycle not found.', code: 'CYCLE_NOT_FOUND' });
    }

    if (cycle.status !== 'collection') {
      return res.status(400).json({ error: 'Cycle is not in collection phase.', code: 'INVALID_PHASE' });
    }

    // Transition to auction
    const { data: updatedCycle, error: updateErr } = await supabaseAdmin
      .from('chit_cycles')
      .update({
        status: 'auction',
        auction_opens_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', cycle.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await logAudit(req.user.id, 'chit_auction_started', { cycle_id: cycle.id }, req);

    return res.json({
      success: true,
      cycle: updatedCycle
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /api/chitfund/groups/:groupId/settle-cycle (Settle active cycle auction)
// ==========================================

router.post('/groups/:groupId/settle-cycle', requireAuth, async (req, res, next) => {
  const { groupId } = req.params;

  try {
    // 1. Fetch group & verify request user is the organiser
    const { data: group } = await supabaseAdmin
      .from('chit_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (!group || group.status !== 'active') {
      return res.status(400).json({ error: 'Circle is not active.', code: 'CIRCLE_NOT_ACTIVE' });
    }

    if (group.organiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the circle organizer can settle an auction cycle.', code: 'FORBIDDEN' });
    }

    const currentCycleNum = group.current_cycle;

    // 2. Fetch active cycle record
    const { data: cycle } = await supabaseAdmin
      .from('chit_cycles')
      .select('*')
      .eq('group_id', groupId)
      .eq('cycle_number', currentCycleNum)
      .single();

    if (!cycle) {
      return res.status(404).json({ error: 'Active cycle not found.', code: 'CYCLE_NOT_FOUND' });
    }

    // 3. Fetch all bids for this cycle
    const { data: bids } = await supabaseAdmin
      .from('chit_bids')
      .select('*')
      .eq('cycle_id', cycle.id)
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
      
      // Mark winning bid
      await supabaseAdmin
        .from('chit_bids')
        .update({ is_winner: true })
        .eq('id', winningBid.id);
    } else {
      // Default case if no one bids: Organizer takes default commission and picks random winner
      winningDiscount = minCommission;
      // Get any active member who hasn't won yet
      const { data: availableMembers } = await supabaseAdmin
        .from('chit_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('has_won', false)
        .eq('status', 'active');

      if (availableMembers && availableMembers.length > 0) {
        // Pick first available member
        winnerId = availableMembers[0].user_id;
      } else {
        winnerId = group.organiser_id;
      }
    }

    // 4. Calculations
    const organiserCommission = minCommission;
    const totalDividend = winningDiscount - organiserCommission;
    const dividendPerMember = Math.max(0, totalDividend / group.member_count);

    // 5. Smart Contract Simulation Anchoring
    const anchor = await blockchain.anchorCertificateHash(cycle.id, cycle.id);

    // 6. Update cycle record
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
      .eq('id', cycle.id);

    // 7. Mark winner status in member table
    await supabaseAdmin
      .from('chit_members')
      .update({ has_won: true, won_cycle: currentCycleNum })
      .eq('group_id', groupId)
      .eq('user_id', winnerId);

    // 8. Distribute dividend to all members
    const { data: members } = await supabaseAdmin
      .from('chit_members')
      .select('user_id, total_dividend_received')
      .eq('group_id', groupId);

    for (const m of members) {
      const currentDividend = Number(m.total_dividend_received || 0);
      await supabaseAdmin
        .from('chit_members')
        .update({ total_dividend_received: currentDividend + dividendPerMember })
        .eq('group_id', groupId)
        .eq('user_id', m.user_id);
    }

    // 9. Advance cycle or complete circle
    let nextStatus = 'active';
    let newCycleNum = currentCycleNum + 1;

    if (newCycleNum > group.duration_months) {
      nextStatus = 'completed';
      newCycleNum = currentCycleNum; // keep last
      
      await supabaseAdmin
        .from('chit_groups')
        .update({ status: 'completed' })
        .eq('id', groupId);
    } else {
      // Advance to next cycle
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

    // 10. Log nudge notifications
    await supabaseAdmin.from('nudge_log').insert({
      user_id: winnerId,
      nudge_type: 'chit_auction_won',
      nudge_id: `won_chit_${cycle.id}`,
      message_hi: `बधाई हो! आपने SafeKosh Chit Circle ${group.name} में ₹${(totalPool - winningDiscount).toFixed(2)} का पॉट जीता है। 🎉`,
      message_en: `Congratulations! You have won the pot of ₹${(totalPool - winningDiscount).toFixed(2)} in SafeKosh Chit Circle ${group.name}. 🎉`,
      cta_action: 'open_chit'
    });

    await logAudit(req.user.id, 'chit_cycle_settled', {
      cycle_id: cycle.id,
      winner_id: winnerId,
      winning_discount: winningDiscount,
      blockchain_tx_hash: anchor.transactionHash
    }, req);

    return res.json({
      success: true,
      winnerId,
      payoutAmount: totalPool - winningDiscount,
      dividendPerMember,
      blockchainTxHash: anchor.transactionHash,
      nextCycleNumber: newCycleNum,
      circleStatus: nextStatus
    });
  } catch (err) {
    next(err);
  }
});

export default router;
