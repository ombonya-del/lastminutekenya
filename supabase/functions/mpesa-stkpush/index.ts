// mpesa-stkpush — Safaricom Daraja STK push for the Save-The-Day Gift Shop.
//
// Sends an M-Pesa payment prompt to the customer's phone. When the Daraja
// secrets aren't set (dev), it returns a simulated success so the shop flow
// works end-to-end before you have credentials — same pattern as the alert
// channels.
//
// Deploy:  supabase functions deploy mpesa-stkpush
// Secrets: supabase secrets set MPESA_ENV=sandbox \
//            MPESA_CONSUMER_KEY=... MPESA_CONSUMER_SECRET=... \
//            MPESA_SHORTCODE=174379 MPESA_PASSKEY=... \
//            MPESA_CALLBACK_URL=https://YOUR-PROJECT.functions.supabase.co/mpesa-callback
//
// Next step (not included): an `mpesa-callback` function that Daraja calls with
// the payment result, which marks the order paid and releases the gift for
// dispatch.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '')
function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

// Normalise 07xx / +2547xx / 2547xx to 2547xxxxxxxx
function msisdn(p: string) {
  const d = (p || '').replace(/\D/g, '')
  if (d.startsWith('254')) return d
  if (d.startsWith('0')) return '254' + d.slice(1)
  if (d.startsWith('7') || d.startsWith('1')) return '254' + d
  return d
}

async function darajaToken(base: string, key: string, secret: string) {
  const auth = btoa(`${key}:${secret}`)
  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  const out = await res.json()
  return out.access_token as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { phone, amount, orderRef } = await req.json()
    const key = Deno.env.get('MPESA_CONSUMER_KEY')
    const secret = Deno.env.get('MPESA_CONSUMER_SECRET')
    const shortcode = Deno.env.get('MPESA_SHORTCODE')
    const passkey = Deno.env.get('MPESA_PASSKEY')
    const callback = Deno.env.get('MPESA_CALLBACK_URL')
    const env = Deno.env.get('MPESA_ENV') || 'sandbox'

    // Dev / not-yet-configured: simulate a successful prompt (mark order paid).
    if (!key || !secret || !shortcode || !passkey) {
      if (isUuid(orderRef)) {
        try { await admin().from('gift_orders').update({ status: 'paid', method: 'mpesa', provider_ref: 'SIMULATED' }).eq('id', orderRef) } catch (_) { /* orders table optional */ }
      }
      return json({ simulated: true, ok: true, message: 'STK push simulated (set MPESA_* secrets to go live)', phone: msisdn(phone), amount })
    }

    const base = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'
    const token = await darajaToken(base, key, secret)

    const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    const password = btoa(`${shortcode}${passkey}${ts}`)

    const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: msisdn(phone),
        PartyB: shortcode,
        PhoneNumber: msisdn(phone),
        CallBackURL: callback,
        AccountReference: orderRef || 'LastMinuteGift',
        TransactionDesc: 'Save-The-Day gift',
      }),
    })
    const out = await res.json()
    if (!res.ok || out.errorCode) {
      console.error('[mpesa] stk push failed', res.status, JSON.stringify(out))
      return json({ ok: false, error: out }, 400)
    }
    // Record the CheckoutRequestID so mpesa-callback can match the payment to the order.
    if (isUuid(orderRef) && out.CheckoutRequestID) {
      try { await admin().from('gift_orders').update({ checkout_request_id: out.CheckoutRequestID, method: 'mpesa' }).eq('id', orderRef) } catch (_) { /* optional */ }
    }
    return json({ ok: true, checkoutRequestId: out.CheckoutRequestID, merchantRequestId: out.MerchantRequestID })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 400)
  }
})
