import JSZip from 'jszip';
import { gcj02ToWgs84 } from './coordTransform.js';

// Simple UUID v4 generator for browser
const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const formatWpmlNumber = (value, digits = 12) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return numericValue.toFixed(digits).replace(/\.?0+$/, '');
};

const calculateSegmentDistance = (p1, p2) => {
  if (!p1 || !p2) return 0;

  const R = 6371000;
  const lat1 = p1.lat * Math.PI / 180;
  const lat2 = p2.lat * Math.PI / 180;
  const deltaLat = (p2.lat - p1.lat) * Math.PI / 180;
  const deltaLng = (p2.lng - p1.lng) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Calculate total path distance in meters
const calculatePathDistance = (waypoints) => {
  if (waypoints.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDistance += calculateSegmentDistance(waypoints[i], waypoints[i + 1]);
  }

  return totalDistance;
};

// Calculate estimated flight duration in seconds
const calculatePathDuration = (waypoints, speed) => {
  const distance = calculatePathDistance(waypoints);
  if (distance === 0 || speed === 0) return 0;
  return distance / speed;
};

const getMissionNumericValue = (value, fallback) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const resolveObstacleAvoidanceMode = (missionConfig = {}) => (missionConfig.useObstacleAvoidance === false ? 0 : 1);

const resolveFlyToWaylineMode = (missionConfig = {}) => {
  if (missionConfig?.climbMode === 'oblique') return 'pointToPoint';
  if (missionConfig?.climbMode === 'vertical') return 'safely';
  if (missionConfig?.flyToWaylineMode === 'pointToPoint') return 'pointToPoint';
  return 'safely';
};

const resolveTransitionalSpeed = (missionConfig = {}, fallback = 5) => {
  const globalSpeed = Number(missionConfig.globalTransitionalSpeed);
  if (Number.isFinite(globalSpeed) && globalSpeed > 0) return globalSpeed;

  const takeoffSpeed = Number(missionConfig.takeoffSpeed);
  if (Number.isFinite(takeoffSpeed) && takeoffSpeed > 0) return takeoffSpeed;

  return fallback;
};

const resolveExecuteHeightMode = (executeHeightMode) => {
  if (executeHeightMode === 'WGS84') return 'EGM96';
  if (executeHeightMode === 'realTimeFollowSurface') return 'realTimeFollowSurface';
  return 'relativeToStartPoint';
};

const resolveMissionAuthor = (missionConfig) => {
  const author = missionConfig?.author || missionConfig?.creator || missionConfig?.operator;
  return String(author || 'way_line');
};

const getTakeOffRefPointXml = (missionConfig, waypoints, options = {}) => {
  const { allowWaypointFallback = true } = options;

  let refLat = getMissionNumericValue(missionConfig.takeOffPointLat, 0);
  let refLng = getMissionNumericValue(missionConfig.takeOffPointLng, 0);
  let refHeight = getMissionNumericValue(missionConfig.takeOffPointHeight, 0);

  // 巡逻/测绘模板对 takeOffRefPoint 更敏感，仅在用户显式设置时输出。
  if (allowWaypointFallback && refLat === 0 && refLng === 0 && waypoints && waypoints.length > 0) {
    refLat = waypoints[0].lat;
    refLng = waypoints[0].lng;
    refHeight = getMissionNumericValue(waypoints[0].terrainHeight, 0);
  }

  if (refLat === 0 && refLng === 0) return '';

  const wgs84 = gcj02ToWgs84(refLng, refLat);
  // DJI template files use `lat,lng,height` order here.
  return `
      <wpml:takeOffRefPoint>${wgs84.lat},${wgs84.lng},${refHeight}</wpml:takeOffRefPoint>
      <wpml:takeOffRefPointAGLHeight>0</wpml:takeOffRefPointAGLHeight>`;
};

const normalizeLensIndex = (lensValue, fallback = 'visable') => {
  const rawValues = Array.isArray(lensValue)
    ? lensValue
    : String(lensValue || fallback).split(',');

  const normalized = rawValues
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .map(value => value.replace(/visible/g, 'visable'));

  return normalized.length > 0 ? Array.from(new Set(normalized)).join(',') : fallback;
};

const getPatrolDirection = (missionConfig) => {
  const direction = Number(missionConfig?.aiPatrol?.direction);
  if (Number.isFinite(direction)) return direction;

  const fallback = Number(missionConfig?.scanSetting?.angle);
  return Number.isFinite(fallback) ? fallback : 0;
};

const getPatrolMargin = (missionConfig) => {
  const margin = Number(missionConfig?.aiPatrol?.margin);
  if (Number.isFinite(margin)) return margin;

  const fallback = Number(missionConfig?.scanSetting?.margin);
  return Number.isFinite(fallback) ? fallback : 0;
};

const getPatrolGimbalPitchAngle = (missionConfig) => {
  const pitchAngle = Number(missionConfig?.aiPatrol?.gimbalPitchAngle);
  return Number.isFinite(pitchAngle) ? pitchAngle : -45;
};

const getPatrolTargetLensIndex = (missionConfig) => {
  const normalizedPhotoType = normalizeLensIndex(missionConfig?.photoType, '');
  if (normalizedPhotoType) {
    return normalizedPhotoType;
  }

  const cameraMode = missionConfig?.aiPatrol?.cameraMode || missionConfig?.scanSetting?.cameraMode;
  return cameraMode === 'infrared' ? 'ir' : 'visable';
};

const getPatrolRecordLensIndex = (targetLensIndex) => {
  const lensList = targetLensIndex.split(',').map(item => item.trim()).filter(Boolean);
  if (lensList.includes('visable')) {
    return 'visable';
  }
  return lensList[0] || 'visable';
};

const isPatrolAiEnabled = (missionConfig) => {
  if (typeof missionConfig?.scanSetting?.aiEnabled === 'boolean') {
    return missionConfig.scanSetting.aiEnabled;
  }

  if (typeof missionConfig?.aiPatrol?.enabled === 'boolean') {
    return missionConfig.aiPatrol.enabled;
  }

  return false;
};

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const createDefaultPatrolRule = () => ({
  operator: '>',
  value: 1
});

const getPatrolAiConfig = (missionConfig) => {
  const aiPatrol = missionConfig?.aiPatrol || {};
  const scanSetting = missionConfig?.scanSetting || {};

  return {
    enabled: isPatrolAiEnabled(missionConfig),
    confidence: Math.max(1, Math.min(100, getMissionNumericValue(aiPatrol.confidence ?? scanSetting.confidence, 80))),
    cameraMode: aiPatrol.cameraMode || scanSetting.cameraMode || 'visible',
    recordEnable: aiPatrol.recordEnable !== false,
    customTitle: String(aiPatrol.customTitle || missionConfig?.missionName || 'New Patrol Mission'),
    customText: String(aiPatrol.customText || '检测到异常目标'),
    useThirdModel: aiPatrol.useThirdModel ? 1 : 0,
    algorithmType: String(aiPatrol.algorithmType || 'visable_ai'),
    targets: {
      people: aiPatrol.targets?.people !== false,
      vehicle: !!aiPatrol.targets?.vehicle,
      boat: !!aiPatrol.targets?.boat
    },
    targetRules: {
      people: {
        ...createDefaultPatrolRule(),
        ...(aiPatrol.targetRules?.people || {})
      },
      vehicle: {
        ...createDefaultPatrolRule(),
        ...(aiPatrol.targetRules?.vehicle || {})
      },
      boat: {
        ...createDefaultPatrolRule(),
        ...(aiPatrol.targetRules?.boat || {})
      }
    },
    alarmActions: {
      snapshot: aiPatrol.alarmActions?.snapshot !== false,
      record: aiPatrol.alarmActions?.record !== false,
      waitControl: !!aiPatrol.alarmActions?.waitControl,
      speaker: !!aiPatrol.alarmActions?.speaker,
      searchlight: !!aiPatrol.alarmActions?.searchlight
    }
  };
};

const getClosedPatrolPolygonCoordinates = (points) => {
  const validPoints = (points || []).filter(point => point && typeof point.lng === 'number' && typeof point.lat === 'number');
  if (validPoints.length < 3) return [];

  const coordinates = validPoints.map(point => {
    const wgs84 = gcj02ToWgs84(point.lng, point.lat);
    return [wgs84.lng, wgs84.lat];
  });

  const [firstLng, firstLat] = coordinates[0];
  const [lastLng, lastLat] = coordinates[coordinates.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) {
    coordinates.push([firstLng, firstLat]);
  }

  return coordinates;
};

const buildPatrolAreaJson = (polygonPoints, actionUUID) => {
  const coordinates = getClosedPatrolPolygonCoordinates(polygonPoints);
  if (coordinates.length < 4) return null;

  return JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        id: actionUUID,
        type: 'Feature',
        geofence_type: 'target_detection',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        }
      }
    ]
  });
};

