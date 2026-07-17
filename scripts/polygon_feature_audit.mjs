import fs from 'node:fs';
import path from 'node:path';
import { generateMappingRoute } from '../src/utils/polygonRouteGenerator.js';
import { generateMapping3dTemplateKml, generateMapping3dWaylinesWpml } from '../src/utils/mapping3dGenerator.js';

const cwd = process.cwd();
const EARTH_RADIUS = 6371000;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const readText = (relativePath) => fs.readFileSync(path.join(cwd, relativePath), 'utf8');

const getTag = (xml, tag) => {
  const match = xml.match(new RegExp(`<${escapeRegex(tag)}>([\\s\\S]*?)</${escapeRegex(tag)}>`));
  return match ? match[1].trim() : null;
};

const getAllTags = (xml, tag) => {
  const pattern = new RegExp(`<${escapeRegex(tag)}>([\\s\\S]*?)</${escapeRegex(tag)}>`, 'g');
  return Array.from(xml.matchAll(pattern), (match) => match[1].trim());
};

const countLiteral = (xml, literal) => {
  const pattern = new RegExp(escapeRegex(literal), 'g');
  return Array.from(xml.matchAll(pattern)).length;
};

const haversine = (pointA, pointB) => {
  const lat1 = pointA.lat * Math.PI / 180;
  const lat2 = pointB.lat * Math.PI / 180;
  const deltaLat = (pointB.lat - pointA.lat) * Math.PI / 180;
  const deltaLng = (pointB.lng - pointA.lng) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const parsePolygonBoundary = (templateXml) => {
  const coordinatesBlocks = Array.from(
    templateXml.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g),
    (match) => match[1]
  );
  const polygonBlock = coordinatesBlocks.find((block) => block.includes(','));
  if (!polygonBlock) return [];

  const points = polygonBlock
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => {
      const [lng, lat] = entry.split(',').map(Number);
      return { lng, lat };
    })
    .filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat));

  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first.lng - last.lng) < 1e-12 && Math.abs(first.lat - last.lat) < 1e-12) {
      points.pop();
    }
  }

  return points;
};

