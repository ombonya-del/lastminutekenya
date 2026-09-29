// mpesa-callback — Safaricom Daraja calls this after an STK push resolves.
// Matches the payment to a gift order by CheckoutRequestID and marks it paid
// (or cancelled). Set MPESA_CALLBACK_URL (in the stk-push secrets) to this URL.
//
// Deploy:  supabase functions deploy mpesa-callback --no-verify-jwt
// (Daraja can't send a Supabase JWT, so this function must allow anonymous
//  POSTs — it only accepts Daraja's callback shape and writes via service role.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const cb = payload?.Body?.stkCallback
    if (!cb) return new Response(JSON.stringify({ ok: false }), { status: 200 })

    const checkoutId = cb.CheckoutRequestID
    const ok = cb.ResultCode === 0
    let receipt: string | null = null
    if (ok && cb.CallbackMetadata?.Item) {
      receipt = cb.CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value ?? null
    }

    if (checkoutId) {
      await admin()
        .from('gift_orders')
        .update({ status: ok ? 'paid' : 'cancelled', provider_ref: receipt })
        .eq('checkout_request_id', checkoutId)
    }

    // Daraja expects a 200 with this ack shape.
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[mpesa-callback]', e)
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { status: 200 })
  }
})
