// Reactive store — dual mode.
//
// • No backend configured (no VITE_SUPABASE_* env): runs entirely on the
//   in-memory seed, exactly like the prototype.
// • Backend configured (supabaseEnabled): starts empty, hydrates from
//   api.fetchAll(), subscribes to realtime, and every action delegates to the
//   matching api.* call. Realtime pushes the updated rows back into state.
//
// Nothing else in the app changes — same action names, same selectors.

import { useSyncExternalStore } from 'react'
import * as seed from './seed.js'
import { scoreAssessment, interventionLikelihood } from '../lib/scorecard.js'
import { matchProviders } from '../lib/matching.js'
import { buildAlerts } from '../lib/alertEngine.js'
import { hoursUntil } from '../lib/format.js'
import { areaCoord } from '../lib/geo.js'
import { supabaseEnabled } from '../lib/supabase.js'
import { ensureAnonymousSession } from '../lib/auth.js'
import * as api from './api.js'

const clone = (x) => JSON.parse(JSON.stringify(x))
let uid = 1000
const newId = (p) => `${p}_${uid++}`

// Backfill band/score onto any pre-seeded scorecards so chips and summaries
// that read them directly have values (live submissions set these already).
const seededAssessments = clone(seed.assessments).map((a) => {
  if (a.status === 'scored' && a.band == null) {
    const { band, score } = scoreAssessment(a.answers)
    return { ...a, band, score }
  }
  return a
})

let state = supabaseEnabled
  ? {
      // Live mode: real clock, empty until hydrate() fills it from Supabase.
      now: new Date(),
      providers: [], clients: [], assessors: [], events: [],
      assessments: [], sosJobs: [], alertsLog: [], cart: [], toast: null,
    }
  : {
      now: new Date(seed.NOW_ISO),
      providers: clone(seed.providers),
      clients: clone(seed.clients),
      assessors: clone(seed.assessors),
      events: clone(seed.events),
      assessments: seededAssessments,
      sosJobs: clone(seed.sosJobs),
      alertsLog: clone(seed.alertsLog),
      cart: [],
      toast: null,
    }

const listeners = new Set()
function commit(next) {
  state = next
  listeners.forEach((l) => l())
}
function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getState = () => state

export function useStore() {
  return useSyncExternalStore(subscribe, getState, getState)
}

// ---- live hydration --------------------------------------------------------
function refresh() {
  return api
    .fetchAll()
    .then((data) => commit({ ...state, ...data }))
    .catch((e) => console.error('[store] refresh failed', e))
}
if (supabaseEnabled) {
  // Sign the visitor in (anonymously if they have no session) so RLS-guarded
  // reads work, then hydrate and start listening for realtime changes.
  ensureAnonymousSession().then(refresh)
  api.subscribeRealtime(refresh)
}

// ---- selectors -------------------------------------------------------------
export const sel = {
  event: (s, id) => s.events.find((e) => e.id === id),
  client: (s, id) => s.clients.find((c) => c.id === id),
  provider: (s, id) => s.providers.find((p) => p.id === id),
  assessor: (s, id) => s.assessors.find((a) => a.id === id),
  assessment: (s, id) => s.assessments.find((a) => a.id === id),
  assessmentForEvent: (s, eventId) => s.assessments.find((a) => a.eventId === eventId),
  alertsFor: (s, providerId) => s.alertsLog.filter((a) => a.providerId === providerId),
  jobsOpen: (s) => s.sosJobs.filter((j) => j.status !== 'resolved'),
}

// ---- actions ---------------------------------------------------------------

function toast(msg) {
  commit({ ...state, toast: { msg, at: Date.now() } })
}
export function clearToast() {
  if (state.toast) commit({ ...state, toast: null })
}

// Fire the pre-dispatch alerts for a trigger and return the new alert rows.
function fireAlerts(trigger, event) {
  const matches = matchProviders(state.providers, {
    category: trigger.category,
    coord: event.coord,
    guests: event.guests,
  })
  const alerts = buildAlerts(
    {
      kind: trigger.kind,
      likelihood: trigger.likelihood,
      category: trigger.category,
      areaId: event.areaId,
      hoursTo: hoursUntil(event.startsAt, state.now),
      guests: event.guests,
      refId: trigger.refId,
    },
    matches,
    { now: state.now.toISOString() }
  )
  return alerts
}

