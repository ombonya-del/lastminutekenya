// Small formatting helpers.

export const CATEGORIES = {
  catering: { label: 'Catering', icon: '🍲' },
  tents: { label: 'Tents & Seating', icon: '⛺' },
  decor: { label: 'Décor & Styling', icon: '🎀' },
  sound: { label: 'PA & Sound', icon: '🔊' },
  mc: { label: 'MC & Entertainment', icon: '🎤' },
  photo: { label: 'Photo & Video', icon: '📸' },
  cake: { label: 'Cake & Confection', icon: '🎂' },
  transport: { label: 'Transport & Logistics', icon: '🚐' },
  power: { label: 'Power & Generators', icon: '🔌' },
  security: { label: 'Security & Ushering', icon: '🛡️' },
}

export const EVENT_TYPES = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  engagement: 'Engagement',
  fundraiser: 'Harambee / Fundraiser',
  gala: 'Donor / Gala Dinner',
  corporate: 'Corporate Event',
  funeral: 'Funeral / Memorial',
}

export const catLabel = (c) => CATEGORIES[c]?.label || c
export const catIcon = (c) => CATEGORIES[c]?.icon || '•'
export const eventLabel = (e) => EVENT_TYPES[e] || e

export function kes(n) {
  if (n == null) return '—'
  return 'KES ' + Number(n).toLocaleString('en-KE')
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

// A deterministic pleasant avatar colour from a string.
export function hueFor(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360
  return `hsl(${h} 42% 42%)`
}

// Hours-until helper against the app clock (see store NOW).
export function hoursUntil(iso, now) {
  const ms = new Date(iso).getTime() - now.getTime()
  return ms / 3_600_000
}

export function untilLabel(iso, now) {
  const h = hoursUntil(iso, now)
  if (h < 0) return 'in progress / passed'
  if (h < 1) return `${Math.round(h * 60)} min to go`
  if (h < 24) {
    const hh = Math.floor(h)
    const mm = Math.round((h - hh) * 60)
    return mm ? `${hh}h ${mm}m to go` : `${hh}h to go`
  }
  return `${Math.round(h / 24)}d to go`
}

export function timeAgo(iso, now) {
  const m = (now.getTime() - new Date(iso).getTime()) / 60000
  if (m < 1) return 'just now'
  if (m < 60) return `${Math.round(m)}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

export function clockKE(iso) {
  return new Date(iso).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function dayKE(iso) {
  return new Date(iso).toLocaleDateString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
