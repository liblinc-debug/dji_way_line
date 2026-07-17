import fs from 'fs';
import path from 'path';
import { gcj02ToWgs84, wgs84ToGcj02 } from '../src/utils/coordTransform.js';
import { calculateDistance } from '../src/utils/geometryCalculator.js';
import { generateStripRoute } from '../src/utils/stripRouteGenerator.js';
import {
  generateStripTemplateKml,
  generateStripWaylinesWpml
} from '../src/utils/stripMappingGenerator.js';

const root = path.resolve('D:/desktop/UAV/dji_way_line_business');
const sampleRoot = path.join(root, '测试文件夹');

const cases = [
  {
    name: '弓形',
    routeMode: 'zigzag',
    expectedSingleLineEnable: '0',
    expectedCounts: [18, 10],
    maxAverageErrorMeters: 0.5,
    maxPointErrorMeters: 1
  },
  {
    name: '单子',
    routeMode: 'single',
    expectedSingleLineEnable: '1',
    expectedCounts: [9],
    maxAverageErrorMeters: 0.5,
    maxPointErrorMeters: 0.5
  }
];

const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

const parseCenterline = (sampleName) => {
  const template = readText(path.join(sampleRoot, sampleName, 'template.kml'));
  const block = template.match(/<LineString>[\s\S]*?<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/)?.[1] || '';
  return block.trim().split(/\s+/).filter(Boolean).map((raw, index) => {
    const [lng, lat] = raw.split(',').map(Number);
    return {
      lng,
      lat,
      regionId: 1,
      regionOrder: 1,
      pointOrder: index + 1
    };
  });
};

const parseGoldWaylines = (sampleName) => {
  const wpml = readText(path.join(sampleRoot, sampleName, 'waylines.wpml'));
  return parseWaylinesXml(wpml);
};

const parseWaylinesXml = (wpml) => {
  return [...wpml.matchAll(/<Folder>[\s\S]*?<wpml:waylineId>(\d+)<\/wpml:waylineId>[\s\S]*?<\/Folder>/g)]
    .map((match) => ({
      id: Number(match[1]),
      points: [...match[0].matchAll(/<Point>\s*<coordinates>\s*([\d.-]+),([\d.-]+)/g)]
        .map((coordMatch) => ({
          lng: Number(coordMatch[1]),
          lat: Number(coordMatch[2])
        }))
    }));
};

const parseHeadingAngles = (wpml) => [...wpml.matchAll(/<wpml:waypointHeadingAngle>([^<]+)<\/wpml:waypointHeadingAngle>/g)]
  .map((match) => Number(match[1]));

const parseExecuteHeightModes = (wpml) => [...wpml.matchAll(/<wpml:executeHeightMode>([^<]+)<\/wpml:executeHeightMode>/g)]
  .map((match) => match[1]);

const parseExecuteHeights = (wpml) => [...wpml.matchAll(/<wpml:executeHeight>([^<]+)<\/wpml:executeHeight>/g)]
  .map((match) => Number(match[1]));

const parseWaypointTurnParams = (wpml) => [...wpml.matchAll(/<Placemark>[\s\S]*?<Point>\s*<coordinates>\s*([\d.-]+),([\d.-]+)[\s\S]*?<wpml:waypointTurnMode>([^<]+)<\/wpml:waypointTurnMode>\s*<wpml:waypointTurnDampingDist>([^<]+)<\/wpml:waypointTurnDampingDist>[\s\S]*?<\/Placemark>/g)]
  .map((match) => ({
    lng: Number(match[1]),
    lat: Number(match[2]),
    turnMode: match[3],
    turnDampingDist: Number(match[4])
  }));

const stripXml = (value) => String(value || '').replace(/\s+/g, '');

const parseTemplateLineString = (templateKml) => {
  const block = templateKml.match(/<LineString>[\s\S]*?<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/)?.[1] || '';
  return block.trim().split(/\s+/).filter(Boolean).map((raw) => {
    const [lng, lat] = raw.split(',').map(Number);
    return { lng, lat };
  });
};

const groupByWayline = (waypoints) => {
  const groups = new Map();
  waypoints.forEach((waypoint) => {
    const group = groups.get(waypoint.waylineId) || [];
    group.push(waypoint);
    groups.set(waypoint.waylineId, group);
  });
  return [...groups.entries()].map(([id, points]) => ({ id, points }));
};