const buildPatrolContext = (missionConfig, boundaryPoints, waypoints) => {
  const polygonPoints = (boundaryPoints && boundaryPoints.length >= 3) ? boundaryPoints : waypoints;
  const targetLensIndex = getPatrolTargetLensIndex(missionConfig);
  const actionUUID = uuidv4();

  return {
    actionUUID,
    areaResourceName: `tardetec_${uuidv4().replace(/-/g, '').slice(0, 16)}.json`,
    polygonPoints,
    direction: getPatrolDirection(missionConfig),
    margin: getPatrolMargin(missionConfig),
    gimbalPitchAngle: getPatrolGimbalPitchAngle(missionConfig),
    targetLensIndex,
    recordLensIndex: getPatrolRecordLensIndex(targetLensIndex),
    flightHeight: missionConfig.flightHeight || missionConfig.globalHeight || 70
  };
};

const getWaypointTurnDampingDistance = (waypoints, index, shouldStop) => {
  if (shouldStop || index <= 0 || index >= waypoints.length - 1) {
    return '0';
  }

  const previousDistance = calculateSegmentDistance(waypoints[index - 1], waypoints[index]);
  const nextDistance = calculateSegmentDistance(waypoints[index], waypoints[index + 1]);
  const shortestSegment = Math.min(previousDistance, nextDistance);

  if (!Number.isFinite(shortestSegment) || shortestSegment <= 0) {
    return '0';
  }

  return formatWpmlNumber(Math.min(10, shortestSegment / 3));
};

const generatePatrolGimbalRotateActionXml = (actionId, gimbalPitchAngle, enableYawFollow) => `
          <wpml:action>
            <wpml:actionId>${actionId}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>${gimbalPitchAngle}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>${enableYawFollow ? 1 : 0}</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
              <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
              <wpml:gimbalRotateTime>10</wpml:gimbalRotateTime>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;

const generatePatrolStartRecordActionXml = (actionId, recordLensIndex) => `
          <wpml:action>
            <wpml:actionId>${actionId}</wpml:actionId>
            <wpml:actionActuatorFunc>startRecord</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
              <wpml:useGlobalPayloadLensIndex>1</wpml:useGlobalPayloadLensIndex>
              <wpml:payloadLensIndex>${recordLensIndex}</wpml:payloadLensIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;

