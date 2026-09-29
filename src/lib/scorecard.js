// The Last Minute Scorecard.
// A Site Assessor visits the venue a few hours before the event, talks to the
// client, the booked provider and (where possible) previous clients, then rates
// a fixed set of criteria. Those ratings roll up into a weighted 0–100 readiness
// score and a Red / Amber / Green band that clients and the admin dashboard read.

// value: 0..3  (0 = critical failure, 3 = fully ready)
// `critical: true` criteria can force a Red band on their own.
export const CRITERIA = [
  {
    id: 'setup',
    label: 'On-site setup progress',
    help: 'Is physical setup where it should be for the time remaining?',
    weight: 3,
    critical: true,
    options: [
      { value: 3, label: 'On track / ahead of schedule' },
      { value: 2, label: 'Slightly behind but recoverable' },
      { value: 1, label: 'Badly behind schedule' },
      { value: 0, label: 'Not started / abandoned' },
    ],
  },
  {
    id: 'presence',
    label: 'Provider presence & responsiveness',
    help: 'Is the provider on site, reachable and engaged?',
    weight: 2,
    critical: true,
    options: [
      { value: 3, label: 'On site and fully engaged' },
      { value: 2, label: 'Reachable, arriving soon' },
      { value: 1, label: 'Hard to reach / evasive' },
      { value: 0, label: 'Gone dark / unreachable' },
    ],
  },
  {
    id: 'capacity',
    label: 'Capacity vs. requirement',
    help: 'Enough staff, equipment and supplies for the guest count?',
    weight: 3,
    critical: true,
    options: [
      { value: 3, label: 'Comfortably sufficient' },
      { value: 2, label: 'Just enough, no margin' },
      { value: 1, label: 'Visibly under-resourced' },
      { value: 0, label: 'Nowhere near sufficient' },
    ],
  },
  {
    id: 'quality',
    label: 'Quality of what is in place',
    help: 'Condition and standard of equipment / food / décor seen.',
    weight: 2,
    options: [
      { value: 3, label: 'High standard' },
      { value: 2, label: 'Acceptable' },
      { value: 1, label: 'Below expectation' },
      { value: 0, label: 'Unusable / unsafe' },
    ],
  },
  {
    id: 'track',
    label: 'Track record & references',
    help: 'What do prior and present-day clients say?',
    weight: 2,
    options: [
      { value: 3, label: 'Strong, verified references' },
      { value: 2, label: 'Mostly positive' },
      { value: 1, label: 'Mixed / worrying signals' },
      { value: 0, label: 'Serious complaints' },
    ],
  },
  {
    id: 'contingency',
    label: 'Backup & contingency',
    help: 'Is there a fallback if something fails (power, staff, transport)?',
    weight: 1,
    options: [
      { value: 3, label: 'Clear backup in place' },
      { value: 2, label: 'Informal / partial backup' },
      { value: 1, label: 'None, but low risk' },
      { value: 0, label: 'None, high exposure' },
    ],
  },
  {
    id: 'comms',
    label: 'Client–provider relationship',
    help: 'Is communication healthy or has trust broken down?',
    weight: 1,
    options: [
      { value: 3, label: 'Aligned and calm' },
      { value: 2, label: 'Tense but workable' },
      { value: 1, label: 'Strained, low trust' },
      { value: 0, label: 'Broken down' },
    ],
  },
]

export const MAX_PER = 3
const TOTAL_WEIGHT = CRITERIA.reduce((s, c) => s + c.weight, 0)

// answers: { [criterionId]: 0..3 }
export function scoreAssessment(answers = {}) {
  let weighted = 0
  const reasons = []
  const flags = []

  for (const c of CRITERIA) {
    const v = answers[c.id]
    if (v == null) continue
    weighted += v * c.weight
    const opt = c.options.find((o) => o.value === v)
    if (v <= 1) {
      const sev = v === 0 ? 'critical' : 'concern'
      reasons.push({ id: c.id, label: c.label, note: opt?.label, severity: sev })
      if (c.critical && v === 0) flags.push(`${c.label}: ${opt?.label}`)
    }
  }

  const answered = CRITERIA.filter((c) => answers[c.id] != null)
  const maxForAnswered = answered.reduce((s, c) => s + c.weight * MAX_PER, 0) || 1
  const score = Math.round((weighted / maxForAnswered) * 100)

  // Any critical criterion at 0 caps the band at Red regardless of the average.
  const hasCriticalZero = CRITERIA.some((c) => c.critical && answers[c.id] === 0)

  let band
  if (hasCriticalZero || score < 50) band = 'red'
  else if (score < 75) band = 'amber'
  else band = 'green'

  return { score, band, reasons, flags, hasCriticalZero, complete: answered.length === CRITERIA.length }
}

export const BAND_META = {
  green: {
    label: 'Green',
    headline: 'On track to deliver',
    blurb: 'The provider is credible and prepared. No intervention needed — we keep watching until doors open.',
  },
  amber: {
    label: 'Amber',
    headline: 'At risk — network on standby',
    blurb: 'Real gaps found. We have warmed up nearby providers so an intervention can move fast if it tips.',
  },
  red: {
    label: 'Red',
    headline: 'Likely to fail — intervene now',
    blurb: 'Critical shortfall. We recommend activating the Last Minute Network immediately to save the event.',
  },
}

// The intervention likelihood a Red/Amber scorecard implies, used to prime the
// pre-dispatch alert copy.
export function interventionLikelihood(band) {
  return band === 'red' ? 'high' : band === 'amber' ? 'possible' : 'low'
}