const assertCondition = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertValidYawAngles = (label, wpml) => {
  const headings = parseHeadingAngles(wpml);
  assertCondition(headings.length > 0, `${label}: no waypointHeadingAngle values found`);
  headings.forEach((heading, index) => {
    assertCondition(Number.isFinite(heading), `${label}: heading ${index} is not finite`);
    assertCondition(
      heading >= -179.999999 && heading <= 179.999999,
      `${label}: heading ${index} out of DJI yaw range (${heading})`
    );
  });
};

const assertValidTurnDampingDistances = (label, wpml) => {
  const folders = [...wpml.matchAll(/<Folder>[\s\S]*?<wpml:waylineId>\d+<\/wpml:waylineId>[\s\S]*?<\/Folder>/g)];
  assertCondition(folders.length > 0, `${label}: no wayline folders found`);

  folders.forEach((folderMatch, folderIndex) => {
    const waypoints = parseWaypointTurnParams(folderMatch[0]);
    assertCondition(waypoints.length > 0, `${label}: folder ${folderIndex} has no waypoint turn params`);

    waypoints.forEach((waypoint, index) => {
      assertCondition(Number.isFinite(waypoint.turnDampingDist), `${label}: damping ${index} is not finite`);
      assertCondition(waypoint.turnDampingDist >= 0, `${label}: damping ${index} is negative`);

      if (index === 0 || index === waypoints.length - 1 || waypoint.turnMode !== 'coordinateTurn') {
        assertCondition(
          waypoint.turnDampingDist === 0,
          `${label}: stop turn ${index} should use zero damping, got ${waypoint.turnDampingDist}`
        );
        return;
      }

      const previousDistance = calculateDistance(waypoints[index - 1], waypoint);
      const nextDistance = calculateDistance(waypoint, waypoints[index + 1]);
      const maxSafeDamping = Math.min(previousDistance, nextDistance) / 3;
      assertCondition(
        waypoint.turnDampingDist <= maxSafeDamping + 0.001,
        `${label}: damping ${index} ${waypoint.turnDampingDist} exceeds safe value ${maxSafeDamping}`
      );
      assertCondition(
        waypoint.turnDampingDist <= 10,
        `${label}: damping ${index} exceeds DJI sample cap`
      );
    });
  });
};

