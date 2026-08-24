import { bearingDegrees, destination } from './geometry.js'

export function generateOrbitWaypoints({ center, radius = 50, points = 12, laps = 1, clockwise = true, altitude = 80, speed = 6 }) {
  const pointCount = Math.max(6, Number(points) || 12)
  const lapCount = Math.max(1, Number(laps) || 1)
  const direction = clockwise ? -1 : 1
  return Array.from({ length: pointCount * lapCount + 1 }, (_, index) => {
    const coordinate = destination(center, Number(radius), direction * (index % pointCount) * 360 / pointCount)
    coordinate.alt = Number(altitude)
    return {
      id: `wp${index + 1}`,
      sequence: index + 1,
      coordinate,
      speed: Number(speed),
      yaw: bearingDegrees(coordinate, center),
      actions: []
    }
  })
}

