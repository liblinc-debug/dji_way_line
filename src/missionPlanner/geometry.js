const EARTH_RADIUS_METERS = 6371008.8

export function distanceMeters(a, b) {
  const toRad = value => value * Math.PI / 180
  const lat1 = toRad(Number(a.lat))
  const lat2 = toRad(Number(b.lat))
  const dLat = toRad(Number(b.lat) - Number(a.lat))
  const dLng = toRad(Number(b.lng) - Number(a.lng))
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function destination(origin, meters, bearingDegrees) {
  const angular = meters / EARTH_RADIUS_METERS
  const bearing = bearingDegrees * Math.PI / 180
  const lat1 = Number(origin.lat) * Math.PI / 180
  const lng1 = Number(origin.lng) * Math.PI / 180
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing))
  const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI, alt: Number(origin.alt || 0) }
}

export function bearingDegrees(a, b) {
  const lat1 = Number(a.lat) * Math.PI / 180
  const lat2 = Number(b.lat) * Math.PI / 180
  const dLng = (Number(b.lng) - Number(a.lng)) * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