const generateTargetDetectionActionXml = (missionConfig, patrolContext, actionId) => {
  const patrolAiConfig = getPatrolAiConfig(missionConfig);

  return `
          <wpml:action>
            <wpml:actionId>${actionId}</wpml:actionId>
            <wpml:actionActuatorFunc>targetDetection</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>
              <wpml:payloadLensIndex>${patrolContext.targetLensIndex}</wpml:payloadLensIndex>
              <wpml:actionUUID>${patrolContext.actionUUID}</wpml:actionUUID>
              <wpml:irGainMode/>
              <wpml:irColorPalette>WHITEHOT</wpml:irColorPalette>
              <wpml:customTitle>${escapeXml(patrolAiConfig.customTitle)}</wpml:customTitle>
              <wpml:customText>${escapeXml(patrolAiConfig.customText)}</wpml:customText>
              <wpml:modelIndex>0</wpml:modelIndex>
              <wpml:modelScore>${patrolAiConfig.confidence}</wpml:modelScore>
              <wpml:alarmInterval>2</wpml:alarmInterval>
              <wpml:useThirdModel>${patrolAiConfig.useThirdModel}</wpml:useThirdModel>
              <wpml:algorithmType>${escapeXml(patrolAiConfig.algorithmType)}</wpml:algorithmType>
              ${generateAlarmActionsXml(missionConfig)}
              ${generateTargetParamsXml(missionConfig)}
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
};

const generateTemplateKml = (missionConfig, waypoints, boundaryPoints = null, patrolContext = null, generatedAt = Date.now()) => {
  // Use routeType instead of aiPatrol.enabled to determine patrol mode
  const isPatrol = missionConfig.routeType === 'patrol' ;
  const templateType = isPatrol ? 'targetdetection' : 'waypoint';

  const currentPatrolContext = isPatrol ? (patrolContext || buildPatrolContext(missionConfig, boundaryPoints, waypoints)) : null;
  const patrolAiEnabled = isPatrol && isPatrolAiEnabled(missionConfig);
  const patrolAiConfig = isPatrol ? getPatrolAiConfig(missionConfig) : null;
  const pointsForPolygon = currentPatrolContext?.polygonPoints || boundaryPoints || waypoints;
  let globalActionGroupId = 0;

  let polygonCoords = '';
  const filteredPoints = pointsForPolygon.filter(p => p && typeof p.lng === 'number' && typeof p.lat === 'number');
  if (filteredPoints.length >= 3) {
    // KML Polygon rings must be closed (first point == last point)
    const first = filteredPoints[0];
    const last = filteredPoints[filteredPoints.length - 1];
    const isClosed = first.lng === last.lng && first.lat === last.lat;

    const pointsToRender = isClosed ? filteredPoints : [...filteredPoints, first];
    polygonCoords = pointsToRender
      .map(p => {
        const wgs84 = gcj02ToWgs84(p.lng, p.lat);
        return `${wgs84.lng},${wgs84.lat},0`;
      })
      .join('\n                ');
  } else {
    // Default small box around the first point or a fixed location
    const baseLat = waypoints.length > 0 ? waypoints[0].lat : 31.0909;
    const baseLng = waypoints.length > 0 ? waypoints[0].lng : 104.3903;
    const baseWgs84 = gcj02ToWgs84(baseLng, baseLat);
    polygonCoords = `
                ${baseWgs84.lng - 0.001},${baseWgs84.lat - 0.001},0
                ${baseWgs84.lng + 0.001},${baseWgs84.lat - 0.001},0
                ${baseWgs84.lng + 0.001},${baseWgs84.lat + 0.001},0
                ${baseWgs84.lng - 0.001},${baseWgs84.lat + 0.001},0
                ${baseWgs84.lng - 0.001},${baseWgs84.lat - 0.001},0
    `.trim();
  }
  const executeHeightMode = resolveExecuteHeightMode(missionConfig.executeHeightMode);
  const takeOffRefPointXml = getTakeOffRefPointXml(missionConfig, waypoints, { allowWaypointFallback: !isPatrol });
  const takeOffSecurityHeight = getMissionNumericValue(missionConfig.takeOffSecurityHeight, 20);
  const globalTransitionalSpeed = resolveTransitionalSpeed(missionConfig, 5);
  const globalRTHHeight = getMissionNumericValue(missionConfig.globalRTHHeight, 100);
  const droneEnumValue = getMissionNumericValue(missionConfig.droneEnumValue, 99);
  const droneSubEnumValue = getMissionNumericValue(missionConfig.droneSubEnumValue, 1);
  const payloadEnumValue = getMissionNumericValue(missionConfig.payloadEnumValue, 89);
  const payloadSubEnumValue = getMissionNumericValue(missionConfig.payloadSubEnumValue, 0);
  const payloadPositionIndex = getMissionNumericValue(missionConfig.payloadPositionIndex, 0);
  const flyToWaylineMode = resolveFlyToWaylineMode(missionConfig);
  const obstacleAvoidanceMode = resolveObstacleAvoidanceMode(missionConfig);

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:author>${resolveMissionAuthor(missionConfig)}</wpml:author>
    <wpml:createTime>${generatedAt}</wpml:createTime>
    <wpml:updateTime>${generatedAt}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>${flyToWaylineMode}</wpml:flyToWaylineMode>
      <wpml:finishAction>${missionConfig.finishAction || 'goHome'}</wpml:finishAction>
      <wpml:exitOnRCLost>${missionConfig.exitOnRCLost || 'goContinue'}</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>${missionConfig.executeRCLostAction || 'goBack'}</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>${takeOffSecurityHeight}</wpml:takeOffSecurityHeight>${takeOffRefPointXml}
      <wpml:globalTransitionalSpeed>${globalTransitionalSpeed}</wpml:globalTransitionalSpeed>
      <wpml:globalRTHHeight>${globalRTHHeight}</wpml:globalRTHHeight>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>${droneSubEnumValue}</wpml:droneSubEnumValue>
      </wpml:droneInfo>
      <wpml:autoRerouteInfo>
        <wpml:transitionalAutoRerouteMode>${obstacleAvoidanceMode}</wpml:transitionalAutoRerouteMode>
        <wpml:missionAutoRerouteMode>${obstacleAvoidanceMode}</wpml:missionAutoRerouteMode>
      </wpml:autoRerouteInfo>
      <wpml:waylineAvoidLimitAreaMode>${obstacleAvoidanceMode}</wpml:waylineAvoidLimitAreaMode>
      <wpml:payloadInfo>
        <wpml:payloadEnumValue>${payloadEnumValue}</wpml:payloadEnumValue>
        <wpml:payloadSubEnumValue>${payloadSubEnumValue}</wpml:payloadSubEnumValue>
        <wpml:payloadPositionIndex>${payloadPositionIndex}</wpml:payloadPositionIndex>
      </wpml:payloadInfo>
      ${!isPatrol ? `<wpml:isClosedLoop>${missionConfig.isClosedLoop ? 1 : 0}</wpml:isClosedLoop>` : ''}
    </wpml:missionConfig>
    <Folder>
      <wpml:templateType>${templateType}</wpml:templateType>
      <wpml:templateId>0</wpml:templateId>
      <wpml:waylineCoordinateSysParam>
        <wpml:coordinateMode>WGS84</wpml:coordinateMode>
        <wpml:heightMode>${executeHeightMode}</wpml:heightMode>
        ${(missionConfig.executeHeightMode === 'realTimeFollowSurface') ? `
        <wpml:globalShootHeight>${missionConfig.globalHeight || 70}</wpml:globalShootHeight>
        <wpml:surfaceFollowModeEnable>1</wpml:surfaceFollowModeEnable>
        <wpml:isRealtimeSurfaceFollow>1</wpml:isRealtimeSurfaceFollow>
        <wpml:surfaceRelativeHeight>${missionConfig.globalHeight || 70}</wpml:surfaceRelativeHeight>` : ''}
      </wpml:waylineCoordinateSysParam>
      <wpml:autoFlightSpeed>${globalTransitionalSpeed}</wpml:autoFlightSpeed>
      ${!isPatrol ? `
      <wpml:globalHeight>${missionConfig.globalHeight || 70}</wpml:globalHeight>
      <wpml:caliFlightEnable>${missionConfig.caliFlightEnable ? 1 : 0}</wpml:caliFlightEnable>
      <wpml:gimbalPitchMode>${missionConfig.gimbalPitchMode || 'manual'}</wpml:gimbalPitchMode>
      <wpml:globalWaypointHeadingParam>
        <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
        <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
        <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
        <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
        <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
      </wpml:globalWaypointHeadingParam>
      <wpml:globalWaypointTurnMode>toPointAndStopWithDiscontinuityCurvature</wpml:globalWaypointTurnMode>
      <wpml:globalUseStraightLine>1</wpml:globalUseStraightLine>` : ''}
      ${isPatrol ? `
      <Placemark>
        <wpml:direction>${currentPatrolContext.direction}</wpml:direction>
        <wpml:margin>${currentPatrolContext.margin}</wpml:margin>
        <wpml:gimbalPitchMode>fixed</wpml:gimbalPitchMode>
        <wpml:overlap>
          <wpml:orthoCameraOverlapH>1</wpml:orthoCameraOverlapH>
          <wpml:orthoCameraOverlapW>75</wpml:orthoCameraOverlapW>
        </wpml:overlap>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>
                ${polygonCoords}
              </coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
        <wpml:ellipsoidHeight>${formatWpmlNumber(currentPatrolContext.flightHeight, 1)}</wpml:ellipsoidHeight>
        <wpml:height>${formatWpmlNumber(currentPatrolContext.flightHeight, 1)}</wpml:height>
        <wpml:mappingHeadingParam>
          <wpml:mappingHeadingMode>fixed</wpml:mappingHeadingMode>
          <wpml:mappingHeadingAngle>${currentPatrolContext.direction}</wpml:mappingHeadingAngle>
        </wpml:mappingHeadingParam>
        <wpml:gimbalPitchAngle>${currentPatrolContext.gimbalPitchAngle}</wpml:gimbalPitchAngle>
        <wpml:recordEnable>${patrolAiConfig?.recordEnable ? 1 : 0}</wpml:recordEnable>
        <wpml:targetDetectionActionEnable>${patrolAiEnabled ? 1 : 0}</wpml:targetDetectionActionEnable>
        ${patrolAiEnabled ? generateTargetDetectionActionXml(missionConfig, currentPatrolContext, 0) : ''}
      </Placemark>` :
      waypoints.map((wp, index) => {
        const wgs84 = gcj02ToWgs84(wp.lng, wp.lat);
        const height = wp.height || missionConfig.globalHeight || 70;
        // KML altitudeMode 映射：ASL -> absolute, 地形 -> relativeToGround, 起飞�?-> relativeToGround (KML 兼容�?
        const kmlAltMode = missionConfig.executeHeightMode === 'WGS84' ? 'absolute' : 'relativeToGround';

        let placemarkXml = `
      <Placemark>
        <Point>
          <coordinates>${wgs84.lng},${wgs84.lat},${height.toFixed(1)}</coordinates>
          <altitudeMode>${missionConfig.executeHeightMode === 'WGS84' ? 'absolute' : 'relativeToGround'}</altitudeMode>
        </Point>
        <wpml:index>${index}</wpml:index>
        ${missionConfig.executeHeightMode === 'WGS84' ? `<wpml:ellipsoidHeight>${height.toFixed(1)}</wpml:ellipsoidHeight>` : ''}
        <wpml:height>${height.toFixed(1)}</wpml:height>
        <wpml:waypointSpeed>${wp.speed || missionConfig.globalSpeed || 5}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>${wp.headingMode || 'followWayline'}</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>${(index === 0 || index === waypoints.length - 1 || (wp.actions && wp.actions.length > 0)) ? 'toPointAndStopWithDiscontinuityCurvature' : 'coordinateTurn'}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>${(index === 0 || index === waypoints.length - 1 || (wp.actions && wp.actions.length > 0)) ? '0' : '0.2'}</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useGlobalHeight>0</wpml:useGlobalHeight>
        <wpml:useGlobalSpeed>0</wpml:useGlobalSpeed>
        <wpml:useGlobalHeadingParam>0</wpml:useGlobalHeadingParam>
        <wpml:useGlobalTurnParam>0</wpml:useGlobalTurnParam>
        <wpml:useStraightLine>1</wpml:useStraightLine>`;

        // 同步动作组到 template.kml
        const initialActions = index === 0 && !isPatrol ? [
          { id: 0, func: 'rotateYaw', params: `<wpml:aircraftHeading>0</wpml:aircraftHeading><wpml:aircraftPathMode>counterClockwise</wpml:aircraftPathMode>` },
          { id: 1, func: 'gimbalRotate', params: '<wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable><wpml:gimbalPitchRotateAngle>0</wpml:gimbalPitchRotateAngle><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex><wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>' },
          { id: 2, func: 'zoom', params: '<wpml:focalLength>24</wpml:focalLength><wpml:isUseFocalFactor>0</wpml:isUseFocalFactor><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>' }
        ] : [];

        const hasAnyActions = wp.actions && wp.actions.length > 0;
        
        const standardActions = [];
        const intervalActions = [];
        (wp.actions || []).forEach(a => {
          if (['startTimedPhoto', 'startDistancePhoto'].includes(a.type)) {
            intervalActions.push(a);
          } else if (a.type !== 'stopIntervalPhoto') {
            standardActions.push(a);
          }
        });

        if (standardActions.length > 0 || (!hasAnyActions && initialActions.length > 0)) {
          placemarkXml += `
        <wpml:actionGroup>
          <wpml:actionGroupId>${globalActionGroupId++}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${index}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>`;

          let localActionId = 0;
          if (!hasAnyActions) {
            initialActions.forEach(action => {
              placemarkXml += `
          <wpml:action>
            <wpml:actionId>${localActionId++}</wpml:actionId>
            <wpml:actionActuatorFunc>${action.func}</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              ${action.params}
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
            });
          }

          standardActions.forEach(action => {
            placemarkXml += `
          <wpml:action>
            <wpml:actionId>${localActionId++}</wpml:actionId>
            <wpml:actionActuatorFunc>${getActionActuatorFunc(action.type)}</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              ${generateActionParamsXml(action, missionConfig)}
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
          });
          placemarkXml += `
        </wpml:actionGroup>`;
        }

        intervalActions.forEach(action => {
          const isTime = action.type === 'startTimedPhoto';
          const triggerType = isTime ? 'multipleTiming' : 'multipleDistance';
          const paramValue = isTime ? (action.params.photoInterval || 3) : (action.params.photoDistanceInterval || 10);
          
          const lensInput = action.params.payloadLensIndex || 'followRoute';
          const useGlobal = lensInput === 'followRoute' ? 1 : 0;
          let lensIndex = '';
          if (useGlobal === 1) {
            lensIndex = Array.isArray(missionConfig.photoType) ? 
              missionConfig.photoType.map(t => t.replace('visible', 'visable')).join(',') : 
              (missionConfig.photoType || 'visable,ir').replace('visible', 'visable');
          } else {
            lensIndex = lensInput.replace('visible', 'visable');
          }

          let calculatedEndIndex = waypoints.length - 1;
          for (let k = index + 1; k < waypoints.length; k++) {
            if (waypoints[k].actions && waypoints[k].actions.some(a => a.type === 'stopIntervalPhoto')) {
              calculatedEndIndex = k;
              break;
            }
          }

          placemarkXml += `
        <wpml:actionGroup>
          <wpml:actionGroupId>${globalActionGroupId++}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${calculatedEndIndex}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>${triggerType}</wpml:actionTriggerType>
            <wpml:actionTriggerParam>${paramValue}</wpml:actionTriggerParam>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>0</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>${action.params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
              <wpml:useGlobalPayloadLensIndex>${useGlobal}</wpml:useGlobalPayloadLensIndex>
              <wpml:payloadLensIndex>${lensIndex}</wpml:payloadLensIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>`;
        });

        placemarkXml += `
      </Placemark>`;
        return placemarkXml;
      }).join('')
    }
      ${isPatrol ? `<wpml:payloadParam>
        <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
        <wpml:focusMode>firstPoint</wpml:focusMode>
        <wpml:meteringMode>average</wpml:meteringMode>
        <wpml:returnMode>singleReturnStrongest</wpml:returnMode>
        <wpml:samplingRate>240000</wpml:samplingRate>
        <wpml:scanningMode>repetitive</wpml:scanningMode>
        <wpml:imageFormat>${currentPatrolContext.recordLensIndex}</wpml:imageFormat>
        <wpml:photoSize>default_l</wpml:photoSize>
      </wpml:payloadParam>` : ''
    }
    </Folder>
  </Document>
</kml>`;
};

const generateWaylinesWpml = (missionConfig, waypoints, patrolContext = null) => {
  const isPatrol = missionConfig.routeType === 'patrol' ;
  const currentPatrolContext = isPatrol ? (patrolContext || buildPatrolContext(missionConfig, null, waypoints)) : null;
  const patrolAiEnabled = isPatrol && isPatrolAiEnabled(missionConfig);
  const patrolAiConfig = isPatrol ? getPatrolAiConfig(missionConfig) : null;
  const autoFlightSpeed = resolveTransitionalSpeed(missionConfig, 5);
  const executeHeightMode = resolveExecuteHeightMode(missionConfig.executeHeightMode);
  const takeOffRefPointXml = getTakeOffRefPointXml(missionConfig, waypoints, { allowWaypointFallback: !isPatrol });
  const takeOffSecurityHeight = getMissionNumericValue(missionConfig.takeOffSecurityHeight, 20);
  const globalRTHHeight = getMissionNumericValue(missionConfig.globalRTHHeight, 100);
  const droneEnumValue = getMissionNumericValue(missionConfig.droneEnumValue, 99);
  const droneSubEnumValue = getMissionNumericValue(missionConfig.droneSubEnumValue, 1);
  const payloadEnumValue = getMissionNumericValue(missionConfig.payloadEnumValue, 89);
  const payloadSubEnumValue = getMissionNumericValue(missionConfig.payloadSubEnumValue, 0);
  const payloadPositionIndex = getMissionNumericValue(missionConfig.payloadPositionIndex, 0);
  const distance = formatWpmlNumber(calculatePathDistance(waypoints));
  const duration = formatWpmlNumber(calculatePathDuration(waypoints, autoFlightSpeed));
  const flyToWaylineMode = resolveFlyToWaylineMode(missionConfig);
  const obstacleAvoidanceMode = resolveObstacleAvoidanceMode(missionConfig);

  const contentHeader = `<?xml version="1.0" encoding="UTF-8"?>
  <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
    <Document>
      <wpml:missionConfig>
        <wpml:flyToWaylineMode>${flyToWaylineMode}</wpml:flyToWaylineMode>
        <wpml:finishAction>${missionConfig.finishAction || 'goHome'}</wpml:finishAction>
        <wpml:exitOnRCLost>${missionConfig.exitOnRCLost || 'goContinue'}</wpml:exitOnRCLost>
        <wpml:executeRCLostAction>${missionConfig.executeRCLostAction || 'goBack'}</wpml:executeRCLostAction>
        <wpml:takeOffSecurityHeight>${takeOffSecurityHeight}</wpml:takeOffSecurityHeight>${takeOffRefPointXml}
        <wpml:globalTransitionalSpeed>${autoFlightSpeed}</wpml:globalTransitionalSpeed>
        <wpml:globalRTHHeight>${globalRTHHeight}</wpml:globalRTHHeight>
        <wpml:droneInfo>
          <wpml:droneEnumValue>${droneEnumValue}</wpml:droneEnumValue>
          <wpml:droneSubEnumValue>${droneSubEnumValue}</wpml:droneSubEnumValue>
        </wpml:droneInfo>
        <wpml:autoRerouteInfo>
          <wpml:transitionalAutoRerouteMode>${obstacleAvoidanceMode}</wpml:transitionalAutoRerouteMode>
          <wpml:missionAutoRerouteMode>${obstacleAvoidanceMode}</wpml:missionAutoRerouteMode>
        </wpml:autoRerouteInfo>
        <wpml:waylineAvoidLimitAreaMode>${obstacleAvoidanceMode}</wpml:waylineAvoidLimitAreaMode>
        <wpml:payloadInfo>
          <wpml:payloadEnumValue>${payloadEnumValue}</wpml:payloadEnumValue>
          <wpml:payloadSubEnumValue>${payloadSubEnumValue}</wpml:payloadSubEnumValue>
          <wpml:payloadPositionIndex>${payloadPositionIndex}</wpml:payloadPositionIndex>
        </wpml:payloadInfo>
      </wpml:missionConfig>
      <Folder>
        <wpml:templateId>0</wpml:templateId>
        <wpml:executeHeightMode>${executeHeightMode}</wpml:executeHeightMode>
        <wpml:waylineId>0</wpml:waylineId>
        <wpml:distance>${distance}</wpml:distance>
        <wpml:duration>${duration}</wpml:duration>
        <wpml:autoFlightSpeed>${autoFlightSpeed}</wpml:autoFlightSpeed>
        <wpml:startActionGroup>${isPatrol ? `
${generatePatrolGimbalRotateActionXml(0, currentPatrolContext.gimbalPitchAngle, true)}
${patrolAiConfig?.recordEnable ? generatePatrolStartRecordActionXml(1, currentPatrolContext.recordLensIndex) : ''}` : `
          <wpml:action>
            <wpml:actionId>0</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalHeadingYawBase>north</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>${(missionConfig.aiPatrol && missionConfig.aiPatrol.gimbalPitchAngle) || -45}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
              <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
              <wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`}
        </wpml:startActionGroup>
        ${(missionConfig.executeHeightMode === 'realTimeFollowSurface') ? `
      <wpml:realTimeFollowSurfaceByFov>0</wpml:realTimeFollowSurfaceByFov>` : ''}
`;

  const waypointsXml = generateWaypointsXml(missionConfig, waypoints, isPatrol, currentPatrolContext, patrolAiEnabled, patrolAiConfig?.recordEnable !== false);

  return contentHeader + waypointsXml + `    </Folder>\n  </Document>\n</kml>`;
};

const generateWaypointsXml = (missionConfig, waypoints, isPatrol, patrolContext = null, patrolAiEnabled = false, patrolRecordEnabled = true) => {
  let xml = '';
  const patrolDirection = patrolContext?.direction ?? getPatrolDirection(missionConfig);
  let globalActionGroupId = 0;

  waypoints
    .filter(wp => wp && typeof wp.lng === 'number' && typeof wp.lat === 'number')
    .forEach((wp, index) => {
      const wgs84 = gcj02ToWgs84(wp.lng, wp.lat);
      const isLastWaypoint = index === waypoints.length - 1;
      const height = wp.height || missionConfig.globalHeight || 70;
      const executeHeight = (missionConfig.executeHeightMode === 'WGS84' && typeof wp.ellipsoidHeight === 'number')
        ? wp.ellipsoidHeight
        : (wp.height || missionConfig.globalHeight || 70);
      const hasWaypointActions = Array.isArray(wp.actions) && wp.actions.length > 0;
      const waypointHeadingMode = wp.headingMode || (isPatrol ? (isLastWaypoint ? 'followWayline' : 'fixed') : 'followWayline');
      const waypointHeadingAngle = waypointHeadingMode === 'fixed'
        ? (typeof wp.headingAngle === 'number' ? wp.headingAngle : patrolDirection)
        : 0;
      const shouldStopAtWaypoint = index === 0 || isLastWaypoint || hasWaypointActions;
      const waypointTurnMode = shouldStopAtWaypoint ? 'toPointAndStopWithDiscontinuityCurvature' : 'coordinateTurn';
      const waypointTurnDampingDist = getWaypointTurnDampingDistance(waypoints, index, shouldStopAtWaypoint);
      const executeHeightText = executeHeight.toFixed(1);
      const heightText = height.toFixed(1);

      const waypointHeightXml = isPatrol
        ? (missionConfig.executeHeightMode === 'WGS84'
          ? `        <wpml:ellipsoidHeight>${executeHeightText}</wpml:ellipsoidHeight>\n`
          : (missionConfig.executeHeightMode === 'realTimeFollowSurface'
            ? ''
            : `        <wpml:height>${heightText}</wpml:height>\n`))
        : `${missionConfig.executeHeightMode === 'WGS84' ? `<wpml:ellipsoidHeight>${heightText}</wpml:ellipsoidHeight>\n        ` : ''}<wpml:height>${heightText}</wpml:height>\n        `;

      const waypointGlobalOverrideXml = isPatrol
        ? ''
        : `        <wpml:useGlobalHeight>0</wpml:useGlobalHeight>
        <wpml:useGlobalSpeed>0</wpml:useGlobalSpeed>
        <wpml:useGlobalHeadingParam>0</wpml:useGlobalHeadingParam>
        <wpml:useGlobalTurnParam>0</wpml:useGlobalTurnParam>\n`;

      xml += `      <Placemark>
        <Point>
          <coordinates>${wgs84.lng},${wgs84.lat}</coordinates>
        </Point>
        <wpml:index>${index}</wpml:index>
${waypointHeightXml}        <wpml:executeHeight>${executeHeightText}</wpml:executeHeight>
        <wpml:waypointSpeed>${wp.speed || missionConfig.globalSpeed || 5}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>${waypointHeadingMode}</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>${waypointHeadingAngle}</wpml:waypointHeadingAngle>
          <wpml:waypointPoiPoint>${wp.poiPoint || '0.000000,0.000000,0.000000'}</wpml:waypointPoiPoint>
          <wpml:waypointHeadingAngleEnable>${waypointHeadingMode === 'fixed' ? 1 : 0}</wpml:waypointHeadingAngleEnable>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
          <wpml:waypointHeadingPoiIndex>${wp.poiIndex || 0}</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>${waypointTurnMode}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>${waypointTurnDampingDist}</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
${waypointGlobalOverrideXml}        <wpml:useStraightLine>1</wpml:useStraightLine>\n`;

      // Split actions into Standard and Interval types
      const standardActions = [];
      const intervalActions = [];
      (wp.actions || []).forEach(a => {
        if (['startTimedPhoto', 'startDistancePhoto'].includes(a.type)) {
          intervalActions.push(a);
        } else if (a.type !== 'stopIntervalPhoto') {
          standardActions.push(a);
        }
      });

      // Action Group Logic (Standard)
      const initialActions = index === 0 && !isPatrol ? [
        { id: 0, func: 'rotateYaw', params: `<wpml:aircraftHeading>0</wpml:aircraftHeading><wpml:aircraftPathMode>counterClockwise</wpml:aircraftPathMode><wpml:isStartPointRotateYaw>1</wpml:isStartPointRotateYaw>` },
        { id: 1, func: 'gimbalRotate', params: '<wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable><wpml:gimbalPitchRotateAngle>0</wpml:gimbalPitchRotateAngle><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex><wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode><wpml:isStartPointGimbalRotate>1</wpml:isStartPointGimbalRotate>' },
        { id: 2, func: 'zoom', params: '<wpml:focalLength>24</wpml:focalLength><wpml:isUseFocalFactor>0</wpml:isUseFocalFactor><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>' }
      ] : [];

      const hasStandardActions = standardActions.length > 0;
      const hasGlobalAction = missionConfig.globalAction && missionConfig.globalAction !== 'none';

      const shouldCreateActionGroup = hasStandardActions || initialActions.length > 0 || (isPatrol && index === 0);
      if (shouldCreateActionGroup) {
        xml += `        <wpml:actionGroup>
          <wpml:actionGroupId>${globalActionGroupId++}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${isPatrol && index === 0 ? waypoints.length - 1 : index}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>${isPatrol ? 'betweenAdjacentPointsIncludeFirstPoint' : 'reachPoint'}</wpml:actionTriggerType>
          </wpml:actionTrigger>\n`;

        let localActionId = 0;

        // 如果用户在当前航点没有手动设置任何动作，我们才添加默认的初始动作
        if (isPatrol && index === 0 && patrolContext) {
          xml += `${generatePatrolGimbalRotateActionXml(localActionId++, patrolContext.gimbalPitchAngle, false)}\n`;
          if (patrolRecordEnabled) {
            xml += `${generatePatrolStartRecordActionXml(localActionId++, patrolContext.recordLensIndex)}\n`;
          }
        } else if (!hasStandardActions && !intervalActions.length) {
          initialActions.forEach(action => {
            xml += `          <wpml:action>
              <wpml:actionId>${localActionId++}</wpml:actionId>
              <wpml:actionActuatorFunc>${action.func}</wpml:actionActuatorFunc>
              <wpml:actionActuatorFuncParam>
                ${action.params}
              </wpml:actionActuatorFuncParam>
            </wpml:action>\n`;
          });
        }

        standardActions.forEach(action => {
          xml += `          <wpml:action>
            <wpml:actionId>${localActionId++}</wpml:actionId>
            <wpml:actionActuatorFunc>${getActionActuatorFunc(action.type)}</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              ${generateActionParamsXml(action, missionConfig)}
            </wpml:actionActuatorFuncParam>
          </wpml:action>\n`;
        });

        if (!hasStandardActions && !intervalActions.length && hasGlobalAction && !isPatrol) {
          xml += `          <wpml:action>
            <wpml:actionId>${localActionId++}</wpml:actionId>
            <wpml:actionActuatorFunc>${missionConfig.globalAction}</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>\n`;
        }
        if (index === 0 && isPatrol && patrolContext && patrolAiEnabled) {
          xml += `${generateTargetDetectionActionXml(missionConfig, patrolContext, localActionId++)}\n`;
        }
        xml += `        </wpml:actionGroup>\n`;
      }

      // Interval Actions (Timed / Distance)
      intervalActions.forEach(action => {
        const isTime = action.type === 'startTimedPhoto';
        const triggerType = isTime ? 'multipleTiming' : 'multipleDistance';
        const paramValue = isTime ? (action.params.photoInterval || 3) : (action.params.photoDistanceInterval || 10);
        
        const lensInput = action.params.payloadLensIndex || 'followRoute';
        const useGlobal = lensInput === 'followRoute' ? 1 : 0;
        const lensIndex = useGlobal === 1
          ? normalizeLensIndex(missionConfig.photoType, 'visable,ir')
          : normalizeLensIndex(lensInput, 'visable');
        
        let calculatedEndIndex = waypoints.length - 1;
        for (let k = index + 1; k < waypoints.length; k++) {
          if (waypoints[k].actions && waypoints[k].actions.some(a => a.type === 'stopIntervalPhoto')) {
            calculatedEndIndex = k;
            break;
          }
        }
        
        xml += `        <wpml:actionGroup>
          <wpml:actionGroupId>${globalActionGroupId++}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${index}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${calculatedEndIndex}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>${triggerType}</wpml:actionTriggerType>
            <wpml:actionTriggerParam>${paramValue}</wpml:actionTriggerParam>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>0</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>${action.params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
              <wpml:useGlobalPayloadLensIndex>${useGlobal}</wpml:useGlobalPayloadLensIndex>
              <wpml:payloadLensIndex>${lensIndex}</wpml:payloadLensIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>\n`;
      });

      xml += `        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>0</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
        <wpml:isRisky>0</wpml:isRisky>
        <wpml:waypointWorkType>0</wpml:waypointWorkType>
      </Placemark>\n`;
    });

  // Removed patrol_detect group from folder level as it must be inside first Placemark
  return xml;
};

const generateAlarmActionsXml = (missionConfig) => {
  const patrolAiConfig = getPatrolAiConfig(missionConfig);
  const commonSpeakerProps = `
              <wpml:speakerSoundVolume>0</wpml:speakerSoundVolume>
              <wpml:speakerIsLoop>0</wpml:speakerIsLoop>
              <wpml:speakerActionType/>
              <wpml:speakerPayloadPositionIndex>0</wpml:speakerPayloadPositionIndex>
              <wpml:speakerFilePath/>
              <wpml:speakerFileMd5/>
              <wpml:speakerFileName/>
              <wpml:speakerFileOriginalName/>
              <wpml:speakerBitrate/>
              <wpml:searchlightBrightness>0</wpml:searchlightBrightness>
              <wpml:searchlightOperaType/>`;

  const actions = [];

  if (patrolAiConfig.alarmActions.snapshot) {
    actions.push(`
            <wpml:alarmAction>
              <wpml:maxDuration>0</wpml:maxDuration>
              <wpml:alarmActionType>squenceShot</wpml:alarmActionType>
              <wpml:alarmTimes>0</wpml:alarmTimes>${commonSpeakerProps}
            </wpml:alarmAction>`);
  }

  if (patrolAiConfig.alarmActions.record) {
    actions.push(`
            <wpml:alarmAction>
              <wpml:maxDuration>60</wpml:maxDuration>
              <wpml:alarmActionType>record</wpml:alarmActionType>
              <wpml:alarmTimes>0</wpml:alarmTimes>${commonSpeakerProps}
            </wpml:alarmAction>`);
  }

  if (patrolAiConfig.alarmActions.waitControl) {
    actions.push(`
            <wpml:alarmAction>
              <wpml:maxDuration>60</wpml:maxDuration>
              <wpml:alarmActionType>waitControl</wpml:alarmActionType>
              <wpml:alarmTimes>0</wpml:alarmTimes>${commonSpeakerProps}
            </wpml:alarmAction>`);
  }

  if (patrolAiConfig.alarmActions.speaker) {
    const speakerText = escapeXml(patrolAiConfig.customText || '检测到异常目标');
    const speakerTitle = escapeXml(patrolAiConfig.customTitle || 'alert');
    actions.push(`
            <wpml:alarmAction>
              <wpml:maxDuration>0</wpml:maxDuration>
              <wpml:alarmActionType>speaker</wpml:alarmActionType>
              <wpml:alarmTimes>1</wpml:alarmTimes>
              <wpml:speakerSoundVolume>100</wpml:speakerSoundVolume>
              <wpml:speakerIsLoop>0</wpml:speakerIsLoop>
              <wpml:speakerActionType>megaphone_start</wpml:speakerActionType>
              <wpml:speakerPayloadPositionIndex>0</wpml:speakerPayloadPositionIndex>
              <wpml:speakerFilePath/>
              <wpml:speakerFileMd5/>
              <wpml:speakerFileName>${speakerTitle}</wpml:speakerFileName>
              <wpml:speakerFileOriginalName>${speakerTitle}</wpml:speakerFileOriginalName>
              <wpml:speakerBitrate>4</wpml:speakerBitrate>
              <wpml:searchlightBrightness>0</wpml:searchlightBrightness>
              <wpml:searchlightOperaType/>
              <ttsparam>
                <text>${speakerText}</text>
                <role>male</role>
                <language>CN</language>
                <volume>100</volume>
                <speed>50</speed>
              </ttsparam>
            </wpml:alarmAction>`);
  }

  if (patrolAiConfig.alarmActions.searchlight) {
    actions.push(`
            <wpml:alarmAction>
              <wpml:maxDuration>60</wpml:maxDuration>
              <wpml:alarmActionType>searchlight</wpml:alarmActionType>
              <wpml:alarmTimes>0</wpml:alarmTimes>${commonSpeakerProps.replace('<wpml:searchlightBrightness>0</wpml:searchlightBrightness>', '<wpml:searchlightBrightness>100</wpml:searchlightBrightness>').replace('<wpml:searchlightOperaType/>', '<wpml:searchlightOperaType>searchlight_lighting</wpml:searchlightOperaType>')}
            </wpml:alarmAction>`);
  }

  return actions.join('');
};

const generateTargetParamsXml = (missionConfig) => {
  const patrolAiConfig = getPatrolAiConfig(missionConfig);
  const targetMap = {
    person: 'people',
    car: 'vehicle',
    boat: 'boat'
  };

  const targets = getSelectedTargets(missionConfig).split(',');
  return targets.map(t => {
    const rule = patrolAiConfig.targetRules[targetMap[t]] || createDefaultPatrolRule();
    const threshold = Math.max(1, getMissionNumericValue(rule.value, 1));
    const isGreaterMode = rule.operator !== '<';

    return `
            <wpml:targetParam>
              <wpml:maxThreshold>${threshold}</wpml:maxThreshold>
              <wpml:minThreshold>${threshold}</wpml:minThreshold>
              <wpml:useMaxThreshold>${isGreaterMode ? 0 : 1}</wpml:useMaxThreshold>
              <wpml:useMinThreshold>${isGreaterMode ? 1 : 0}</wpml:useMinThreshold>
              <wpml:targetType>${t}</wpml:targetType>
            </wpml:targetParam>`;
  }).join('');
};

const getActionActuatorFunc = (type) => {
  const map = {
    'takePhoto': 'takePhoto',
    'startRecord': 'startRecord',
    'stopRecord': 'stopRecord',
    'gimbalPitch': 'gimbalRotate',
    'aircraftYaw': 'rotateYaw',
    'hover': 'hover',
    'zoom': 'zoom',
    'startTimedPhoto': 'startIntervalShot',
    'startDistancePhoto': 'startDistanceIntervalShot',
    'stopIntervalPhoto': 'stopIntervalShot',
      'panorama': 'panoShot',
    'orientedPhoto': 'orientedShot',
    'customDirName': 'customDirName',
    'recordPointCloud': 'recordPointCloud',
    'setFocusType': 'setFocusType',
    'focus': 'focus',
    'gimbalAngleUnlock': 'gimbalAngleUnlock',
    'spotlight': 'spotlight',
    'speaker': 'speaker',
    'smartRecognition': 'targetDetection',
    'startTimeLapse': 'startTimeLapse',
    'stopTimeLapse': 'stopTimeLapse'
  };
  return map[type] || type;
};

const generateActionParamsXml = (action, missionConfig = {}) => {
  const params = action.params || {};
  let xml = '';

  switch (action.type) {
    case 'takePhoto':
    case 'stopRecord':
    case 'stopIntervalPhoto':
    case 'orientedPhoto':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>`;
      break;
    case 'startRecord':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>`;
      break;
    case 'startTimedPhoto':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
            <wpml:useActionGroupDefaultShotPara>1</wpml:useActionGroupDefaultShotPara>
            <wpml:photoInterval>${params.photoInterval || 3}</wpml:photoInterval>`;
      break;
    case 'startDistancePhoto':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
            <wpml:useActionGroupDefaultShotPara>1</wpml:useActionGroupDefaultShotPara>
            <wpml:photoDistanceInterval>${params.photoDistanceInterval || 10}</wpml:photoDistanceInterval>`;
      break;
    case 'gimbalPitch':
      xml = `<wpml:gimbalHeadingYawBase>${params.gimbalHeadingYawBase || 'aircraft'}</wpml:gimbalHeadingYawBase>
            <wpml:gimbalPitchRotateEnable>${params.gimbalPitchRotateEnable || 1}</wpml:gimbalPitchRotateEnable>
            <wpml:gimbalPitchRotateAngle>${params.gimbalPitchRotateAngle || -45}</wpml:gimbalPitchRotateAngle>
            <wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
            <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
            <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
            <wpml:gimbalYawRotateEnable>${params.gimbalYawRotateEnable || 0}</wpml:gimbalYawRotateEnable>
            <wpml:gimbalYawRotateAngle>${params.gimbalYawRotateAngle || 0}</wpml:gimbalYawRotateAngle>
            <wpml:gimbalRotateTimeEnable>${params.gimbalRotateTimeEnable || 0}</wpml:gimbalRotateTimeEnable>
            <wpml:gimbalRotateTime>${params.gimbalRotateTime || 10}</wpml:gimbalRotateTime>
            <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>`;
      break;
    case 'aircraftYaw':
      xml = `<wpml:aircraftHeading>${params.aircraftYawAngle || 0}</wpml:aircraftHeading>
  <wpml:aircraftPathMode>${params.aircraftPathMode || (params.aircraftRotateDirection === 0 ? 'counterClockwise' : 'clockwise')}</wpml:aircraftPathMode>`;
      break;
    case 'hover':
      xml = `<wpml:hoverTime>${params.hoverTime || 10}</wpml:hoverTime>`;
      break;
    case 'zoom':
      // DJI Pilot 2 usually expects focalLength in XML for Zoom action
      // Convert zoomFactor back to focalLength based on 24mm equivalent
      const focalLength = (params.zoomFactor || 1.0) * 24;
      xml = `<wpml:focalLength>${focalLength.toFixed(1)}</wpml:focalLength>
  <wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>`;
      break;
    case 'panorama':
        let panoMode = params.subMode === 'pano_shot_360' ? 'panoShot_360' : (params.subMode || 'panoShot_360');
        let panoLens = Array.isArray(missionConfig.photoType) ? missionConfig.photoType.join(',').replace(/visible/g, 'visable') : (missionConfig.photoType || 'visable').replace('visible', 'visable');
        xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
              <wpml:useGlobalPayloadLensIndex>0</wpml:useGlobalPayloadLensIndex>
              <wpml:payloadLensIndex>${panoLens}</wpml:payloadLensIndex>
              <wpml:actionUUID>${action.actionUUID || (action.actionUUID = uuidv4())}</wpml:actionUUID>
              <wpml:panoShotSubMode>${panoMode}</wpml:panoShotSubMode>`;
        break;
    case 'customDirName':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
  <wpml:directoryName>${params.directoryName || 'DJI_001'}</wpml:directoryName>`;
      break;
    case 'recordPointCloud':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
  <wpml:pointCloudOperateType>${params.pointCloudOperateType || 'start'}</wpml:pointCloudOperateType>`;
      break;
    case 'setFocusType':
      xml = `<wpml:cameraFocusType>${params.cameraFocusType || 'manual'}</wpml:cameraFocusType>
  <wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>`;
      break;
    case 'focus':
      xml = `<wpml:focusX>${params.focusX || 0}</wpml:focusX>
            <wpml:focusY>${params.focusY || 0}</wpml:focusY>
            <wpml:focusRegionWidth>${params.focusRegionWidth || 0}</wpml:focusRegionWidth>
            <wpml:focusRegionHeight>${params.focusRegionHeight || 0}</wpml:focusRegionHeight>
            <wpml:isPointFocus>${params.isPointFocus || 0}</wpml:isPointFocus>
            <wpml:isInfiniteFocus>${params.isInfiniteFocus || 1}</wpml:isInfiniteFocus>
            <wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
            <wpml:isCalibrationFocus>${params.isCalibrationFocus || 0}</wpml:isCalibrationFocus>`;
      break;
    case 'gimbalAngleLock':
    case 'gimbalAngleUnlock':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>`;
      break;
    case 'startTimeLapse':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
            <wpml:useGlobalPayloadLensIndex>${params.useGlobalPayloadLensIndex || 0}</wpml:useGlobalPayloadLensIndex>
            <wpml:payloadLensIndex>${params.payloadLensIndex || 'visable'}</wpml:payloadLensIndex>
            <wpml:minShootInterval>${params.photoInterval || 3}</wpml:minShootInterval>`;
      break;
    case 'stopTimeLapse':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>`;
      break;
    case 'spotlight':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
            <wpml:spotlightMode>${params.spotlightMode || 'on'}</wpml:spotlightMode>
            <wpml:spotlightBrightness>${params.spotlightBrightness || 100}</wpml:spotlightBrightness>`;
      break;
    case 'speaker':
      xml = `<wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
            <wpml:speakerMode>${params.speakerMode || 'start'}</wpml:speakerMode>
            <wpml:speakerSoundId>${params.speakerSoundId || 0}</wpml:speakerSoundId>
            <wpml:speakerVolume>${params.speakerVolume || 100}</wpml:speakerVolume>`;
      break;
    case 'smartRecognition':
      xml = `<wpml:actionUUID>${action.actionUUID || (action.actionUUID = uuidv4())}</wpml:actionUUID>
            <wpml:payloadPositionIndex>${params.payloadPositionIndex || 0}</wpml:payloadPositionIndex>
            <wpml:targetDetectionMode>${params.smartRecognitionMode || 'start'}</wpml:targetDetectionMode>
            <wpml:targetParam>
              <wpml:targetType>${(params.smartRecognitionType || []).join(',')}</wpml:targetType>
            </wpml:targetParam>`;
      break;
  }
  return xml;
};

const getSelectedTargets = (missionConfig) => {
  const patrolAiConfig = getPatrolAiConfig(missionConfig);
  const targetFlags = patrolAiConfig.targets || {};

  const targets = [];
  if (targetFlags.people) targets.push('person');
  if (targetFlags.vehicle) targets.push('car'); // Mapping 'vehicle' to 'car' as per common DJI XML
  if (targetFlags.boat) targets.push('boat'); // Assuming 'boat' is valid, otherwise check docs

  // If nothing is configured, default to 'person' to keep behavior stable
  return targets.length > 0 ? targets.join(',') : 'person';
};

export const generateKMZ = async (missionConfig, waypoints, boundaryPoints = null) => {
  const waypointMissionConfig = {
    ...missionConfig,
    routeType: 'waypoint'
  };
  const zip = new JSZip();
  const generatedAt = Date.now();
  const patrolContext = null;

  // Create wpmz folder structure
  const wpmz = zip.folder("wpmz");

  const templateContent = generateTemplateKml(waypointMissionConfig, waypoints, null, patrolContext, generatedAt);
  wpmz.file("template.kml", templateContent);

  const waylinesContent = generateWaylinesWpml(waypointMissionConfig, waypoints, patrolContext);
  wpmz.file("waylines.wpml", waylinesContent);

  const content = await zip.generateAsync({ type: "blob" });
  return content;
};






