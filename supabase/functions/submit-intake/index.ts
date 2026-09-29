// submit-intake — guarded public write path for the customer "Get Help" forms.
//
// Public write forms are a spam magnet, so the SOS and assessment-request
// inserts go through here: we verify the Cloudflare Turnstile token first, then
// insert AS THE CALLER (their JWT, so RLS still applies and requested_by /
// client ownership can't be forged). If TURNSTILE_SECRET isn't set (dev), the
// captcha check is skipped so local work still flows.
//
// Deploy:  supabase functions deploy submit-intake
// Secret:  supabase secrets set TURNSTILE_SECRET=your_turnstile_secret_key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET')
  if (!secret) return true // not configured → skip (dev)
  if (!token) return false
  const form = new URLSearchParams({ secret, response: token })
  if (ip) form.set('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const out = await res.json().catch(() => ({ success: false }))
  return out.success === true
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { type, turnstileToken, payload } = await req.json()

    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')
    if (!(await verifyTurnstile(turnstileToken, ip))) return json({ error: 'captcha_failed' }, 403)

    // Act as the signed-in user so RLS governs the insert.
    const authHeader = req.headers.get('Authorization') || ''
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return json({ error: 'not_authenticated' }, 401)

    if (type === 'assessment') {
      const { data, error } = await supa
        .from('assessments')
        .insert({ event_id: payload.eventId, requested_by: user.id, concern: payload.concern, status: 'requested' })
        .select('id').single()
      if (error) return json({ error: error.message }, 400)
      return json({ id: data.id })
    }

    if (type === 'sos') {
      const { data, error } = await supa
        .from('sos_jobs')
        .insert({ event_id: payload.eventId, category: payload.category, note: payload.note, status: 'dispatching' })
        .select('id').single()
      if (error) return json({ error: error.message }, 400)
      return json({ id: data.id })
    }

    return json({ error: 'unknown_type' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 400)
  }
})
