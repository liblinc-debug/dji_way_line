import { ACTION_TYPE, DEFAULT_ACTION_PARAMS } from '../types/waypointRoute.js'
import { validateAIMissionSchema } from '../types/aiMission.js'

const finishActionMap = { RTH: 'goHome', LAND: 'autoLand', HOVER: 'noAction' }

function convertAction(action) {
  const params = action?.params || {}
  switch (action?.type) {
    case 'HOVER': return [{ type: ACTION_TYPE.HOVER, params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.HOVER], hoverTime: Number(params.duration || 10) } }]
    case 'TAKE_PHOTO': return Array.from({ length: Math.max(1, Number(params.count || 1)) }, () => ({ type: ACTION_TYPE.TAKE_PHOTO, params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.TAKE_PHOTO] } }))
    case 'PANORAMA': return [{ type: ACTION_TYPE.PANORAMA, params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.PANORAMA] } }]
    case 'TIMELAPSE': return [{ type: ACTION_TYPE.START_TIMED_PHOTO, params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.START_TIMED_PHOTO], photoInterval: Number(params.interval || 2), photoCount: Number(params.count || 1) } }]
    case 'START_RECORD': return [{ type: ACTION_TYPE.START_RECORD, params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.START_RECORD] } }]
    case 'STOP_RECORD': return [{ type: ACTION_TYPE.STOP_RECORD, params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.STOP_RECORD] } }]
    case 'GIMBAL': return [{ type: ACTION_TYPE.GIMBAL_PITCH, params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.GIMBAL_PITCH], gimbalPitchRotateAngle: Number(params.pitch ?? -45) } }]
    case 'FACE_TARGET': return []
    default: return []
  }
}

function convertPlatformAction(action) {
  const params = action?.params || {}
  switch (action?.type) {
    case ACTION_TYPE.HOVER: return { type: 'HOVER', params: { duration: Number(params.hoverTime || 10) } }
    case ACTION_TYPE.TAKE_PHOTO: return { type: 'TAKE_PHOTO', params: { count: 1 } }
    case ACTION_TYPE.PANORAMA: return { type: 'PANORAMA', params: {} }
    case ACTION_TYPE.START_TIMED_PHOTO: return { type: 'TIMELAPSE', params: { interval: Number(params.photoInterval || 2), count: Number(params.photoCount || 1) } }
    case ACTION_TYPE.START_RECORD: return { type: 'START_RECORD', params: {} }
    case ACTION_TYPE.STOP_RECORD: return { type: 'STOP_RECORD', params: {} }
    case ACTION_TYPE.GIMBAL_PITCH: return { type: 'GIMBAL', params: { pitch: Number(params.gimbalPitchRotateAngle ?? -45) } }
    default: return null
  }
}

export function convertAIPlanToMission(plan, currentMission = {}) {
  const schema = validateAIMissionSchema(plan)
  if (!schema.valid) throw new Error(`AI Mission Schema 校验失败：${schema.errors.join('；')}`)
  const first = plan.waypoints[0]
  const waypoints = plan.waypoints.map((waypoint, index) => {
    const actions = (waypoint.actions || []).flatMap(convertAction)
    if (plan.intent === 'ORBIT' || (waypoint.actions || []).some(action => action.type === 'FACE_TARGET')) {
      actions.unshift({
        type: ACTION_TYPE.AIRCRAFT_YAW,
        params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.AIRCRAFT_YAW], aircraftYawAngle: Math.round(Number(waypoint.yaw || 0)) }
      })
    }
    return {
      lat: Number(waypoint.coordinate.lat),
      lng: Number(waypoint.coordinate.lng),
      height: Number(waypoint.coordinate.alt),
      speed: Number(waypoint.speed),
      terrainHeight: 0,
      isForbiddenRth: false,
      actions,
      aiWaypointId: waypoint.id,
      index
    }
  })
  const config = {
    ...(currentMission.config || {}),
    missionName: plan.missionName,
    coordinateSystem: 'WGS84',
    routeType: 'waypoint',
    globalHeight: Number(first.coordinate.alt),
    globalSpeed: Number(first.speed),
    finishAction: finishActionMap[plan.finish.type] || 'goHome'
  }
  return {
    ...currentMission,
    id: currentMission.id || Date.now(),
    name: plan.missionName,
    config,
    waypoints,
    aiMetadata: { intent: plan.intent, summary: plan.summary, appliedAt: Date.now() },
    updatedAt: Date.now()
  }
}

export function convertMissionToAIContext(mission = {}) {
  return {
    missionId: String(mission.id || ''),
    missionName: mission.name || mission.config?.missionName || '',
    aiSource: Boolean(mission.aiMetadata),
    finish: { type: mission.config?.finishAction === 'autoLand' ? 'LAND' : mission.config?.finishAction === 'noAction' ? 'HOVER' : 'RTH' },
    waypoints: (mission.waypoints || []).map((waypoint, index) => ({
      id: waypoint.aiWaypointId || `wp${index + 1}`,
      sequence: index + 1,
      coordinate: { lat: Number(waypoint.lat), lng: Number(waypoint.lng), alt: Number(waypoint.height ?? waypoint.alt) },
      speed: Number(waypoint.speed || mission.config?.globalSpeed || 5),
      yaw: Number(waypoint.actions?.find(action => action.type === ACTION_TYPE.AIRCRAFT_YAW)?.params?.aircraftYawAngle || 0),
      actions: (waypoint.actions || []).map(convertPlatformAction).filter(Boolean)
    }))
  }
}
