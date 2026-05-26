import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info',
    'Access-Control-Max-Age': '86400'
  }

  // Handle preflight options requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  try {
    const url = new URL(req.url)
    const certRef = url.searchParams.get('certRef')
    
    if (!certRef) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'Missing certRef parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase credentials are not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch certificate with linked user detail
    const { data: cert, error } = await supabase
      .from('income_certificates')
      .select('*, users(name, mobile)')
      .eq('cert_ref', certRef)
      .single()

    if (error || !cert) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'Certificate not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (cert.revoked) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'Certificate has been revoked' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validUntilDate = new Date(cert.valid_until)
    if (validUntilDate < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'Certificate has expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map Polygon Explorer URLs dynamically based on the network configuration
    const scanBaseUrl = cert.blockchain_network === 'polygon_amoy'
      ? 'https://amoy.polygonscan.com/tx'
      : 'https://mumbai.polygonscan.com/tx' // fallback default

    const responsePayload = {
      valid: true,
      certRef: cert.cert_ref,
      issuedFor: cert.users?.name || 'Anonymous User',
      monthlyAvg: Number(cert.monthly_avg || 0),
      total90Day: Number(cert.total_90_day || 0),
      consistencyScore: Number(cert.consistency_score || 0),
      gigPlatforms: cert.gig_platforms || [],
      issuedAt: cert.created_at,
      validUntil: cert.valid_until,
      blockchainHash: cert.blockchain_hash,
      blockchainTxHash: cert.blockchain_tx_hash,
      blockchainNetwork: cert.blockchain_network,
      polygonScanUrl: cert.blockchain_tx_hash ? `${scanBaseUrl}/${cert.blockchain_tx_hash}` : null
    }

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
