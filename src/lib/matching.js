// Provider matching — rank Last Minute Network providers against a specific need
// (category), place (area coordinate) and time window. Used both for live SOS
// jobs and for priming the pre-dispatch alerts when a scorecard turns Amber/Red.

import { distanceKm } from './geo.js'

// weights for the composite match score
const W = { distance: 0.34, rating: 0.24, readiness: 0.24, capacity: 0.18 }

// providers: [{ id, name, categories[], base:{lat,lng}, rating, jobsDone,
//   readiness:'ready'|'busy'|'off', capacity:number, responseMins }]
export function matchProviders(providers, need) {
  const { category, coord, guests = 0 } = need
  const pool = providers.filter(
    (p) => p.categories.includes(category) && p.readiness !== 'off'
  )

  const scored = pool.map((p) => {
    const km = distanceKm(p.base, coord)
    const distScore = Math.max(0, 1 - km / 30) // 0 at ~30km+
    const ratingScore = (p.rating - 3) / 2 // maps 3..5 -> 0..1
    const readyScore = p.readiness === 'ready' ? 1 : 0.45
    const capScore = guests ? Math.min(1, p.capacity / guests) : 0.8

    const score =
      W.distance * distScore +
      W.rating * clamp01(ratingScore) +
      W.readiness * readyScore +
      W.capacity * capScore

    const reasons = []
    if (km <= 6) reasons.push(`${km.toFixed(1)} km away`)
    else reasons.push(`${km.toFixed(0)} km away`)
    if (p.readiness === 'ready') reasons.push('marked ready')
    if (guests && p.capacity >= guests) reasons.push(`covers ${guests} guests`)
    else if (guests) reasons.push(`caps at ${p.capacity}`)
    reasons.push(`~${p.responseMins}m response`)

    return { provider: p, km, score: Math.round(score * 100), reasons }
  })

  return scored.sort((a, b) => b.score - a.score)
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}
