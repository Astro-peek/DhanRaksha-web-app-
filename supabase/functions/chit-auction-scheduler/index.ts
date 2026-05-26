import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function notifyGroupMembers(supabase: any, groupId: string, messageHi: string, messageEn: string) {
  try {
    const { data: members, error } = await supabase
      .from('chit_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('status', 'active')

    if (error || !members || members.length === 0) return

    const inserts = members.map((m: any) => ({
      user_id: m.user_id,
      nudge_type: 'chit_auction_status',
      message_hi: messageHi,
      message_en: messageEn
    }))

    await supabase.from('nudge_log').insert(inserts)
  } catch (err) {
    console.error('[Scheduler] Failed to notify group members:', err)
  }
}

serve(async (req) => {
  try {
    // Verify internal call via secret header
    const authHeader = req.headers.get('Authorization')
    const internalSecret = Deno.env.get('INTERNAL_CRON_SECRET')
    
    if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Supabase credentials missing' }), { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const now = new Date().toISOString()

    // 1. Check for fully collected cycles → open auction
    const { data: readyForAuction, error: readyError } = await supabase.rpc('get_fully_collected_cycles')
    if (readyError) {
      console.error('[Scheduler] Error checking ready cycles:', readyError.message)
    } else {
      for (const cycle of readyForAuction || []) {
        const auctionClose = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        await supabase
          .from('chit_cycles')
          .update({
            status: 'auction',
            auction_opens_at: now,
            auction_closes_at: auctionClose
          })
          .eq('id', cycle.id)

        // Notify all members
        await notifyGroupMembers(
          supabase,
          cycle.group_id,
          'Neelamee khul gayi! Ab bid karo.',
          'Auction is open! Place your bid now.'
        )
      }
    }

    // 2. Check for auctions past close time → auto-settle with winner
    const { data: expiredAuctions, error: expiredError } = await supabase
      .from('chit_cycles')
      .select('*, chit_groups(*)')
      .eq('status', 'auction')
      .lt('auction_closes_at', now)

    if (expiredError) {
      console.error('[Scheduler] Error fetching expired auctions:', expiredError.message)
    } else {
      for (const cycle of expiredAuctions || []) {
        // Get members who haven't won yet
        const { data: eligibleMembers, error: membersError } = await supabase
          .from('chit_members')
          .select('user_id')
          .eq('group_id', cycle.group_id)
          .eq('has_won', false)
          .eq('status', 'active')

        if (membersError || !eligibleMembers?.length) {
          console.warn(`[Scheduler] No eligible members for group ${cycle.group_id}`)
          continue
        }

        // Get bids, ordered by lowest bid_amount (winning bid in reverse auction)
        const { data: bids } = await supabase
          .from('chit_bids')
          .select('*')
          .eq('cycle_id', cycle.id)
          .order('bid_amount', { ascending: true })

        let winner: string
        let winningBid: number

        if (bids && bids.length > 0) {
          winner = bids[0].member_id
          winningBid = Number(bids[0].bid_amount)
        } else {
          // If no one bids, select a random eligible member
          const randomIndex = Math.floor(Math.random() * eligibleMembers.length)
          winner = eligibleMembers[randomIndex].user_id
          winningBid = Number(cycle.pot_amount) // No discount (member gets full pot value)
        }

        // Organize calculations
        const pot = Number(cycle.pot_amount || 0)
        const commPct = Number(cycle.chit_groups?.organiser_commission_pct || 5)
        const commission = winningBid * (commPct / 100)
        
        const memberCount = Number(cycle.chit_groups?.member_count || 10)
        const dividend = (pot - winningBid) / (memberCount - 1)

        // Update cycle status to completed
        const { error: updateCycleError } = await supabase
          .from('chit_cycles')
          .update({
            status: 'completed',
            winner_id: winner,
            winning_bid: winningBid,
            organiser_commission: commission,
            dividend_per_member: dividend
          })
          .eq('id', cycle.id)

        if (updateCycleError) {
          console.error(`[Scheduler] Failed to update cycle ${cycle.id}:`, updateCycleError.message)
          continue
        }

        // Update member record
        await supabase
          .from('chit_members')
          .update({ has_won: true, won_cycle: cycle.cycle_number })
          .eq('group_id', cycle.group_id)
          .eq('user_id', winner)

        // Notify group of settlement
        await notifyGroupMembers(
          supabase,
          cycle.group_id,
          `Cycle #${cycle.cycle_number} poora hua. Neelamee ke vijeta ko ₹${(winningBid - commission).toFixed(0)} milega.`,
          `Cycle #${cycle.cycle_number} completed. Winner receives ₹${(winningBid - commission).toFixed(0)}.`
        )
      }
    }

    return new Response(JSON.stringify({ processed: true }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