for (const testCase of cases) {
  const centerline = parseCenterline(testCase.name);
  const missionConfig = {
    routeType: 'strip',
    aircraftModel: 'm4t',
    globalHeight: 156.25,
    globalSpeed: 10,
    stripRoute: {
      routeMode: testCase.routeMode,
      leftExtension: 50,
      rightExtension: 50,
      cuttingDistance: 1000,
      overlap: 70,
      overlapLongitudinal: 80,
      cameraTypes: ['visible', 'infrared'],
      regionIds: [1],
      activeRegionId: 1,
      executeHeightMode: 'relativeToStartPoint'
    }
  };
  const appCenterline = centerline.map((point) => {
    const gcj02 = wgs84ToGcj02(point.lng, point.lat);
    return {
      ...point,
      lng: gcj02.lng,
      lat: gcj02.lat
    };
  });
  const result = generateStripRoute(appCenterline, {
    ...missionConfig.stripRoute,
    aircraftModel: missionConfig.aircraftModel,
    height: missionConfig.globalHeight,
    speed: missionConfig.globalSpeed
  });
  const generatedGroups = groupByWayline(result.waypoints.map((point) => {
    const wgs84 = gcj02ToWgs84(point.lng, point.lat);
    return {
      ...point,
      lng: wgs84.lng,
      lat: wgs84.lat
    };
  }));
  const goldGroups = parseGoldWaylines(testCase.name);
  const templateKml = generateStripTemplateKml(missionConfig, appCenterline);
  const waylinesWpml = generateStripWaylinesWpml(missionConfig, appCenterline);
  const exportedGroups = parseWaylinesXml(waylinesWpml);
  const exportedTemplateLine = parseTemplateLineString(templateKml);

  assertCondition(
    generatedGroups.length === testCase.expectedCounts.length,
    `${testCase.name}: expected ${testCase.expectedCounts.length} waylines, got ${generatedGroups.length}`
  );
  assertCondition(
    templateKml.includes(`<wpml:singleLineEnable>${testCase.expectedSingleLineEnable}</wpml:singleLineEnable>`),
    `${testCase.name}: singleLineEnable mismatch`
  );
  assertCondition(
    waylinesWpml.includes('<wpml:payloadLensIndex>visable,ir</wpml:payloadLensIndex>'),
    `${testCase.name}: missing visable,ir payloadLensIndex`
  );
  assertCondition(
    stripXml(templateKml).includes('<wpml:shootType>time</wpml:shootType>'),
    `${testCase.name}: default shootType should be time`
  );
  assertCondition(
    stripXml(waylinesWpml).includes('<wpml:actionTriggerType>multipleTiming</wpml:actionTriggerType><wpml:actionTriggerParam>2</wpml:actionTriggerParam>'),
    `${testCase.name}: default time photo trigger interval should be 2s`
  );
  assertValidYawAngles(`${testCase.name} exported`, waylinesWpml);
  assertValidTurnDampingDistances(`${testCase.name} exported`, waylinesWpml);
  assertCondition(
    exportedTemplateLine.length === centerline.length,
    `${testCase.name}: exported template centerline count mismatch`
  );

  exportedTemplateLine.forEach((point, index) => {
    const error = calculateDistance(point, centerline[index]);
    assertCondition(
      error <= 0.5,
      `${testCase.name}: exported template centerline ${index + 1} drift ${error.toFixed(2)}m`
    );
  });

  console.log(`CASE ${testCase.name} ${testCase.routeMode}`);
  generatedGroups.forEach((group, index) => {
    const expectedCount = testCase.expectedCounts[index];
    const gold = goldGroups[index];
    assertCondition(group.points.length === expectedCount, `${testCase.name} wayline ${group.id}: count mismatch`);
    assertCondition(gold?.points.length === expectedCount, `${testCase.name} gold wayline ${group.id}: count mismatch`);

    const distances = group.points.map((point, pointIndex) => calculateDistance(point, gold.points[pointIndex]));
    const averageError = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
    const maxError = Math.max(...distances);
    assertCondition(
      averageError <= testCase.maxAverageErrorMeters,
      `${testCase.name} wayline ${group.id}: average error ${averageError.toFixed(2)}m`
    );
    assertCondition(
      maxError <= testCase.maxPointErrorMeters,
      `${testCase.name} wayline ${group.id}: max error ${maxError.toFixed(2)}m`
    );
    console.log(`wayline ${group.id}: count=${group.points.length} avg=${averageError.toFixed(2)}m max=${maxError.toFixed(2)}m`);
  });

  exportedGroups.forEach((group, index) => {
    const gold = goldGroups[index];
    assertCondition(group.points.length === gold.points.length, `${testCase.name} exported wayline ${group.id}: count mismatch`);
    const distances = group.points.map((point, pointIndex) => calculateDistance(point, gold.points[pointIndex]));
    const averageError = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
    const maxError = Math.max(...distances);
    assertCondition(
      averageError <= testCase.maxAverageErrorMeters,
      `${testCase.name} exported wayline ${group.id}: average error ${averageError.toFixed(2)}m`
    );
    assertCondition(
      maxError <= testCase.maxPointErrorMeters,
      `${testCase.name} exported wayline ${group.id}: max error ${maxError.toFixed(2)}m`
    );
  });
}

const uShapeCenterline = [
  { lng: 104.39, lat: 31.092, regionId: 1, regionOrder: 1, pointOrder: 1 },
  { lng: 104.39, lat: 31.089, regionId: 1, regionOrder: 1, pointOrder: 2 },
  { lng: 104.396, lat: 31.089, regionId: 1, regionOrder: 1, pointOrder: 3 },
  { lng: 104.396, lat: 31.092, regionId: 1, regionOrder: 1, pointOrder: 4 }
];

