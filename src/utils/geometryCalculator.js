/**
 * 几何计算引擎
 * Geometry Calculator for Strip Route Planning
 */

// 地球半径（米）
const EARTH_RADIUS = 6378137;

/**
 * 计算两点之间的距离（Haversine公式）
 * @param {Object} from - 起点 {lat, lng}
 * @param {Object} to - 终点 {lat, lng}
 * @returns {number} 距离（米）
 */
export const calculateDistance = (from, to) => {
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const deltaLat = (to.lat - from.lat) * Math.PI / 180;
  const deltaLng = (to.lng - from.lng) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
};

/**
 * 计算方位角（从北顺时针）
 * @param {Object} from - 起点 {lat, lng}
 * @param {Object} to - 终点 {lat, lng}
 * @returns {number} 方位角（度，0-360）
 */
export const calculateBearing = (from, to) => {
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const deltaLng = (to.lng - from.lng) * Math.PI / 180;

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;

  return (bearing + 360) % 360;
};

/**
 * 根据起点、方位角和距离计算终点
 * @param {Object} point - 起点 {lat, lng}
 * @param {number} bearing - 方位角（度）
 * @param {number} distance - 距离（米）
 * @returns {Object} 终点 {lat, lng}
 */
export const calculateDestination = (point, bearing, distance) => {
  const lat1 = point.lat * Math.PI / 180;
  const lng1 = point.lng * Math.PI / 180;
  const bearingRad = bearing * Math.PI / 180;
  const angularDistance = distance / EARTH_RADIUS;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: lat2 * 180 / Math.PI,
    lng: lng2 * 180 / Math.PI
  };
};

/**
 * 计算垂直于给定方位角的平行线
 * @param {Object} point - 基准点 {lat, lng}
 * @param {number} bearing - 基准方位角（度）
 * @param {number} distance - 偏移距离（米，正数为右侧，负数为左侧）
 * @returns {Object} 平行线上的点 {lat, lng}
 */
export const calculatePerpendicularPoint = (point, bearing, distance) => {
  // 垂直方位角 = 基准方位角 + 90度
  const perpendicularBearing = (bearing + 90) % 360;
  return calculateDestination(point, perpendicularBearing, distance);
};

/**
 * 计算两条线段的交点
 * @param {Object} line1 - 第一条线段 {start: {lat, lng}, end: {lat, lng}}
 * @param {Object} line2 - 第二条线段 {start: {lat, lng}, end: {lat, lng}}
 * @returns {Object|null} 交点 {lat, lng} 或 null（无交点）
 */
export const calculateLineIntersection = (line1, line2) => {
  // 将经纬度转换为平面坐标（简化计算）
  const x1 = line1.start.lng;
  const y1 = line1.start.lat;
  const x2 = line1.end.lng;
  const y2 = line1.end.lat;
  const x3 = line2.start.lng;
  const y3 = line2.start.lat;
  const x4 = line2.end.lng;
  const y4 = line2.end.lat;

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // 平行或重合
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

  // 检查交点是否在两条线段上
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      lat: y1 + t * (y2 - y1),
      lng: x1 + t * (x2 - x1)
    };
  }

  return null;
};

/**
 * 平滑路径（使用简单的移动平均）
 * @param {Array} waypoints - 航点数组 [{lat, lng, ...}]
 * @param {number} smoothingFactor - 平滑因子（0-1，0表示不平滑）
 * @returns {Array} 平滑后的航点数组
 */
export const smoothPath = (waypoints, smoothingFactor = 0.3) => {
  if (waypoints.length < 3 || smoothingFactor <= 0) {
    return waypoints;
  }

  const smoothed = [waypoints[0]]; // 保持第一个点不变

  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];

    const smoothedLat = curr.lat * (1 - smoothingFactor) +
      (prev.lat + next.lat) / 2 * smoothingFactor;
    const smoothedLng = curr.lng * (1 - smoothingFactor) +
      (prev.lng + next.lng) / 2 * smoothingFactor;

    smoothed.push({
      ...curr,
      lat: smoothedLat,
      lng: smoothedLng
    });
  }

  smoothed.push(waypoints[waypoints.length - 1]); // 保持最后一个点不变

  return smoothed;
};

