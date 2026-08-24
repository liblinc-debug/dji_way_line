export const AI_MISSION_STATUS = Object.freeze({
  READY: 'READY',
  NEED_CONFIRM: 'NEED_CONFIRM',
  REJECTED: 'REJECTED'
})

export const AI_ACTION_TYPE = Object.freeze({
  HOVER: 'HOVER',
  TAKE_PHOTO: 'TAKE_PHOTO',
  PANORAMA: 'PANORAMA',
  TIMELAPSE: 'TIMELAPSE',
  START_RECORD: 'START_RECORD',
  STOP_RECORD: 'STOP_RECORD',
  GIMBAL: 'GIMBAL',
  FACE_TARGET: 'FACE_TARGET'
})

export function validateAIMissionSchema(plan) {
  const errors = []
  const intents = new Set(['POINT_TO_POINT', 'MULTI_POINT', 'ORBIT', 'AREA_SCAN', 'LINE_INSPECTION'])
  const finishes = new Set(['RTH', 'LAND', 'HOVER'])
  const actions = new Set(Object.values(AI_ACTION_TYPE))
  if (!plan || typeof plan !== 'object') return { valid: false, errors: ['mission must be an object'] }
  if (!String(plan.missionName || '').trim()) errors.push('missionName is required')
  if (!intents.has(plan.intent)) errors.push('intent is invalid')
  if (!finishes.has(plan.finish?.type)) errors.push('finish.type is invalid')
  if (!Array.isArray(plan.waypoints) || plan.waypoints.length === 0) {
    errors.push('waypoints cannot be empty')
  } else {
    plan.waypoints.forEach((waypoint, index) => {
      const coordinate = waypoint?.coordinate
      if (!waypoint?.id) errors.push(`waypoints[${index}].id is required`)
      if (!Number.isFinite(Number(coordinate?.lat)) || !Number.isFinite(Number(coordinate?.lng))) {
        errors.push(`waypoints[${index}].coordinate is invalid`)
      }
      if (!Number.isFinite(Number(coordinate?.alt))) errors.push(`waypoints[${index}].coordinate.alt is invalid`)
      if (!Number.isFinite(Number(waypoint?.speed))) errors.push(`waypoints[${index}].speed is invalid`)
      if (!Array.isArray(waypoint?.actions)) errors.push(`waypoints[${index}].actions must be an array`)
      else waypoint.actions.forEach((action, actionIndex) => {
        if (!actions.has(action?.type)) errors.push(`waypoints[${index}].actions[${actionIndex}].type is invalid`)
      })
    })
  }
  return { valid: errors.length === 0, errors }
}
