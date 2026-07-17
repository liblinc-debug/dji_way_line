/**
 * 参数验证器
 * Parameter Validator for Strip Route Planning
 */

import { STRIP_ROUTE_LIMITS } from '../types/stripRoute.js';

/**
 * 验证扩展长度
 * @param {number} length - 扩展长度（米）
 * @param {string} side - 侧面标识（'left' 或 'right'）
 * @returns {Object} 验证结果 {isValid, errors, warnings}
 */
export const validateExtensionLength = (length, side = 'extension') => {
  const errors = [];
  const warnings = [];

  if (typeof length !== 'number' || isNaN(length)) {
    errors.push({
      field: side,
      message: '扩展长度必须是有效的数字',
      code: 'INVALID_TYPE'
    });
    return { isValid: false, errors, warnings };
  }

  if (length <= 0) {
    errors.push({
      field: side,
      message: '扩展长度必须大于0米',
      code: 'VALUE_TOO_SMALL'
    });
  }

  if (length < STRIP_ROUTE_LIMITS.MIN_EXTENSION) {
    errors.push({
      field: side,
      message: `扩展长度不能小于${STRIP_ROUTE_LIMITS.MIN_EXTENSION}米`,
      code: 'BELOW_MINIMUM'
    });
  }

  if (length > STRIP_ROUTE_LIMITS.MAX_EXTENSION) {
    errors.push({
      field: side,
      message: `扩展长度不能大于${STRIP_ROUTE_LIMITS.MAX_EXTENSION}米`,
      code: 'ABOVE_MAXIMUM'
    });
  }

  if (length > 200) {
    warnings.push({
      field: side,
      message: '扩展长度较大，建议检查飞行高度是否足够',
      code: 'LARGE_EXTENSION'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * 验证切割距离
 * @param {number} distance - 切割距离（米）
 * @returns {Object} 验证结果 {isValid, errors, warnings}
 */
export const validateCuttingDistance = (distance) => {
  const errors = [];
  const warnings = [];

  if (typeof distance !== 'number' || isNaN(distance)) {
    errors.push({
      field: 'cuttingDistance',
      message: '切割距离必须是有效的数字',
      code: 'INVALID_TYPE'
    });
    return { isValid: false, errors, warnings };
  }

  if (distance <= 0) {
    errors.push({
      field: 'cuttingDistance',
      message: '切割距离必须大于0米',
      code: 'VALUE_TOO_SMALL'
    });
  }

  if (distance < STRIP_ROUTE_LIMITS.MIN_CUTTING_DISTANCE) {
    errors.push({
      field: 'cuttingDistance',
      message: `切割距离不能小于${STRIP_ROUTE_LIMITS.MIN_CUTTING_DISTANCE}米`,
      code: 'BELOW_MINIMUM'
    });
  }

  if (distance > STRIP_ROUTE_LIMITS.MAX_CUTTING_DISTANCE) {
    errors.push({
      field: 'cuttingDistance',
      message: `切割距离不能大于${STRIP_ROUTE_LIMITS.MAX_CUTTING_DISTANCE}米`,
      code: 'ABOVE_MAXIMUM'
    });
  }

  if (distance < 100) {
    warnings.push({
      field: 'cuttingDistance',
      message: '切割距离较小，可能导致航点过多',
      code: 'SMALL_CUTTING_DISTANCE'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * 验证中心线
 * @param {Array} centerLine - 中心线坐标数组 [{lat, lng}]
 * @returns {Object} 验证结果 {isValid, errors, warnings}
 */
export const validateCenterLine = (centerLine) => {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(centerLine)) {
    errors.push({
      field: 'centerLine',
      message: '中心线必须是数组',
      code: 'INVALID_TYPE'
    });
    return { isValid: false, errors, warnings };
  }

  if (centerLine.length < STRIP_ROUTE_LIMITS.MIN_CENTER_LINE_POINTS) {
    errors.push({
      field: 'centerLine',
      message: `中心线至少需要${STRIP_ROUTE_LIMITS.MIN_CENTER_LINE_POINTS}个点`,
      code: 'TOO_FEW_POINTS'
    });
  }

  if (centerLine.length > STRIP_ROUTE_LIMITS.MAX_CENTER_LINE_POINTS) {
    errors.push({
      field: 'centerLine',
      message: `中心线点数不能超过${STRIP_ROUTE_LIMITS.MAX_CENTER_LINE_POINTS}个`,
      code: 'TOO_MANY_POINTS'
    });
  }

  // 验证每个点的格式
  for (let i = 0; i < centerLine.length; i++) {
    const point = centerLine[i];
    if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
      errors.push({
        field: 'centerLine',
        message: `第${i + 1}个点的坐标格式无效`,
        code: 'INVALID_COORDINATE'
      });
    }

    // 验证坐标范围
    if (point.lat < -90 || point.lat > 90) {
      errors.push({
        field: 'centerLine',
        message: `第${i + 1}个点的纬度超出范围（-90到90）`,
        code: 'LATITUDE_OUT_OF_RANGE'
      });
    }

    if (point.lng < -180 || point.lng > 180) {
      errors.push({
        field: 'centerLine',
        message: `第${i + 1}个点的经度超出范围（-180到180）`,
        code: 'LONGITUDE_OUT_OF_RANGE'
      });
    }
  }

  // 检查是否有重复点
  for (let i = 0; i < centerLine.length - 1; i++) {
    const p1 = centerLine[i];
    const p2 = centerLine[i + 1];
    if (p1.lat === p2.lat && p1.lng === p2.lng) {
      warnings.push({
        field: 'centerLine',
        message: `第${i + 1}和第${i + 2}个点重复`,
        code: 'DUPLICATE_POINTS'
      });
    }
  }

  if (centerLine.length > 50) {
    warnings.push({
      field: 'centerLine',
      message: '中心线点数较多，可能影响性能',
      code: 'MANY_POINTS'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * 验证飞行高度
 * @param {number} altitude - 飞行高度（米）
 * @param {number} maxExtension - 最大扩展长度（米）
 * @returns {Object} 验证结果 {isValid, errors, warnings}
 */
export const validateAltitude = (altitude, maxExtension = 0) => {
  const errors = [];
  const warnings = [];

  if (typeof altitude !== 'number' || isNaN(altitude)) {
    errors.push({
      field: 'altitude',
      message: '飞行高度必须是有效的数字',
      code: 'INVALID_TYPE'
    });
    return { isValid: false, errors, warnings };
  }

  if (altitude < STRIP_ROUTE_LIMITS.MIN_ALTITUDE) {
    errors.push({
      field: 'altitude',
      message: `飞行高度不能低于${STRIP_ROUTE_LIMITS.MIN_ALTITUDE}米`,
      code: 'BELOW_MINIMUM'
    });
  }

  if (altitude > STRIP_ROUTE_LIMITS.MAX_ALTITUDE) {
    errors.push({
      field: 'altitude',
      message: `飞行高度不能超过${STRIP_ROUTE_LIMITS.MAX_ALTITUDE}米`,
      code: 'ABOVE_MAXIMUM'
    });
  }

  // 计算最小安全高度（基于扩展长度）
  // 假设相机视场角约60度，最小高度 = 扩展长度 / tan(30度)
  const minSafeAltitude = maxExtension / Math.tan(30 * Math.PI / 180);

  if (altitude < minSafeAltitude) {
    errors.push({
      field: 'altitude',
      message: `当前扩展长度需要至少${Math.ceil(minSafeAltitude)}米的飞行高度`,
      code: 'ALTITUDE_TOO_LOW_FOR_EXTENSION'
    });
  }

  if (altitude > 300) {
    warnings.push({
      field: 'altitude',
      message: '飞行高度较高，请确保符合当地法规',
      code: 'HIGH_ALTITUDE'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * 验证飞行速度
 * @param {number} speed - 飞行速度（m/s）
 * @returns {Object} 验证结果 {isValid, errors, warnings}
 */
export const validateSpeed = (speed) => {
  const errors = [];
  const warnings = [];

  if (typeof speed !== 'number' || isNaN(speed)) {
    errors.push({
      field: 'speed',
      message: '飞行速度必须是有效的数字',
      code: 'INVALID_TYPE'
    });
    return { isValid: false, errors, warnings };
  }

  if (speed < STRIP_ROUTE_LIMITS.MIN_SPEED) {
    errors.push({
      field: 'speed',
      message: `飞行速度不能低于${STRIP_ROUTE_LIMITS.MIN_SPEED}m/s`,
      code: 'BELOW_MINIMUM'
    });
  }

  if (speed > STRIP_ROUTE_LIMITS.MAX_SPEED) {
    errors.push({
      field: 'speed',
      message: `飞行速度不能超过${STRIP_ROUTE_LIMITS.MAX_SPEED}m/s`,
      code: 'ABOVE_MAXIMUM'
    });
  }

  if (speed > 10) {
    warnings.push({
      field: 'speed',
      message: '飞行速度较快，可能影响拍摄质量',
      code: 'HIGH_SPEED'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * 验证重叠率
 * @param {number} overlap - 重叠率（%）
 * @returns {Object} 验证结果 {isValid, errors, warnings}
 */
export const validateOverlap = (overlap) => {
  const errors = [];
  const warnings = [];

  if (typeof overlap !== 'number' || isNaN(overlap)) {
    errors.push({
      field: 'overlap',
      message: '重叠率必须是有效的数字',
      code: 'INVALID_TYPE'
    });
    return { isValid: false, errors, warnings };
  }

  if (overlap < STRIP_ROUTE_LIMITS.MIN_OVERLAP) {
    errors.push({
      field: 'overlap',
      message: `重叠率不能低于${STRIP_ROUTE_LIMITS.MIN_OVERLAP}%`,
      code: 'BELOW_MINIMUM'
    });
  }

  if (overlap > STRIP_ROUTE_LIMITS.MAX_OVERLAP) {
    errors.push({
      field: 'overlap',
      message: `重叠率不能超过${STRIP_ROUTE_LIMITS.MAX_OVERLAP}%`,
      code: 'ABOVE_MAXIMUM'
    });
  }

  if (overlap < 30) {
    warnings.push({
      field: 'overlap',
      message: '重叠率较低，可能影响拼接质量',
      code: 'LOW_OVERLAP'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * 验证完整配置
 * @param {Object} config - 带状航线配置
 * @param {Array} centerLine - 中心线坐标数组
 * @returns {Object} 验证结果 {isValid, errors, warnings}
 */
export const validateStripRouteConfig = (config, centerLine) => {
  const allErrors = [];
  const allWarnings = [];

  // 验证中心线
  const centerLineResult = validateCenterLine(centerLine);
  allErrors.push(...centerLineResult.errors);
  allWarnings.push(...centerLineResult.warnings);

  // 验证扩展长度
  const leftExtResult = validateExtensionLength(config.leftExtension, 'leftExtension');
  allErrors.push(...leftExtResult.errors);
  allWarnings.push(...leftExtResult.warnings);

  const rightExtResult = validateExtensionLength(config.rightExtension, 'rightExtension');
  allErrors.push(...rightExtResult.errors);
  allWarnings.push(...rightExtResult.warnings);

  // 验证切割距离
  const cuttingResult = validateCuttingDistance(config.cuttingDistance);
  allErrors.push(...cuttingResult.errors);
  allWarnings.push(...cuttingResult.warnings);

  // 验证飞行高度
  const maxExtension = Math.max(config.leftExtension || 0, config.rightExtension || 0);
  const altitudeResult = validateAltitude(config.altitude, maxExtension);
  allErrors.push(...altitudeResult.errors);
  allWarnings.push(...altitudeResult.warnings);

  // 验证飞行速度
  const speedResult = validateSpeed(config.speed);
  allErrors.push(...speedResult.errors);
  allWarnings.push(...speedResult.warnings);

  // 验证重叠率
  if (config.overlap !== undefined) {
    const overlapResult = validateOverlap(config.overlap);
    allErrors.push(...overlapResult.errors);
    allWarnings.push(...overlapResult.warnings);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
};

/**
 * 计算推荐的最小飞行高度
 * @param {number} maxExtension - 最大扩展长度（米）
 * @returns {number} 推荐的最小飞行高度（米）
 */
export const calculateMinimumAltitude = (maxExtension) => {
  // 假设相机视场角约60度，最小高度 = 扩展长度 / tan(30度)
  const minAltitude = maxExtension / Math.tan(30 * Math.PI / 180);
  // 向上取整到5的倍数
  return Math.ceil(minAltitude / 5) * 5;
};

export default {
  validateExtensionLength,
  validateCuttingDistance,
  validateCenterLine,
  validateAltitude,
  validateSpeed,
  validateOverlap,
  validateStripRouteConfig,
  calculateMinimumAltitude
};
