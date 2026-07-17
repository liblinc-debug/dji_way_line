import fs from 'fs';
import path from 'path';
import { generateStripRoute } from '../src/utils/stripRouteGenerator.js';

const base = path.resolve('D:/desktop/UAV/dji_way_line_business');
const sampleRoot = path.join(base, '测试文件夹');
const bowDir = fs.readdirSync(sampleRoot, { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.includes('弓形'));

if (!bowDir) {
  throw new Error('未找到弓形样例目录');
}

const template = fs.readFileSync(path.join(sampleRoot, bowDir.name, 'template.kml'), 'utf8');
const coordBlock = template.match(/<LineString>[\s\S]*?<coordinates>\s*([\s\S]*?)\s*<\/coordinates>[\s\S]*?<\/LineString>/)?.[1];

if (!coordBlock) {
  throw new Error('样例 template.kml 中未找到中心线');
}

const center = coordBlock.trim().split(/\s+/).map((item) => {
  const [lng, lat] = item.split(',').map(Number);
  return { lng, lat };
});

const result = generateStripRoute(center, {
  leftExtension: 50,
  rightExtension: 50,
  cuttingDistance: 1000,
  overlap: 70,
  overlapLongitudinal: 80,
  speed: 10,
  height: 156.25,
  aircraftModel: 'M4T',
  cameraTypes: ['visible'],
  routeMode: 'zigzag'
});

const groups = new Map();
for (const waypoint of result.waypoints) {
  if (!groups.has(waypoint.waylineId)) groups.set(waypoint.waylineId, []);
  groups.get(waypoint.waylineId).push(waypoint);
}

for (const [id, waypoints] of groups) {
  console.log('WAYLINE', id, 'COUNT', waypoints.length);
  waypoints.forEach((waypoint, index) => {
    console.log(index, waypoint.lng.toFixed(7), waypoint.lat.toFixed(7));
  });
}
