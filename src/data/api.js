// Supabase data layer — the real backend behind the app.
//
// This mirrors the action names in store.js. The final wiring step (see
// SETUP.md) is to make store.js call these functions instead of mutating the
// in-memory seed, and to hydrate initial state from fetchAll() + subscribe().
//
// Alerts are NOT written from the browser. submitScorecard/raiseSOS invoke the
// `dispatch-alerts` Edge Function, which matches providers and sends via the
// real channels using secrets that never touch the client.

import { supabase } from '../lib/supabase.js'
import { scoreAssessment } from '../lib/scorecard.js'
import { areaCoord } from '../lib/geo.js'

// ---- row <-> app-shape mappers --------------------------------------------
const toProvider = (r) => ({
  id: r.id, name: r.name, lead: r.lead, categories: r.categories || [],
  base: { lat: r.base_lat, lng: r.base_lng }, areaId: r.area, rating: Number(r.rating),
  jobsDone: r.jobs_done, readiness: r.readiness, capacity: r.capacity,
  responseMins: r.response_mins, channels: r.channels || {}, preferredChannel: r.preferred_channel,
  blurb: r.blurb,
})
const toAssessor = (r) => ({ id: r.id, name: r.name, phone: r.phone, areaId: r.area, rating: Number(r.rating), visits: r.visits })
const toEvent = (r) => ({
  id: r.id, clientId: r.client_id, type: r.type, title: r.title, areaId: r.area,
  coord: { lat: r.coord_lat, lng: r.coord_lng }, venue: r.venue, startsAt: r.starts_at,
  guests: r.guests, bookedProvider: r.booked_provider, category: r.category, budget: r.budget,
})
const toAssessment = (r) => ({
  id: r.id, eventId: r.event_id, requestedBy: r.requested_by, assessorId: r.assessor_id,
  status: r.status, concern: r.concern, answers: r.answers || {}, notes: r.notes,
  band: r.band, score: r.score, requestedAt: r.requested_at, visitedAt: r.visited_at, scoredAt: r.scored_at,
})
const toJob = (r) => ({
  id: r.id, eventId: r.event_id, fromAssessment: r.from_assessment, category: r.category,
  status: r.status, note: r.note, acceptedBy: r.accepted_by, raisedAt: r.raised_at,
})
const toAlert = (r) => ({
  id: r.id, providerId: r.provider_id, providerName: r.provider_name, channel: r.channel,
  kind: r.kind, likelihood: r.likelihood, category: r.category, areaId: r.area, refId: r.ref_id,
  km: r.km, matchScore: r.match_score, message: r.message, status: r.status,
  acknowledged: r.acknowledged, sentAt: r.sent_at,
})

// ---- reads -----------------------------------------------------------------
export async function fetchAll() {
  const [providers, assessors, events, assessments, sosJobs, alerts, clients] = await Promise.all([
    supabase.from('providers_public').select('*'),
    supabase.from('assessors').select('*'),
    supabase.from('events').select('*').order('starts_at'),
    supabase.from('assessments').select('*').order('requested_at', { ascending: false }),
    supabase.from('sos_jobs').select('*').order('raised_at', { ascending: false }),
    supabase.from('alerts').select('*').order('sent_at', { ascending: false }),
    // RLS returns what the caller may see (admin: all customers; others: self).
    supabase.from('profiles').select('id,name,phone').eq('role', 'customer'),
  ])
  return {
    providers: (providers.data || []).map(toProvider),
    assessors: (assessors.data || []).map(toAssessor),
    events: (events.data || []).map(toEvent),
    assessments: (assessments.data || []).map(toAssessment),
    sosJobs: (sosJobs.data || []).map(toJob),
    alertsLog: (alerts.data || []).map(toAlert),
    clients: (clients.data || []).map((r) => ({ id: r.id, name: r.name, phone: r.phone })),
  }
}

// ---- mutations (mirror store.js) -------------------------------------------
export async function createEvent(data) {
  const { data: { user } } = await supabase.auth.getUser()
  const c = areaCoord(data.areaId) || {}
  const { data: row, error } = await supabase.from('events').insert({
    client_id: user.id,
    type: data.type, title: data.title, area: data.areaId,
    coord_lat: c.lat ?? null, coord_lng: c.lng ?? null,
    venue: data.venue, starts_at: data.startsAt, guests: data.guests,
    booked_provider: data.bookedProvider, category: data.category, budget: data.budget,
  }).select('id').single()
  if (error) throw error
  return row.id
}