// Client creates an event (so SOS / assessment have something to attach to).
export function createEvent(data) {
  if (supabaseEnabled) {
    const p = api.createEvent(data).then((id) => { refresh(); return id })
    toast('Event added')
    return p
  }
  const id = newId('e')
  const coord = areaCoord(data.areaId)
  const event = { id, clientId: data.clientId || 'c_wanjiru', coord, ...data }
  commit({ ...state, events: [event, ...state.events] })
  toast('Event added')
  return id
}

// Client (or admin) requests a Site Assessment for an event.
export function requestAssessment({ eventId, concern, requestedBy, turnstileToken }) {
  if (supabaseEnabled) {
    const p = api
      .requestAssessment({ eventId, concern, turnstileToken })
      .then(refresh)
      .catch((e) => toast('Could not submit: ' + e.message))
    toast('Site Assessment requested — dispatching an assessor')
    return p
  }
  const event = sel.event(state, eventId)
  if (!event) return
  const existing = sel.assessmentForEvent(state, eventId)
  if (existing && existing.status !== 'scored') {
    toast('Assessment already in progress')
    return existing.id
  }
  const id = newId('as')
  const record = {
    id,
    eventId,
    requestedBy: requestedBy || event.clientId,
    assessorId: null,
    status: 'requested',
    requestedAt: state.now.toISOString(),
    visitedAt: null,
    concern: concern || '',
    answers: {},
    notes: '',
  }
  commit({ ...state, assessments: [record, ...state.assessments] })
  toast('Site Assessment requested — dispatching an assessor')
  return id
}

// Admin assigns an assessor to a requested assessment.
export function assignAssessor(assessmentId, assessorId) {
  if (supabaseEnabled) {
    api.assignAssessor(assessmentId, assessorId).then(refresh)
    toast('Assessor assigned')
    return
  }
  commit({
    ...state,
    assessments: state.assessments.map((a) =>
      a.id === assessmentId ? { ...a, assessorId, status: 'assigned' } : a
    ),
  })
  toast('Assessor assigned')
}

// Assessor submits the scorecard. This is where the network gets primed.
export function submitScorecard(assessmentId, answers, notes) {
  if (supabaseEnabled) {
    const { band } = scoreAssessment(answers)
    api.submitScorecard(assessmentId, answers, notes).then(refresh)
    toast(
      band === 'red'
        ? 'Scored RED — alerting providers & opening a rescue'
        : band === 'amber'
        ? 'Scored AMBER — putting providers on standby'
        : 'Scored GREEN — no intervention needed'
    )
    return scoreAssessment(answers)
  }
  const assessment = sel.assessment(state, assessmentId)
  if (!assessment) return
  const event = sel.event(state, assessment.eventId)
  const { band, score } = scoreAssessment(answers)
  const likelihood = interventionLikelihood(band)

  let next = {
    ...state,
    assessments: state.assessments.map((a) =>
      a.id === assessmentId
        ? {
            ...a,
            answers,
            notes: notes ?? a.notes,
            status: 'scored',
            visitedAt: a.visitedAt || state.now.toISOString(),
            scoredAt: state.now.toISOString(),
            band,
            score,
          }
        : a
    ),
  }
  commit(next)

  if (band !== 'green') {
    const alerts = fireAlerts(
      { kind: 'assessment', likelihood, category: event.category, refId: assessmentId },
      event
    )
    commit({ ...state, alertsLog: [...alerts, ...state.alertsLog] })

    if (band === 'red' && !state.sosJobs.some((j) => j.eventId === event.id && j.status !== 'resolved')) {
      const job = {
        id: newId('sos'),
        eventId: event.id,
        fromAssessment: assessmentId,
        category: event.category,
        status: 'dispatching',
        raisedAt: state.now.toISOString(),
        note: `Auto-raised from Red scorecard. ${notes || ''}`.trim(),
        acceptedBy: null,
      }
      commit({ ...state, sosJobs: [job, ...state.sosJobs] })
    }
    toast(
      band === 'red'
        ? `Scored RED — ${alerts.length} providers alerted, rescue job opened`
        : `Scored AMBER — ${alerts.length} providers put on standby`
    )
  } else {
    toast('Scored GREEN — no intervention needed')
  }
  return { band, score }
}

