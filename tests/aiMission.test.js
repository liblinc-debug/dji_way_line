import assert from 'node:assert/strict'
import test from 'node:test'
import { convertAIPlanToMission } from '../src/missionPlanner/adapter.js'
import { distanceMeters } from '../src/missionPlanner/geometry.js'
import { generateAreaScanWaypoints } from '../src/missionPlanner/gridPlanner.js'
import { generateOrbitWaypoints } from '../src/missionPlanner/orbitPlanner.js'
import { validateMission } from '../src/missionPlanner/validator.js'
import { validateAIMissionSchema } from '../src/types/aiMission.js'

const plan = {
  missionName: '通信塔巡检',
  summary: '环绕并拍照',
  intent: 'ORBIT',
  start: { type: 'CURRENT_DRONE' },
  finish: { type: 'RTH' },
  warnings: [],
  waypoints: [
    { id: 'wp1', sequence: 1, coordinate: { lat: 31, lng: 121, alt: 80 }, speed: 5, yaw: 90, actions: [{ type: 'TAKE_PHOTO', params: { count: 5 } }] }
  ]
}

test('AI Mission schema and adapter preserve platform mission format', () => {
  assert.equal(validateAIMissionSchema(plan).valid, true)
  const mission = convertAIPlanToMission(plan, { id: 'M1', config: {} })
  assert.equal(mission.config.finishAction, 'goHome')
  assert.equal(mission.config.coordinateSystem, 'WGS84')
  assert.equal(mission.waypoints[0].height, 80)
  assert.equal(mission.waypoints[0].actions.filter(action => action.type === 'takePhoto').length, 5)
})

test('panorama action maps to the existing platform panorama action', () => {
  const panoramaPlan = structuredClone(plan)
  panoramaPlan.waypoints[0].actions = [{ type: 'PANORAMA', params: {} }]
  assert.equal(validateAIMissionSchema(panoramaPlan).valid, true)
  const mission = convertAIPlanToMission(panoramaPlan, { id: 'M2', config: {} })
  assert.ok(mission.waypoints[0].actions.some(action => action.type === 'panorama'))
})

test('orbit planner computes points at the requested radius', () => {
  const center = { lat: 31, lng: 121 }
  const waypoints = generateOrbitWaypoints({ center, radius: 50, points: 12, altitude: 80, speed: 5 })
  assert.equal(waypoints.length, 13)
  waypoints.forEach(waypoint => assert.ok(Math.abs(distanceMeters(center, waypoint.coordinate) - 50) < 0.2))
})

test('grid planner produces an alternating lawn-mower route', () => {
  const polygon = [{ lat: 31, lng: 121 }, { lat: 31, lng: 121.001 }, { lat: 31.001, lng: 121.001 }, { lat: 31.001, lng: 121 }]
  const waypoints = generateAreaScanWaypoints({ polygon, spacing: 20, altitude: 60, speed: 4 })
  assert.ok(waypoints.length >= 4)
  assert.equal(waypoints.length % 2, 0)
})

test('validator rejects invalid coordinate, altitude, speed, and empty waypoints', () => {
  const unsafe = structuredClone(plan)
  unsafe.waypoints[0].coordinate.lat = 100
  unsafe.waypoints[0].coordinate.alt = 500
  unsafe.waypoints[0].speed = 20
  const result = validateMission(unsafe)
  assert.equal(result.valid, false)
  assert.ok(result.warnings.some(item => item.code === 'INVALID_COORDINATE'))
  assert.ok(result.warnings.some(item => item.code === 'INVALID_ALTITUDE'))
  assert.ok(result.warnings.some(item => item.code === 'INVALID_SPEED'))
  assert.equal(validateMission({ ...plan, waypoints: [] }).valid, false)
})
