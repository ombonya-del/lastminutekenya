// dispatch-alerts — the pre-dispatch alert engine, server-side.
//
// Invoked by the app after a Site Assessment turns Amber/Red or an SOS is
// raised. Runs on the SERVICE ROLE: it can read provider PII (phones) and send
// on the real channels. The browser never sees any secret.
//
// Deploy:  supabase functions deploy dispatch-alerts
// Secrets: supabase secrets set AT_USERNAME=... AT_API_KEY=... \
//            WHATSAPP_TOKEN=... WHATSAPP_PHONE_ID=... \
//            RESEND_API_KEY=... ALERT_FROM_EMAIL=alerts@lastminutekenya.com
//
// Any channel whose secrets are absent is skipped (alert stored as 'queued'),
// so this works end-to-end before you have provider accounts on every channel.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CAT_LABEL: Record<string, string> = {
  catering: 'Catering', tents: 'Tents & Seating', decor: 'Décor', sound: 'PA & Sound',
  mc: 'MC & Entertainment', photo: 'Photo & Video', cake: 'Cake', transport: 'Transport',
  power: 'Power & Generators', security: 'Security',
}

// --- geo + matching (mirrors src/lib) --------------------------------------
const rad = (d: number) => (d * Math.PI) / 180
function distanceKm(a: any, b: any) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)))
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
function rankProviders(providers: any[], need: any) {
  const W = { distance: 0.34, rating: 0.24, readiness: 0.24, capacity: 0.18 }
  return providers
    .filter((p) => (p.categories || []).includes(need.category) && p.readiness !== 'off')
    .map((p) => {
      const km = distanceKm({ lat: p.base_lat, lng: p.base_lng }, need.coord)
      const score =
        W.distance * Math.max(0, 1 - km / 30) +
        W.rating * clamp01((Number(p.rating) - 3) / 2) +
        W.readiness * (p.readiness === 'ready' ? 1 : 0.45) +
        W.capacity * (need.guests ? Math.min(1, p.capacity / need.guests) : 0.8)
      return { p, km, score: Math.round(score * 100) }
    })
    .sort((a, b) => b.score - a.score)
}

const CHANNEL_ORDER = ['whatsapp', 'sms', 'email']
function pickChannel(p: any) {
  const ch = p.channels || {}
  if (p.preferred_channel && ch[p.preferred_channel]) return p.preferred_channel
  return CHANNEL_ORDER.find((c) => ch[c]) || 'sms'
}

function compose(likelihood: string, category: string, area: string, hoursTo: number | null, guests: number) {
  const window = hoursTo == null ? 'today' : hoursTo < 1 ? 'in under an hour' : `in ~${Math.round(hoursTo)}h`
  const head = likelihood === 'high' ? '🔴 LastMinute intelligence' : likelihood === 'possible' ? '🟠 LastMinute heads-up' : '🟢 LastMinute notice'
  const need = CAT_LABEL[category] || category
  return `${head}: possible ${need} intervention near ${area} ${window}` +
    (guests ? ` (~${guests} guests)` : '') +
    `. Confirm readiness in the app — a rescue call may follow. Do not travel yet.`
}

