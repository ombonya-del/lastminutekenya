// flutterwave-charge — Airtel Money & card payments via Flutterwave (the
// aggregator that also covers M-Pesa, Visa and Mastercard in Kenya). Returns a
// hosted-checkout `link` the client redirects to. Simulated when the secret is
// absent, so the flow works before you have credentials.
//
// Deploy:  supabase functions deploy flutterwave-charge
// Secrets: supabase secrets set FLW_SECRET_KEY=FLWSECK-... \
//            SHOP_REDIRECT_URL=https://lastminutekenya.com/customer/requests
//
// Webhook: point Flutterwave's webhook at a `flutterwave-webhook` function
// (next step) to mark the order paid, mirroring mpesa-callback.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { phone, amount, orderId, method, email, name } = await req.json()
    const key = Deno.env.get('FLW_SECRET_KEY')
    const redirect = Deno.env.get('SHOP_REDIRECT_URL') || 'https://lastminutekenya.com/customer/requests'
    const txRef = `LMK-${orderId || crypto.randomUUID()}`

    if (orderId) {
      try { await admin().from('gift_orders').update({ method: method || 'card', provider_ref: txRef }).eq('id', orderId) } catch (_) { /* optional */ }
    }

    // Not configured → simulate.
    if (!key) {
      return json({ simulated: true, ok: true, link: null, message: 'Flutterwave not configured (set FLW_SECRET_KEY to go live)', txRef })
    }

    // 'mobilemoneykenya' = Airtel Money; 'card' = Visa/Mastercard.
    const payment_options = method === 'airtel' ? 'mobilemoneykenya' : 'card'
    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: txRef,
        amount,
        currency: 'KES',
        redirect_url: redirect,
        payment_options,
        customer: { email: email || 'guest@lastminutekenya.com', phonenumber: phone, name: name || 'LastMinute customer' },
        customizations: { title: 'LastMinuteKenya Gift', description: 'Save-The-Day gift order' },
      }),
    })
    const out = await res.json()
    if (out.status !== 'success') {
      console.error('[flutterwave] init failed', JSON.stringify(out))
      return json({ ok: false, error: out }, 400)
    }
    return json({ ok: true, link: out.data.link, txRef })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 400)
  }
})
