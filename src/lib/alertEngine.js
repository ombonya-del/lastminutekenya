// The pre-dispatch alert engine (simulated).
//
// The heart of LastMinuteKenya: when a Site Assessment turns Amber or Red — or a
// client raises an SOS — we don't wait for the rescue call. We warm up the
// nearest capable providers with an advisory alert that says WHERE, WHAT is
// likely needed and HOW LONG until the event, so the network is already moving
// before the client ever calls.
//
// In production each alert is a row that a Supabase Edge Function turns into a
// real SMS (Africa's Talking), WhatsApp (Cloud API) or email send. Here we just
// build the alert objects and mark them "sent" so the whole loop is visible.

import { catLabel } from './format.js'
import { areaName } from './geo.js'

let seq = 1
const nextId = () => `alert_${seq++}`

const CHANNEL_ORDER = ['whatsapp', 'sms', 'email']

function pickChannel(provider) {
  const pref = provider.preferredChannel
  if (pref && provider.channels?.[pref]) return pref
  return CHANNEL_ORDER.find((c) => provider.channels?.[c]) || 'sms'
}

// Build the advisory copy. Deliberately withholds the client's identity — only
// area, need and timing go out until a provider engages.
function composeMessage({ likelihood, category, areaLabel, hoursTo, guests }) {
  const window =
    hoursTo == null
      ? 'today'
      : hoursTo < 1
      ? `in under an hour`
      : `in ~${Math.round(hoursTo)}h`
  const head =
    likelihood === 'high'
      ? '🔴 LastMinute intelligence'
      : likelihood === 'possible'
      ? '🟠 LastMinute heads-up'
      : '🟢 LastMinute notice'
  const need = catLabel(category)
  return (
    `${head}: possible ${need} intervention near ${areaLabel} ${window}` +
    (guests ? ` (~${guests} guests)` : '') +
    `. Confirm readiness in the app — a rescue call may follow. Do not travel yet.`
  )
}

// trigger: { kind:'assessment'|'sos', likelihood, category, coord, areaId,
//            hoursTo, guests, refId }
// matches: output of matchProviders (already ranked)
export function buildAlerts(trigger, matches, opts = {}) {
  const topN = opts.topN ?? 4
  const areaLabel = areaName(trigger.areaId)
  const now = opts.now ? new Date(opts.now) : new Date()

  return matches.slice(0, topN).map((m) => {
    const channel = pickChannel(m.provider)
    return {
      id: nextId(),
      providerId: m.provider.id,
      providerName: m.provider.name,
      channel,
      kind: trigger.kind,
      likelihood: trigger.likelihood,
      category: trigger.category,
      areaId: trigger.areaId,
      refId: trigger.refId || null,
      km: m.km,
      matchScore: m.score,
      message: composeMessage({
        likelihood: trigger.likelihood,
        category: trigger.category,
        areaLabel,
        hoursTo: trigger.hoursTo,
        guests: trigger.guests,
      }),
      status: 'sent', // simulated delivery
      sentAt: now.toISOString(),
      acknowledged: false,
    }
  })
}

export const CHANNEL_META = {
  whatsapp: { label: 'WhatsApp', icon: '🟢' },
  sms: { label: 'SMS', icon: '✉️' },
  email: { label: 'Email', icon: '📧' },
}
