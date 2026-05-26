import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

serve(async (req) => {
  try {
    // 1. Verify Razorpay webhook signature
    const signature = req.headers.get('X-Razorpay-Signature')
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature header' }), { status: 401 })
    }

    const body = await req.text()
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    if (!secret) {
      return new Response(JSON.stringify({ error: 'Webhook secret is not configured' }), { status: 500 })
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const expectedSig = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (expectedSig !== signature) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 })
    }

    const payload = JSON.parse(body)
    if (payload.event !== 'payment.captured') {
      return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Supabase credentials are not configured' }), { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 2. Find user by notes.user_id from payment
    const userId = payload.payload?.payment?.entity?.notes?.user_id
    if (!userId) {
      return new Response(JSON.stringify({ received: true, reason: 'user_id_not_found_in_notes' }), { status: 200 })
    }

    // 3. Fetch vault account
    const { data: vault, error: vaultError } = await supabase
      .from('vault_accounts')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (vaultError || !vault) {
      return new Response(JSON.stringify({ received: true, reason: 'vault_account_not_found' }), { status: 200 })
    }

    // 4. Reset daily limit if needed
    const today = new Date().toISOString().split('T')[0]
    let dailySavedToday = Number(vault.daily_saved_today || 0)
    if (!vault.last_reset_date || vault.last_reset_date < today) {
      dailySavedToday = 0
      await supabase
        .from('vault_accounts')
        .update({ daily_saved_today: 0, last_reset_date: today })
        .eq('user_id', userId)
    }

    // 5. Calculate save amount
    const savePerTx = Number(vault.save_per_transaction || 20)
    const dailyLimit = Number(vault.daily_limit || 500)
    const saveAmount = Math.min(savePerTx, dailyLimit - dailySavedToday)
    
    if (saveAmount <= 0) {
      return new Response(JSON.stringify({ received: true, reason: 'daily_limit_reached' }), { status: 200 })
    }

    // 6. Insert transaction and update balance atomically using RPC
    const { data: result, error: rpcError } = await supabase.rpc('process_vault_credit', {
      p_user_id: userId,
      p_amount: saveAmount,
      p_trigger_type: 'auto_upi',
      p_upi_ref_id: payload.payload.payment.entity.id
    })

    if (rpcError) {
      return new Response(JSON.stringify({ error: 'RPC execution failed', details: rpcError.message }), { status: 500 })
    }

    // 7. Insert nudge log
    const balanceVal = Number(vault.balance || 0)
    const newBalance = result?.new_balance || (balanceVal + saveAmount)
    let nudgeText = `Aapki tijori mein ₹${saveAmount} aur jud gaye! Ab ₹${newBalance.toFixed(0)} ho gaye.`
    if (newBalance >= 1000 && balanceVal < 1000) {
      nudgeText = `Wah! Aapki tijori ₹1,000 ho gayi! Ek bada kadam!`
    } else if (newBalance >= 5000 && balanceVal < 5000) {
      nudgeText = `Zabardast! ₹5,000 bachaye! Emergency fund tayyar ho raha hai!`
    }

    await supabase.from('nudge_log').insert({
      user_id: userId,
      nudge_type: 'auto_save_success',
      message_hi: nudgeText,
      message_en: `₹${saveAmount} saved automatically. Vault total: ₹${newBalance.toFixed(0)}`
    })

    return new Response(JSON.stringify({ received: true, saved: saveAmount, newBalance }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