const uShapeResult = generateStripRoute(uShapeCenterline, {
  routeMode: 'zigzag',
  leftExtension: 50,
  rightExtension: 50,
  cuttingDistance: 1000,
  overlap: 70,
  overlapLongitudinal: 80,
  cameraTypes: ['visible', 'infrared'],
  height: 156.25,
  speed: 10,
  aircraftModel: 'm4t',
  regionIds: [1],
  activeRegionId: 1
});
const uShapeFirstWayline = groupByWayline(uShapeResult.waypoints)[0]?.points || [];
const uShapeWaylines = groupByWayline(uShapeResult.waypoints);

assertCondition(
  uShapeWaylines.length === 1,
  `U-shape turn regression: expected continuous single preview wayline, got ${uShapeWaylines.length}`
);
assertCondition(
  uShapeFirstWayline.length >= 8,
  `U-shape turn regression: generated too few points (${uShapeFirstWayline.length})`
);
console.log(`CASE U形转弯 continuous waylines=${uShapeWaylines.length} points=${uShapeFirstWayline.length}`);

const westboundCenterline = [
  { lng: 104.4, lat: 31.09, regionId: 1, regionOrder: 1, pointOrder: 1 },
  { lng: 104.39, lat: 31.09, regionId: 1, regionOrder: 1, pointOrder: 2 }
];

const westboundMissionConfig = {
  routeType: 'strip',
  aircraftModel: 'm4t',
  globalHeight: 156.25,
  globalSpeed: 10,
  stripRoute: {
    routeMode: 'zigzag',
    leftExtension: 50,
    rightExtension: 50,
    cuttingDistance: 1000,
    overlap: 70,
    overlapLongitudinal: 80,
    cameraTypes: ['visible', 'infrared'],
    regionIds: [1],
    activeRegionId: 1,
    executeHeightMode: 'relativeToStartPoint'
  }
};

const westboundWpml = generateStripWaylinesWpml(westboundMissionConfig, westboundCenterline);
assertValidYawAngles('westbound yaw regression', westboundWpml);
assertValidTurnDampingDistances('westbound turn damping regression', westboundWpml);
assertCondition(
  parseHeadingAngles(westboundWpml).some((heading) => heading < 0),
  'westbound yaw regression: expected westbound headings to be exported as negative DJI yaw values'
);
console.log('CASE 西向航向 yaw range ok');

const terrainHeightMissionConfig = {
  routeType: 'strip',
  aircraftModel: 'm4t',
  globalHeight: 70,
  globalSpeed: 10,
  takeOffPointLat: 31.09,
  takeOffPointLng: 104.39,
  takeOffPointHeight: 430,
  stripRoute: {
    routeMode: 'zigzag',
    leftExtension: 50,
    rightExtension: 50,
    cuttingDistance: 1000,
    overlap: 70,
    overlapLongitudinal: 80,
    cameraTypes: ['visible'],
    regionIds: [1],
    activeRegionId: 1,
    executeHeightMode: 'realTimeFollowSurface',
    realTimeFollowSurface: false
  }
};
const terrainCenterline = [
  { lng: 104.39, lat: 31.09, terrainHeight: 430, regionId: 1, regionOrder: 1, pointOrder: 1 },
  { lng: 104.391, lat: 31.09, terrainHeight: 432, regionId: 1, regionOrder: 1, pointOrder: 2 }
];
const terrainWpml = generateStripWaylinesWpml(terrainHeightMissionConfig, terrainCenterline);
assertCondition(
  parseExecuteHeightModes(terrainWpml).every((mode) => mode === 'WGS84'),
  'terrain height regression: expected WGS84 when terrain references are available'
);
assertCondition(
  parseExecuteHeights(terrainWpml).every((height) => height >= 500),
  'terrain height regression: expected executeHeight to include terrain height + relative flight height'
);

const noTerrainWpml = generateStripWaylinesWpml({
  ...terrainHeightMissionConfig,
  takeOffPointLat: null,
  takeOffPointLng: null,
  takeOffPointHeight: 0
}, terrainCenterline.map(({ terrainHeight, ...point }) => point));
assertCondition(
  parseExecuteHeightModes(noTerrainWpml).every((mode) => mode === 'relativeToStartPoint'),
  'terrain height fallback regression: expected relativeToStartPoint without terrain references'
);
assertCondition(
  parseExecuteHeights(noTerrainWpml).every((height) => Math.abs(height - 70) < 0.001),
  'terrain height fallback regression: expected executeHeight to stay relative flight height'
);