// --- channel senders (no-op when secrets absent) ---------------------------
// Africa's Talking. Set AT_USERNAME + AT_API_KEY. For free testing use the
// sandbox app (AT_USERNAME=sandbox) — it delivers to the AT simulator, not real
// phones. For production set AT_FROM to your approved alphanumeric sender ID or
// short code. Numbers must be E.164, e.g. +2547XXXXXXXX.
async function sendSMS(to: string, body: string): Promise<boolean> {
  const username = Deno.env.get('AT_USERNAME'), apiKey = Deno.env.get('AT_API_KEY')
  if (!username || !apiKey || !to) return false
  const sandbox = username === 'sandbox' || Deno.env.get('AT_ENV') === 'sandbox'
  const url = sandbox
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging'
  const params: Record<string, string> = { username, to, message: body }
  const from = Deno.env.get('AT_FROM')
  if (from) params.from = from
  const res = await fetch(url, {
    method: 'POST',
    headers: { apiKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(params),
  })
  if (!res.ok) {
    console.error('[AT] SMS send failed', res.status, await res.text().catch(() => ''))
    return false
  }
  return true
}
// WhatsApp Cloud API. Business-initiated messages (which these alerts are —
// the provider hasn't messaged us first) must use a PRE-APPROVED TEMPLATE, not
// free text. Set WHATSAPP_TEMPLATE to your approved template's name; it must
// have a single body variable {{1}} that we fill with the alert text. Free text
// only works inside a 24h customer-service window (fine for a quick test with a
// number that just messaged your test line).
async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const token = Deno.env.get('WHATSAPP_TOKEN'), phoneId = Deno.env.get('WHATSAPP_PHONE_ID')
  if (!token || !phoneId || !to) return false
  const template = Deno.env.get('WHATSAPP_TEMPLATE')
  const lang = Deno.env.get('WHATSAPP_TEMPLATE_LANG') || 'en'
  const num = to.replace('+', '')
  const payload = template
    ? {
        messaging_product: 'whatsapp', to: num, type: 'template',
        template: {
          name: template,
          language: { code: lang },
          components: [{ type: 'body', parameters: [{ type: 'text', text: body }] }],
        },
      }
    : { messaging_product: 'whatsapp', to: num, type: 'text', text: { body } }
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    console.error('[WA] send failed', res.status, await res.text().catch(() => ''))
    return false
  }
  return true
}
async function sendEmail(to: string, body: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('ALERT_FROM_EMAIL')
  if (!key || !from || !to) return false
  const payload: Record<string, unknown> = {
    from, to, subject: 'LastMinuteKenya — possible intervention near you', text: body,
  }
  // Where replies should go (e.g. your ops inbox). Optional.
  const replyTo = Deno.env.get('ALERT_REPLY_TO')
  if (replyTo) payload.reply_to = replyTo
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    console.error('[Resend] send failed', res.status, await res.text().catch(() => ''))
    return false
  }
  return true
}
async function dispatch(channel: string, p: any, body: string): Promise<boolean> {
  if (channel === 'sms') return sendSMS(p.phone, body)
  if (channel === 'whatsapp') return sendWhatsApp(p.phone, body)
  if (channel === 'email') return sendEmail(p.email || '', body)
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { kind, assessmentId, sosId, to, channel } = await req.json()

    // Quick credential check: { "kind":"test", "channel":"sms"|"whatsapp"|"email",
    // "to":"+2547XXXXXXXX" } sends one message and reports whether it went.
    if (kind === 'test') {
      const ch = channel || 'sms'
      const msg = `LastMinuteKenya test ✅ — your ${ch} channel is live.`
      const ok = ch === 'whatsapp' ? await sendWhatsApp(to, msg)
        : ch === 'email' ? await sendEmail(to, msg)
        : await sendSMS(to, msg)
      return new Response(JSON.stringify({ channel: ch, to, sent: ok }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Resolve the trigger context.
    let eventId: string, category: string, refId: string, likelihood = 'high'
    if (kind === 'assessment') {
      const { data: a } = await admin.from('assessments').select('*').eq('id', assessmentId).single()
      eventId = a.event_id; category = null as any; refId = assessmentId
      likelihood = a.band === 'red' ? 'high' : a.band === 'amber' ? 'possible' : 'low'
      // Ensure a rescue job exists for a red scorecard.
      if (a.band === 'red') {
        const { data: existing } = await admin.from('sos_jobs').select('id').eq('event_id', eventId).neq('status', 'resolved')
        if (!existing || existing.length === 0) {
          const { data: ev } = await admin.from('events').select('category').eq('id', eventId).single()
          await admin.from('sos_jobs').insert({ event_id: eventId, from_assessment: assessmentId, category: ev.category, status: 'dispatching', note: 'Auto-raised from Red scorecard.' })
        }
      }
    } else {
      const { data: j } = await admin.from('sos_jobs').select('*').eq('id', sosId).single()
      eventId = j.event_id; category = j.category; refId = sosId
    }

    const { data: event } = await admin.from('events').select('*').eq('id', eventId).single()
    if (!category) category = event.category
    const coord = { lat: event.coord_lat, lng: event.coord_lng }
    const hoursTo = (new Date(event.starts_at).getTime() - Date.now()) / 3_600_000

    // Full providers table (service role can read PII/phones).
    const { data: providers } = await admin.from('providers').select('*')
    const ranked = rankProviders(providers || [], { category, coord, guests: event.guests }).slice(0, 4)

    const results: any[] = []
    for (const m of ranked) {
      const channel = pickChannel(m.p)
      const message = compose(likelihood, category, event.area, hoursTo, event.guests)
      const ok = await dispatch(channel, m.p, message)
      const { data: row } = await admin.from('alerts').insert({
        provider_id: m.p.id, provider_name: m.p.name, channel, kind, likelihood,
        category, area: event.area, ref_id: refId, km: m.km, match_score: m.score,
        message, status: ok ? 'sent' : 'queued',
      }).select().single()
      results.push({ provider: m.p.name, channel, status: row?.status })
    }

    return new Response(JSON.stringify({ dispatched: results.length, results }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