/**
 * 计算点到线段的最短距离
 * @param {Object} point - 点 {lat, lng}
 * @param {Object} lineStart - 线段起点 {lat, lng}
 * @param {Object} lineEnd - 线段终点 {lat, lng}
 * @returns {number} 距离（米）
 */
export const calculatePointToLineDistance = (point, lineStart, lineEnd) => {
  const A = point.lat - lineStart.lat;
  const B = point.lng - lineStart.lng;
  const C = lineEnd.lat - lineStart.lat;
  const D = lineEnd.lng - lineStart.lng;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let closestPoint;

  if (param < 0) {
    closestPoint = lineStart;
  } else if (param > 1) {
    closestPoint = lineEnd;
  } else {
    closestPoint = {
      lat: lineStart.lat + param * C,
      lng: lineStart.lng + param * D
    };
  }

  return calculateDistance(point, closestPoint);
};

/**
 * 计算中心线的总长度
 * @param {Array} centerLine - 中心线坐标数组 [{lat, lng}]
 * @returns {number} 总长度（米）
 */
export const calculateCenterLineLength = (centerLine) => {
  if (centerLine.length < 2) {
    return 0;
  }

  let totalLength = 0;
  for (let i = 0; i < centerLine.length - 1; i++) {
    totalLength += calculateDistance(centerLine[i], centerLine[i + 1]);
  }

  return totalLength;
};

/**
 * 将中心线分割成线段
 * @param {Array} centerLine - 中心线坐标数组 [{lat, lng}]
 * @returns {Array} 线段数组 [{start, end, bearing, length}]
 */
export const segmentCenterLine = (centerLine) => {
  if (centerLine.length < 2) {
    return [];
  }

  const segments = [];
  for (let i = 0; i < centerLine.length - 1; i++) {
    const start = centerLine[i];
    const end = centerLine[i + 1];
    const bearing = calculateBearing(start, end);
    const length = calculateDistance(start, end);

    segments.push({
      start,
      end,
      bearing,
      length
    });
  }

  return segments;
};

/**
 * 沿线段插值生成点
 * @param {Object} start - 起点 {lat, lng}
 * @param {Object} end - 终点 {lat, lng}
 * @param {number} interval - 间隔距离（米）
 * @returns {Array} 插值点数组 [{lat, lng}]
 */
export const interpolatePoints = (start, end, interval) => {
  const distance = calculateDistance(start, end);
  const bearing = calculateBearing(start, end);
  const points = [start];

  let currentDistance = interval;
  while (currentDistance < distance) {
    const point = calculateDestination(start, bearing, currentDistance);
    points.push(point);
    currentDistance += interval;
  }

  points.push(end);
  return points;
};

/**
 * 计算两个向量的夹角
 * @param {Object} v1 - 向量1 {lat, lng}
 * @param {Object} v2 - 向量2 {lat, lng}
 * @returns {number} 夹角（度，0-180）
 */
export const calculateAngleBetweenVectors = (v1, v2) => {
  const dot = v1.lat * v2.lat + v1.lng * v2.lng;
  const mag1 = Math.sqrt(v1.lat * v1.lat + v1.lng * v1.lng);
  const mag2 = Math.sqrt(v2.lat * v2.lat + v2.lng * v2.lng);

  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  const cosAngle = dot / (mag1 * mag2);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

  return angle * 180 / Math.PI;
};

/**
 * 检查点是否在多边形内（射线法）
 * @param {Object} point - 点 {lat, lng}
 * @param {Array} polygon - 多边形顶点数组 [{lat, lng}]
 * @returns {boolean} 是否在多边形内
 */
export const isPointInPolygon = (point, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
};

export default {
  calculateDistance,
  calculateBearing,
  calculateDestination,
  calculatePerpendicularPoint,
  calculateLineIntersection,
  smoothPath,
  calculatePointToLineDistance,
  calculateCenterLineLength,
  segmentCenterLine,
  interpolatePoints,
  calculateAngleBetweenVectors,
  isPointInPolygon
};
