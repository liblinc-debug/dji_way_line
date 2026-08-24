import { generateAreaScanWaypoints } from './gridPlanner.js'
import { generateOrbitWaypoints } from './orbitPlanner.js'

export function generateRoute(intent) {
  if (intent?.flightMode === 'ORBIT') return generateOrbitWaypoints(intent)
  if (intent?.flightMode === 'AREA_SCAN') return generateAreaScanWaypoints(intent)
  return (intent?.coordinates || []).map((coordinate, index) => ({
    id: `wp${index + 1}`,
    sequence: index + 1,
    coordinate: { ...coordinate, alt: Number(coordinate.alt ?? intent.altitude) },
    speed: Number(intent.speed),
    yaw: 0,
    actions: []
  }))
}