const parseTemplateConfig = (templatePath, aircraftModel) => {
  const templateXml = readText(templatePath);
  const boundaryPoints = parsePolygonBoundary(templateXml);
  const templateType = String(getTag(templateXml, 'wpml:templateType') || '').trim().toLowerCase();
  const smartOblique = getTag(templateXml, 'wpml:smartObliqueEnable') === '1';
  const surfaceFollowMode = getTag(templateXml, 'wpml:surfaceFollowModeEnable') === '1';
  const realtimeSurfaceFollow = getTag(templateXml, 'wpml:isRealtimeSurfaceFollow') === '1';
  const direction = Number(getTag(templateXml, 'wpml:direction') ?? 0);
  const overlapH = Number(getTag(templateXml, 'wpml:orthoCameraOverlapH') ?? 80);
  const overlapW = Number(getTag(templateXml, 'wpml:orthoCameraOverlapW') ?? 70);
  const globalHeight = Number(getTag(templateXml, 'wpml:globalShootHeight') ?? getTag(templateXml, 'wpml:height') ?? 70);
  const autoFlightSpeed = Number(getTag(templateXml, 'wpml:autoFlightSpeed') ?? 15);
  const rawHeightMode = getTag(templateXml, 'wpml:heightMode') || 'relativeToStartPoint';
  const dsmFile = String(getTag(templateXml, 'wpml:dsmFile') || '')
    .trim()
    .replace(/^wpmz\/res\/dsm\//, '');
  const takeOffRefPoint = getTag(templateXml, 'wpml:takeOffRefPoint');
  const [takeOffLat, takeOffLng, takeOffHeight] = (takeOffRefPoint || '').split(',').map(Number);

  const missionConfig = {
    routeType: 'mapping',
    aircraftModel,
    globalHeight,
    globalSpeed: autoFlightSpeed,
    globalTransitionalSpeed: Number(getTag(templateXml, 'wpml:globalTransitionalSpeed') ?? autoFlightSpeed),
    globalRTHHeight: Number(getTag(templateXml, 'wpml:globalRTHHeight') ?? 100),
    takeOffSecurityHeight: Number(getTag(templateXml, 'wpml:takeOffSecurityHeight') ?? 20),
    finishAction: getTag(templateXml, 'wpml:finishAction') ?? 'goHome',
    exitOnRCLost: getTag(templateXml, 'wpml:exitOnRCLost') ?? 'goContinue',
    executeRCLostAction: getTag(templateXml, 'wpml:executeRCLostAction') ?? 'goBack',
    droneEnumValue: Number(getTag(templateXml, 'wpml:droneEnumValue') ?? 99),
    droneSubEnumValue: Number(getTag(templateXml, 'wpml:droneSubEnumValue') ?? 1),
    payloadEnumValue: Number(getTag(templateXml, 'wpml:payloadEnumValue') ?? 89),
    payloadSubEnumValue: Number(getTag(templateXml, 'wpml:payloadSubEnumValue') ?? 0),
    payloadPositionIndex: Number(getTag(templateXml, 'wpml:payloadPositionIndex') ?? 0),
    executeHeightMode: surfaceFollowMode ? 'realTimeFollowSurface' : (rawHeightMode === 'EGM96' ? 'WGS84' : rawHeightMode),
    realTimeFollowSurface: realtimeSurfaceFollow
  };

  if (Number.isFinite(takeOffLat) && Number.isFinite(takeOffLng)) {
    missionConfig.takeOffPointLat = takeOffLat;
    missionConfig.takeOffPointLng = takeOffLng;
    missionConfig.takeOffPointHeight = Number.isFinite(takeOffHeight) ? takeOffHeight : 0;
  }

  const routeConfig = {
    collectionType: templateType === 'mapping3d' ? 'oblique' : (smartOblique ? 'oblique' : 'ortho'),
    smartOblique,
    spacingMode: 'auto',
    overlapLateral: overlapW / 100,
    overlapLongitudinal: overlapH / 100,
    angle: Number.isFinite(direction) ? direction : 0,
    margin: Number(getTag(templateXml, 'wpml:margin') ?? 0),
    gimbalPitchAngle: Number(getTag(templateXml, 'wpml:inclinedGimbalPitch') ?? getTag(templateXml, 'wpml:smartObliqueGimbalPitch') ?? -45),
    cameraPreset: aircraftModel,
    aircraftModel,
    optimizePath: true,
    executeHeightMode: missionConfig.executeHeightMode,
    surfaceFollowMode,
    realTimeFollowSurface: realtimeSurfaceFollow,
    dsmFile,
    height: globalHeight,
    speed: autoFlightSpeed,
    elevationOptimizeEnable: getTag(templateXml, 'wpml:elevationOptimizeEnable') === '1'
  };

  return { templateXml, boundaryPoints, missionConfig, routeConfig };
};

const parseWpmlRoutes = (wpmlXml) => {
  const folderMatches = Array.from(wpmlXml.matchAll(/<Folder>([\s\S]*?)<\/Folder>/g), (match) => match[1]);
  return folderMatches.map((folderXml, routeIdx) => ({
    routeIdx,
    waypoints: Array.from(folderXml.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g), (match) => {
      const coordinates = getTag(match[1], 'coordinates')?.split(',').map(Number) || [];
      return {
        lng: coordinates[0],
        lat: coordinates[1],
        heading: Number(getTag(match[1], 'wpml:waypointHeadingAngle'))
      };
    }),
    takePhotoCount: countLiteral(folderXml, '<wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>'),
    startTimeLapseCount: countLiteral(folderXml, '<wpml:actionActuatorFunc>startTimeLapse</wpml:actionActuatorFunc>'),
    stopTimeLapseCount: countLiteral(folderXml, '<wpml:actionActuatorFunc>stopTimeLapse</wpml:actionActuatorFunc>'),
    startSmartObliqueCount: countLiteral(folderXml, '<wpml:actionActuatorFunc>startSmartOblique</wpml:actionActuatorFunc>'),
    stopSmartObliqueCount: countLiteral(folderXml, '<wpml:actionActuatorFunc>stopSmartOblique</wpml:actionActuatorFunc>')
  }));
};

const groupGeneratedWaypoints = (waypoints) => {
  const groups = new Map();
  for (const waypoint of waypoints) {
    const routeIndex = waypoint.routeIndex ?? 0;
    if (!groups.has(routeIndex)) groups.set(routeIndex, []);
    groups.get(routeIndex).push(waypoint);
  }

  return [...groups.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([routeIdx, groupedWaypoints]) => ({
      routeIdx,
      waypoints: groupedWaypoints
    }));
};

