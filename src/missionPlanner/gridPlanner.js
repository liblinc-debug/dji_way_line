export function generateAreaScanWaypoints({ polygon, spacing = 20, altitude = 80, speed = 6 }) {
  if (!Array.isArray(polygon) || polygon.length < 3) return []
  const reference = polygon[0]
  const metersPerLat = 111320
  const metersPerLng = metersPerLat * Math.cos(Number(reference.lat) * Math.PI / 180)
  const local = polygon.map(point => ({
    x: (Number(point.lng) - Number(reference.lng)) * metersPerLng,
    y: (Number(point.lat) - Number(reference.lat)) * metersPerLat
  }))
  const minY = Math.min(...local.map(point => point.y))
  const maxY = Math.max(...local.map(point => point.y))
  const route = []
  let reverse = false
  for (let y = minY; y <= maxY + 0.01; y += Math.max(1, Number(spacing))) {
    const intersections = []
    local.forEach((point, index) => {
      const previous = local[(index + local.length - 1) % local.length]
      if ((previous.y > y) === (point.y > y) || previous.y === point.y) return
      intersections.push(previous.x + (y - previous.y) * (point.x - previous.x) / (point.y - previous.y))
    })
    if (intersections.length < 2) continue
    const row = [Math.min(...intersections), Math.max(...intersections)]
    if (reverse) row.reverse()
    row.forEach(x => route.push({
      id: `wp${route.length + 1}`,
      sequence: route.length + 1,
      coordinate: { lat: Number(reference.lat) + y / metersPerLat, lng: Number(reference.lng) + x / metersPerLng, alt: Number(altitude) },
      speed: Number(speed),
      yaw: 0,
      actions: []
    }))
    reverse = !reverse
  }
  return route
}