// Client raises an SOS directly (provider flopped, no prior assessment).
export function raiseSOS({ eventId, category, note, turnstileToken }) {
  if (supabaseEnabled) {
    const p = api
      .raiseSOS({ eventId, category, note, turnstileToken })
      .then(refresh)
      .catch((e) => toast('Could not submit: ' + e.message))
    toast('SOS raised — alerting nearby providers')
    return p
  }
  const event = sel.event(state, eventId)
  if (!event) return
  const cat = category || event.category
  const job = {
    id: newId('sos'),
    eventId,
    fromAssessment: null,
    category: cat,
    status: 'dispatching',
    raisedAt: state.now.toISOString(),
    note: note || '',
    acceptedBy: null,
  }
  commit({ ...state, sosJobs: [job, ...state.sosJobs] })
  const alerts = fireAlerts(
    { kind: 'sos', likelihood: 'high', category: cat, refId: job.id },
    event
  )
  commit({ ...state, alertsLog: [...alerts, ...state.alertsLog] })
  toast(`SOS raised — ${alerts.length} providers alerted`)
  return job.id
}

// Provider accepts a rescue job.
export function acceptSOS(jobId, providerId) {
  if (supabaseEnabled) {
    api.acceptSOS(jobId, providerId).then(refresh)
    toast('Rescue accepted — client notified')
    return
  }
  commit({
    ...state,
    sosJobs: state.sosJobs.map((j) =>
      j.id === jobId ? { ...j, status: 'accepted', acceptedBy: providerId } : j
    ),
  })
  toast('Rescue accepted — client notified')
}

export function resolveSOS(jobId) {
  if (supabaseEnabled) {
    api.resolveSOS(jobId).then(refresh)
    toast('Job marked resolved')
    return
  }
  commit({
    ...state,
    sosJobs: state.sosJobs.map((j) => (j.id === jobId ? { ...j, status: 'resolved' } : j)),
  })
  toast('Job marked resolved')
}

// Provider toggles readiness.
export function setReadiness(providerId, readiness) {
  if (supabaseEnabled) {
    api.setReadiness(providerId, readiness).then(refresh)
    return
  }
  commit({
    ...state,
    providers: state.providers.map((p) => (p.id === providerId ? { ...p, readiness } : p)),
  })
}

// ---- Gift Shop cart (client-side) -----------------------------------------
export function addToCart(productId) {
  const cart = state.cart || []
  const found = cart.find((c) => c.productId === productId)
  const next = found
    ? cart.map((c) => (c.productId === productId ? { ...c, qty: c.qty + 1 } : c))
    : [...cart, { productId, qty: 1 }]
  commit({ ...state, cart: next })
  toast('Added to your gift order')
}
export function setQty(productId, qty) {
  const cart = (state.cart || []).map((c) => (c.productId === productId ? { ...c, qty } : c)).filter((c) => c.qty > 0)
  commit({ ...state, cart })
}
export function clearCart() {
  commit({ ...state, cart: [] })
}
// Live: persist the order, then charge via the chosen method (M-Pesa STK push,
// or Airtel/card via Flutterwave). Simulated in seed mode.
export function placeGiftOrder(order) {
  const { phone, amount, method = 'mpesa' } = order
  if (supabaseEnabled) {
    api.createGiftOrder(order)
      .then((orderId) => {
        if (method === 'mpesa') return api.mpesaCheckout({ phone, amount, orderId })
        return api.flutterwaveCharge({ phone, amount, orderId, method }).then((r) => {
          if (r?.link) window.location.href = r.link
        })
      })
      .catch((e) => console.error('[shop] checkout failed', e))
  }
  commit({ ...state, cart: [] })
  toast(method === 'mpesa'
    ? `M-Pesa request sent to ${phone || 'your phone'} — enter your PIN`
    : 'Opening secure payment…')
}

// Provider acknowledges an advisory alert.
export function acknowledgeAlert(alertId) {
  if (supabaseEnabled) {
    api.acknowledgeAlert(alertId).then(refresh)
    return
  }
  commit({
    ...state,
    alertsLog: state.alertsLog.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)),
  })
}