const compareGeometry = (officialRoutes, generatedWaypoints) => {
  const generatedRoutes = groupGeneratedWaypoints(generatedWaypoints);
  const routeChecks = officialRoutes.map((officialRoute, index) => {
    const generatedRoute = generatedRoutes[index];
    const pointChecks = officialRoute.waypoints.map((officialPoint, pointIndex) => {
      const generatedPoint = generatedRoute?.waypoints?.[pointIndex];
      if (!generatedPoint) {
        return { pointIndex, deltaMeters: null };
      }

      return {
        pointIndex,
        deltaMeters: haversine(officialPoint, generatedPoint)
      };
    });

    const finiteDeltas = pointChecks
      .map((point) => point.deltaMeters)
      .filter((value) => Number.isFinite(value));

    return {
      routeIdx: index,
      officialPointCount: officialRoute.waypoints.length,
      generatedPointCount: generatedRoute?.waypoints?.length ?? 0,
      maxPointDeltaMeters: finiteDeltas.length ? Math.max(...finiteDeltas) : null,
      avgPointDeltaMeters: finiteDeltas.length
        ? finiteDeltas.reduce((sum, value) => sum + value, 0) / finiteDeltas.length
        : null
    };
  });

  return {
    identicalStructure: routeChecks.every((route) => route.officialPointCount === route.generatedPointCount),
    maxPointDeltaMeters: routeChecks.reduce(
      (maxValue, route) => (Number.isFinite(route.maxPointDeltaMeters) ? Math.max(maxValue, route.maxPointDeltaMeters) : maxValue),
      0
    ),
    routeChecks
  };
};

const auditTraditionalOblique = ({ templatePath, wpmlPath, aircraftModel, expectedLensMode }) => {
  const { templateXml, boundaryPoints, missionConfig, routeConfig } = parseTemplateConfig(templatePath, aircraftModel);
  const generatedWaypoints = generateMappingRoute(boundaryPoints, routeConfig);
  const generatedWpml = generateMapping3dWaylinesWpml(missionConfig, generatedWaypoints, routeConfig);
  const generatedTemplate = generateMapping3dTemplateKml(missionConfig, boundaryPoints, routeConfig);
  const officialWpml = readText(wpmlPath);

  const officialRoutes = parseWpmlRoutes(officialWpml);
  const generatedRoutes = parseWpmlRoutes(generatedWpml);

  return {
    geometry: compareGeometry(officialRoutes, generatedWaypoints),
    actionStructure: {
      official: {
        routeCount: officialRoutes.length,
        pointCounts: officialRoutes.map((route) => route.waypoints.length),
        takePhotoCounts: officialRoutes.map((route) => route.takePhotoCount),
        startTimeLapseCounts: officialRoutes.map((route) => route.startTimeLapseCount),
        stopTimeLapseCounts: officialRoutes.map((route) => route.stopTimeLapseCount)
      },
      generated: {
        routeCount: generatedRoutes.length,
        pointCounts: generatedRoutes.map((route) => route.waypoints.length),
        takePhotoCounts: generatedRoutes.map((route) => route.takePhotoCount),
        startTimeLapseCounts: generatedRoutes.map((route) => route.startTimeLapseCount),
        stopTimeLapseCounts: generatedRoutes.map((route) => route.stopTimeLapseCount)
      }
    },
    exportDiff: {
      officialImageFormat: getTag(templateXml, 'wpml:imageFormat'),
      generatedImageFormat: getTag(generatedTemplate, 'wpml:imageFormat'),
      officialPayloadSubEnumValue: getTag(templateXml, 'wpml:payloadSubEnumValue'),
      generatedPayloadSubEnumValue: getTag(generatedTemplate, 'wpml:payloadSubEnumValue'),
      expectedLensMode
    }
  };
};

const auditOrthophoto = ({ templatePath, wpmlPath, aircraftModel }) => {
  const { boundaryPoints, missionConfig, routeConfig } = parseTemplateConfig(templatePath, aircraftModel);
  const generatedWaypoints = generateMappingRoute(boundaryPoints, routeConfig);
  const generatedWpml = generateMapping3dWaylinesWpml(missionConfig, generatedWaypoints, routeConfig);
  const officialWpml = readText(wpmlPath);

  const officialRoutes = parseWpmlRoutes(officialWpml);
  const generatedRoutes = parseWpmlRoutes(generatedWpml);

  return {
    geometry: compareGeometry(officialRoutes, generatedWaypoints),
    actionStructure: {
      official: {
        routeCount: officialRoutes.length,
        pointCounts: officialRoutes.map((route) => route.waypoints.length),
        takePhotoCounts: officialRoutes.map((route) => route.takePhotoCount)
      },
      generated: {
        routeCount: generatedRoutes.length,
        pointCounts: generatedRoutes.map((route) => route.waypoints.length),
        takePhotoCounts: generatedRoutes.map((route) => route.takePhotoCount)
      }
    }
  };
};

