import { validateAIMissionSchema } from '../types/aiMission.js'
import { distanceMeters } from './geometry.js'

export function validateMission(plan, limits = {}) {
  const resolved = { minAltitude: 10, maxAltitude: 120, minSpeed: 0.5, maxSpeed: 15, maxDistance: 20000, ...limits }
  const schema = validateAIMissionSchema(plan)
  const warnings = schema.errors.map(message => ({ code: 'SCHEMA_ERROR', level: 'ERROR', message }))
  let distance = 0
  ;(plan?.waypoints || []).forEach((waypoint, index, waypoints) => {
    const { lat, lng, alt } = waypoint.coordinate || {}
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) warnings.push({ code: 'INVALID_COORDINATE', level: 'ERROR', message: `航点 ${index + 1} 坐标无效` })
    if (alt < resolved.minAltitude || alt > resolved.maxAltitude) warnings.push({ code: 'INVALID_ALTITUDE', level: 'ERROR', message: `航点 ${index + 1} 高度超限` })
    if (waypoint.speed < resolved.minSpeed || waypoint.speed > resolved.maxSpeed) warnings.push({ code: 'INVALID_SPEED', level: 'ERROR', message: `航点 ${index + 1} 速度超限` })
    if (index > 0) distance += distanceMeters(waypoints[index - 1].coordinate, waypoint.coordinate)
  })
  if (distance > resolved.maxDistance) warnings.push({ code: 'MISSION_TOO_LONG', level: 'ERROR', message: '任务总距离超过限制' })
  return { valid: !warnings.some(item => item.level === 'ERROR'), warnings, metrics: { distanceMeters: distance, waypointCount: plan?.waypoints?.length || 0 } }
}