const zeroTerrainWpml = generateStripWaylinesWpml({
  ...terrainHeightMissionConfig,
  takeOffPointHeight: 0
}, terrainCenterline.map((point) => ({ ...point, terrainHeight: 0 })));
assertCondition(
  parseExecuteHeightModes(zeroTerrainWpml).every((mode) => mode === 'relativeToStartPoint'),
  'terrain height zero fallback regression: expected relativeToStartPoint when terrain sampling returns zero'
);
console.log('CASE 仿地高度 executeHeight ok');

const photoModeCenterline = [
  { lng: 104.39, lat: 31.09, regionId: 1, regionOrder: 1, pointOrder: 1 },
  { lng: 104.3915, lat: 31.09, regionId: 1, regionOrder: 1, pointOrder: 2 }
];
const distancePhotoMissionConfig = {
  routeType: 'strip',
  aircraftModel: 'm4t',
  globalHeight: 120,
  globalSpeed: 8,
  globalTransitionalSpeed: 6,
  finishAction: 'autoLand',
  flyToWaylineMode: 'pointToPoint',
  stripRoute: {
    routeMode: 'zigzag',
    leftExtension: 40,
    rightExtension: 40,
    cuttingDistance: 1000,
    overlap: 65,
    overlapLongitudinal: 75,
    routeDirection: 'vertical',
    cameraTypes: ['visible'],
    photoMode: 'distance',
    photoDistanceInterval: 25,
    elevationOptimization: false,
    edgeImageOptimization: true,
    includeCenterLine: true,
    executeHeightMode: 'relativeToStartPoint',
    regionIds: [1],
    activeRegionId: 1
  }
};
const distancePhotoTemplate = generateStripTemplateKml(distancePhotoMissionConfig, photoModeCenterline);
const distancePhotoWpml = generateStripWaylinesWpml(distancePhotoMissionConfig, photoModeCenterline);
const compactDistanceTemplate = stripXml(distancePhotoTemplate);
const compactDistanceWpml = stripXml(distancePhotoWpml);

assertCondition(compactDistanceTemplate.includes('<wpml:shootType>distance</wpml:shootType>'), 'distance photo export: shootType mismatch');
assertCondition(compactDistanceTemplate.includes('<wpml:direction>90</wpml:direction>'), 'route direction export: expected vertical direction angle 90');
assertCondition(compactDistanceTemplate.includes('<wpml:elevationOptimizeEnable>0</wpml:elevationOptimizeEnable>'), 'elevation optimization export mismatch');
assertCondition(compactDistanceTemplate.includes('<wpml:boundaryOptimEnable>1</wpml:boundaryOptimEnable>'), 'edge image optimization export mismatch');
assertCondition(compactDistanceTemplate.includes('<wpml:includeCenterEnable>1</wpml:includeCenterEnable>'), 'include centerline export mismatch');
assertCondition(compactDistanceWpml.includes('<wpml:finishAction>autoLand</wpml:finishAction>'), 'finish action export mismatch');
assertCondition(compactDistanceWpml.includes('<wpml:flyToWaylineMode>pointToPoint</wpml:flyToWaylineMode>'), 'climb mode export mismatch');
assertCondition(compactDistanceWpml.includes('<wpml:globalTransitionalSpeed>6</wpml:globalTransitionalSpeed>'), 'takeoff speed export mismatch');
assertCondition(compactDistanceWpml.includes('<wpml:autoFlightSpeed>8</wpml:autoFlightSpeed>'), 'global route speed export mismatch');
assertCondition(compactDistanceWpml.includes('<wpml:actionTriggerType>multipleDistance</wpml:actionTriggerType><wpml:actionTriggerParam>25</wpml:actionTriggerParam>'), 'distance photo export: trigger interval mismatch');
assertCondition(compactDistanceWpml.includes('<wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>'), 'distance photo export: missing takePhoto action');
assertCondition(!compactDistanceWpml.includes('<wpml:actionActuatorFunc>startTimeLapse</wpml:actionActuatorFunc>'), 'distance photo export: should not start time lapse');
console.log('CASE 拍照模式/高级参数 export ok');