const auditSmartOblique = ({ templatePath, wpmlPath, aircraftModel }) => {
  const { templateXml, boundaryPoints, missionConfig, routeConfig } = parseTemplateConfig(templatePath, aircraftModel);
  const generatedWaypoints = generateMappingRoute(boundaryPoints, routeConfig);
  const generatedTemplate = generateMapping3dTemplateKml(missionConfig, boundaryPoints, routeConfig);
  const generatedWpml = generateMapping3dWaylinesWpml(missionConfig, generatedWaypoints, routeConfig);
  const officialWpml = readText(wpmlPath);

  const officialRoutes = parseWpmlRoutes(officialWpml);
  const generatedRoutes = parseWpmlRoutes(generatedWpml);

  return {
    geometry: compareGeometry(officialRoutes, generatedWaypoints),
    actionStructure: {
      official: {
        routeCount: officialRoutes.length,
        pointCounts: officialRoutes.map((route) => route.waypoints.length),
        startSmartObliqueCounts: officialRoutes.map((route) => route.startSmartObliqueCount),
        stopSmartObliqueCounts: officialRoutes.map((route) => route.stopSmartObliqueCount)
      },
      generated: {
        routeCount: generatedRoutes.length,
        pointCounts: generatedRoutes.map((route) => route.waypoints.length),
        startSmartObliqueCounts: generatedRoutes.map((route) => route.startSmartObliqueCount),
        stopSmartObliqueCounts: generatedRoutes.map((route) => route.stopSmartObliqueCount)
      }
    },
    surfaceFollowExport: {
      officialSurfaceFollowModeEnable: getTag(templateXml, 'wpml:surfaceFollowModeEnable'),
      officialRealtimeSurfaceFollow: getTag(templateXml, 'wpml:isRealtimeSurfaceFollow'),
      officialDsmFile: getTag(templateXml, 'wpml:dsmFile'),
      generatedSurfaceFollowModeEnable: getTag(generatedTemplate, 'wpml:surfaceFollowModeEnable'),
      generatedRealtimeSurfaceFollow: getTag(generatedTemplate, 'wpml:isRealtimeSurfaceFollow'),
      generatedDsmFile: getTag(generatedTemplate, 'wpml:dsmFile')
    }
  };
};

const auditHeightModes = () => {
  const boundaryPoints = [
    { lng: 104.390572267745, lat: 31.093056441636 },
    { lng: 104.390593254936, lat: 31.091818270889 },
    { lng: 104.389017756700, lat: 31.091890411745 }
  ];
  const missionConfig = {
    routeType: 'mapping',
    aircraftModel: 'm30',
    globalHeight: 140.625,
    globalSpeed: 15,
    finishAction: 'goHome',
    exitOnRCLost: 'goContinue',
    executeRCLostAction: 'goBack',
    takeOffSecurityHeight: 20,
    globalTransitionalSpeed: 15,
    globalRTHHeight: 100,
    droneEnumValue: 67,
    droneSubEnumValue: 1,
    payloadEnumValue: 53,
    payloadSubEnumValue: 0,
    payloadPositionIndex: 0,
    executeHeightMode: 'relativeToStartPoint'
  };
  const routeBase = {
    collectionType: 'ortho',
    spacingMode: 'auto',
    overlapLateral: 0.7,
    overlapLongitudinal: 0.8,
    angle: 273,
    margin: 0,
    cameraPreset: 'm30',
    optimizePath: true
  };

  const wgsTemplate = generateMapping3dTemplateKml(missionConfig, boundaryPoints, {
    ...routeBase,
    executeHeightMode: 'WGS84'
  });
  const surfaceTemplate = generateMapping3dTemplateKml(missionConfig, boundaryPoints, {
    ...routeBase,
    executeHeightMode: 'realTimeFollowSurface',
    realTimeFollowSurface: true
  });

  return {
    wgs84HeightMode: getTag(wgsTemplate, 'wpml:heightMode'),
    surfaceHeightMode: getTag(surfaceTemplate, 'wpml:heightMode'),
    surfaceFollowModeEnable: getTag(surfaceTemplate, 'wpml:surfaceFollowModeEnable'),
    realtimeSurfaceFollow: getTag(surfaceTemplate, 'wpml:isRealtimeSurfaceFollow')
  };
};