// Public writes go through the Turnstile-guarded submit-intake function.
export async function requestAssessment({ eventId, concern, turnstileToken }) {
  const { data, error } = await supabase.functions.invoke('submit-intake', {
    body: { type: 'assessment', turnstileToken, payload: { eventId, concern } },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data.id
}

export async function assignAssessor(assessmentId, assessorId) {
  const { error } = await supabase.from('assessments')
    .update({ assessor_id: assessorId, status: 'assigned' }).eq('id', assessmentId)
  if (error) throw error
}

export async function submitScorecard(assessmentId, answers, notes) {
  const { band, score } = scoreAssessment(answers)
  const now = new Date().toISOString()
  const { error } = await supabase.from('assessments')
    .update({ answers, notes, band, score, status: 'scored', visited_at: now, scored_at: now })
    .eq('id', assessmentId)
  if (error) throw error
  // Fire the pre-dispatch engine server-side (matches, alerts, sends, and — on
  // red — opens the rescue job). Secrets stay in the function's env.
  if (band !== 'green') {
    await supabase.functions.invoke('dispatch-alerts', { body: { kind: 'assessment', assessmentId } })
  }
  return { band, score }
}

export async function raiseSOS({ eventId, category, note, turnstileToken }) {
  const { data, error } = await supabase.functions.invoke('submit-intake', {
    body: { type: 'sos', turnstileToken, payload: { eventId, category, note } },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  await supabase.functions.invoke('dispatch-alerts', { body: { kind: 'sos', sosId: data.id } })
  return data.id
}

export async function acceptSOS(jobId, providerId) {
  const { error } = await supabase.from('sos_jobs')
    .update({ accepted_by: providerId, status: 'accepted' }).eq('id', jobId)
  if (error) throw error
}

export async function resolveSOS(jobId) {
  const { error } = await supabase.from('sos_jobs').update({ status: 'resolved' }).eq('id', jobId)
  if (error) throw error
}

export async function setReadiness(providerId, readiness) {
  const { error } = await supabase.from('providers').update({ readiness }).eq('id', providerId)
  if (error) throw error
}

export async function acknowledgeAlert(alertId) {
  const { error } = await supabase.from('alerts').update({ acknowledged: true }).eq('id', alertId)
  if (error) throw error
}

// ---- identity + accounts (admin) ------------------------------------------
// Who am I: role + my linked provider/assessor ids, in one call.
export async function whoami() {
  const { data, error } = await supabase.rpc('whoami')
  if (error) {
    console.error('[api] whoami failed', error)
    return { role: 'customer', providerId: null, assessorId: null }
  }
  return data
}

// Admin: list everyone who has signed up (RLS returns all for admins).
export async function listProfiles() {
  const { data } = await supabase
    .from('profiles')
    .select('id,email,name,role,phone,requested_role')
    .order('role')
  return data || []
}

export async function findProfileByEmail(email) {
  const { data } = await supabase
    .from('profiles')
    .select('id,email,name,role')
    .ilike('email', email.trim())
    .maybeSingle()
  return data || null
}

export async function setProfileRole(profileId, role) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId)
  if (error) throw error
}

export async function linkProviderAccount(providerId, profileId) {
  const { error } = await supabase.from('providers').update({ profile_id: profileId }).eq('id', providerId)
  if (error) throw error
}

export async function linkAssessorAccount(assessorId, profileId) {
  const { error } = await supabase.from('assessors').update({ profile_id: profileId }).eq('id', assessorId)
  if (error) throw error
}

// Full providers (with profile_id) for the admin Accounts screen — RLS lets
// admins read the base table.
export async function fetchProvidersAdmin() {
  const { data } = await supabase.from('providers').select('id,name,area,categories,profile_id')
  return data || []
}
export async function fetchAssessorsAdmin() {
  const { data } = await supabase.from('assessors').select('id,name,area,profile_id')
  return data || []
}

// ---- gift shop -------------------------------------------------------------
// Persist the order (+ items) as the signed-in customer, then return its id.
export async function createGiftOrder({ recipient, address, message, phone, method, items, subtotal, delivery, total }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: order, error } = await supabase.from('gift_orders').insert({
    client_id: user?.id ?? null, recipient, address, message, phone, method,
    subtotal, delivery, total, status: 'pending_payment',
  }).select('id').single()
  if (error) throw error
  if (items?.length) {
    await supabase.from('gift_order_items').insert(items.map((l) => ({
      order_id: order.id, product_id: l.productId, name: l.product?.name, qty: l.qty, price: l.product?.price,
    })))
  }
  return order.id
}

// M-Pesa STK push (Daraja). Passes the order id so the callback can mark it paid.
export async function mpesaCheckout({ phone, amount, orderId }) {
  const { data, error } = await supabase.functions.invoke('mpesa-stkpush', {
    body: { phone, amount, orderRef: orderId || 'LastMinuteGift' },
  })
  if (error) throw error
  return data
}

// Airtel Money / card via Flutterwave (aggregator). Returns a hosted-checkout link.
export async function flutterwaveCharge({ phone, amount, orderId, method, email, name }) {
  const { data, error } = await supabase.functions.invoke('flutterwave-charge', {
    body: { phone, amount, orderId, method, email, name },
  })
  if (error) throw error
  return data
}

// ---- realtime --------------------------------------------------------------
// Call onChange() whenever anything the current user can see changes, then
// re-run fetchAll() (simplest) or patch state per-row.
export function subscribeRealtime(onChange) {
  const channel = supabase.channel('lmk-realtime')
  for (const table of ['assessments', 'sos_jobs', 'alerts', 'providers']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
  }
  channel.subscribe()
  return () => supabase.removeChannel(channel)
}
