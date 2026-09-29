// Geography helpers for the Nairobi service area.
// Coordinates are approximate area centroids — good enough for distance ranking
// in the prototype. In production these come from a geocoded address on the
// request and the provider's registered base.

export const AREAS = {
  CBD: { name: 'Nairobi CBD', lat: -1.2864, lng: 36.8172 },
  Kilimani: { name: 'Kilimani', lat: -1.2906, lng: 36.7869 },
  Westlands: { name: 'Westlands', lat: -1.2648, lng: 36.8025 },
  Lavington: { name: 'Lavington', lat: -1.2795, lng: 36.7669 },
  Karen: { name: 'Karen', lat: -1.3197, lng: 36.7076 },
  Langata: { name: "Lang'ata", lat: -1.3486, lng: 36.7519 },
  Kasarani: { name: 'Kasarani', lat: -1.2216, lng: 36.8968 },
  Ruaka: { name: 'Ruaka', lat: -1.2043, lng: 36.7853 },
  Rongai: { name: 'Ongata Rongai', lat: -1.3968, lng: 36.7457 },
  Thika: { name: 'Thika Road (Roysambu)', lat: -1.2196, lng: 36.8869 },
  Embakasi: { name: 'Embakasi', lat: -1.3237, lng: 36.8946 },
  Ruiru: { name: 'Ruiru', lat: -1.1452, lng: 36.9585 },
}

export const AREA_LIST = Object.entries(AREAS).map(([id, a]) => ({ id, ...a }))

const R = 6371 // km
const rad = (d) => (d * Math.PI) / 180

// Haversine great-circle distance in kilometres.
export function distanceKm(a, b) {
  if (!a || !b) return Infinity
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function areaCoord(areaId) {
  return AREAS[areaId] || null
}

export function areaName(areaId) {
  return AREAS[areaId]?.name || areaId
}