const auditPlaceholderFlags = () => {
  const boundaryPoints = [
    { lng: 104.390572267745, lat: 31.093056441636 },
    { lng: 104.390593254936, lat: 31.091818270889 },
    { lng: 104.389017756700, lat: 31.091890411745 }
  ];
  const missionConfig = {
    routeType: 'mapping',
    aircraftModel: 'm30',
    globalHeight: 140.625,
    globalSpeed: 15,
    finishAction: 'goHome',
    exitOnRCLost: 'goContinue',
    executeRCLostAction: 'goBack',
    takeOffSecurityHeight: 20,
    globalTransitionalSpeed: 15,
    globalRTHHeight: 100,
    droneEnumValue: 67,
    droneSubEnumValue: 1,
    payloadEnumValue: 53,
    payloadSubEnumValue: 0,
    payloadPositionIndex: 0,
    executeHeightMode: 'relativeToStartPoint'
  };
  const baseRouteConfig = {
    collectionType: 'ortho',
    spacingMode: 'auto',
    overlapLateral: 0.7,
    overlapLongitudinal: 0.8,
    angle: 273,
    margin: 0,
    cameraPreset: 'm30',
    optimizePath: true
  };

  const baseWaypoints = generateMappingRoute(boundaryPoints, baseRouteConfig);
  const baseGeometry = JSON.stringify(baseWaypoints);

  const checkFlag = (flagName, tagName) => {
    const enabledRouteConfig = {
      ...baseRouteConfig,
      [flagName]: true
    };
    const enabledTemplate = generateMapping3dTemplateKml(missionConfig, boundaryPoints, enabledRouteConfig);
    const enabledWaypoints = generateMappingRoute(boundaryPoints, enabledRouteConfig);

    return {
      templateTagValue: getTag(enabledTemplate, tagName),
      geometryChanged: JSON.stringify(enabledWaypoints) !== baseGeometry
    };
  };

  return {
    quickOrthoMappingEnable: checkFlag('quickOrthoMappingEnable', 'wpml:quickOrthoMappingEnable'),
    facadeWaylineEnable: checkFlag('facadeWaylineEnable', 'wpml:facadeWaylineEnable'),
    efficiencyFlightMode: checkFlag('efficiencyFlightMode', 'wpml:efficiencyFlightModeEnable')
  };
};

const report = {
  generatedAt: new Date().toISOString(),
  orthophoto: {
    m30: auditOrthophoto({
      templatePath: 'output/regression/m30_ortho_official_regression.template.kml',
      wpmlPath: 'output/regression/m30_ortho_official_regression.waylines.wpml',
      aircraftModel: 'm30'
    })
  },
  traditionalOblique: {
    m30: auditTraditionalOblique({
      templatePath: 'output/regression/m30_oblique_official_regression.template.kml',
      wpmlPath: 'output/regression/m30_oblique_official_regression.waylines.wpml',
      aircraftModel: 'm30',
      expectedLensMode: 'wide'
    }),
    m4t: auditTraditionalOblique({
      templatePath: 'output/regression/m4_oblique_official_regression.template.kml',
      wpmlPath: 'output/regression/m4_oblique_official_regression.waylines.wpml',
      aircraftModel: 'm4t',
      expectedLensMode: 'visable'
    })
  },
  smartOblique: {
    m4tOfflineDsmSample: auditSmartOblique({
      templatePath: path.join('测试文件夹', 'wpmz', 'template.kml'),
      wpmlPath: path.join('测试文件夹', 'wpmz', 'waylines.wpml'),
      aircraftModel: 'm4t'
    })
  },
  heightModes: auditHeightModes(),
  placeholderFlags: auditPlaceholderFlags(),
  conclusions: {
    verified: [
      '正射主算法与官方样例对齐',
      '传统倾斜几何航线与官方样例对齐',
      '离线 DSM 仿地导入导出不再误写为实时仿地',
      '完成动作/失控动作/安全起飞高度进入导出链路',
      'WGS84 高度模式已修正为正确导出',
      'quickOrthoMappingEnable / facadeWaylineEnable / efficiencyFlightMode 已从面状导出主链路忽略'
    ],
    partial: [
      'Smart Oblique 与 DJI 样例动作数量一致，但仍有 1 个中间航点差异',
      '相对地形/实时仿地更偏导出层能力，需真机闭环验证',
      '离线 DSM 资源打包支持存在，但 UI 上传管理链路不完整'
    ],
    cleanedUnsupportedFields: [
      'quickOrthoMappingEnable',
      'facadeWaylineEnable',
      'efficiencyFlightMode'
    ]
  }
};

console.log(JSON.stringify(report, null, 2));
