/**
 * 带状航线类型定义
 * Strip Route Type Definitions
 */

/**
 * 航线模式枚举
 * @typedef {'single' | 'zigzag'} RouteMode
 */

/**
 * 带状航线配置
 * @typedef {Object} StripRouteConfig
 * @property {number} leftExtension - 左侧扩展长度(米)
 * @property {number} rightExtension - 右侧扩展长度(米)
 * @property {number} cuttingDistance - 切割距离(米)
 * @property {RouteMode} routeMode - 航线模式
 * @property {number[]} regionIds - 测区顺序列表
 * @property {number|null} activeRegionId - 当前激活测区
 * @property {number} speed - 飞行速度(m/s)
 * @property {number} overlap - 旁向重叠率(%)
 * @property {number} overlapLongitudinal - 航向重叠率(%)
 * @property {number} angle - 航线角度(度)
 * @property {boolean} linkExtensions - 是否链接左右扩展长度
 * @property {string[]} cameraTypes - 镜头选择
 * @property {number} gsdVisible - 可见光 GSD
 * @property {number} gsdInfrared - 红外 GSD
 * @property {'parallel'|'vertical'} routeDirection - 航线方向
 * @property {string} executeHeightMode - 航点高度模式
 * @property {boolean} realTimeFollowSurface - 实时仿地
 * @property {string} dsmFile - DSM 文件名
 * @property {Uint8Array|ArrayBuffer|null} dsmResource - DSM 文件内容
 * @property {boolean} waitingTakeoffReference - 是否正在等待重设参考起飞点
 */

/**
 * 坐标点
 * @typedef {Object} Coordinate
 * @property {number} lat - 纬度
 * @property {number} lng - 经度
 * @property {number} [height] - 高度(可选)
 */

/**
 * 航点
 * @typedef {Object} Waypoint
 * @property {number} lat - 纬度
 * @property {number} lng - 经度
 * @property {number} height - 飞行高度(米)
 * @property {number} speed - 飞行速度(m/s)
 * @property {number} [heading] - 航向角(度)
 * @property {number} [index] - 航点索引
 * @property {Array} [actions] - 航点动作
 */

/**
 * 中心线
 * @typedef {Object} CenterLine
 * @property {string} id - 唯一标识
 * @property {string} name - 名称
 * @property {Coordinate[]} coordinates - 坐标点数组
 * @property {number} totalLength - 总长度(米)
 * @property {LineSegment[]} segments - 线段数组
 */

/**
 * 线段
 * @typedef {Object} LineSegment
 * @property {Coordinate} start - 起点
 * @property {Coordinate} end - 终点
 * @property {number} bearing - 方位角(度)
 * @property {number} length - 长度(米)
 */

/**
 * 航线生成结果
 * @typedef {Object} RouteResult
 * @property {Waypoint[]} waypoints - 航点数组
 * @property {RouteMetadata} metadata - 元数据
 * @property {RouteStatistics} statistics - 统计信息
 */

/**
 * 航线元数据
 * @typedef {Object} RouteMetadata
 * @property {string} id - 唯一标识
 * @property {string} name - 名称
 * @property {string} type - 类型
 * @property {Date} createdAt - 创建时间
 * @property {StripRouteConfig} config - 配置参数
 */

/**
 * 航线统计信息
 * @typedef {Object} RouteStatistics
 * @property {number} totalDistance - 总距离(米)
 * @property {number} estimatedFlightTime - 预计飞行时间(秒)
 * @property {number} waypointCount - 航点数量
 * @property {number} coverageArea - 覆盖面积(平方米)
 * @property {number} routeCount - 航线数量
 */

/**
 * 验证结果
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - 是否有效
 * @property {ValidationError[]} errors - 错误列表
 * @property {ValidationWarning[]} warnings - 警告列表
 */

/**
 * 验证错误
 * @typedef {Object} ValidationError
 * @property {string} field - 字段名
 * @property {string} message - 错误信息
 * @property {string} code - 错误代码
 */

/**
 * 验证警告
 * @typedef {Object} ValidationWarning
 * @property {string} field - 字段名
 * @property {string} message - 警告信息
 * @property {string} code - 警告代码
 */

/**
 * 错误类型枚举
 */
export const StripRouteErrorType = {
  INVALID_CENTER_LINE: 'INVALID_CENTER_LINE',
  INVALID_EXTENSION_LENGTH: 'INVALID_EXTENSION_LENGTH',
  INVALID_CUTTING_DISTANCE: 'INVALID_CUTTING_DISTANCE',
  ALTITUDE_TOO_LOW: 'ALTITUDE_TOO_LOW',
  GEOMETRY_CALCULATION_ERROR: 'GEOMETRY_CALCULATION_ERROR',
  WPML_GENERATION_ERROR: 'WPML_GENERATION_ERROR'
};

/**
 * 航线模式常量
 */
export const ROUTE_MODE = {
  SINGLE: 'single',
  ZIGZAG: 'zigzag'
};

/**
 * 航线方向常量
 */
export const DIRECTION_MODE = {
  PARALLEL: 'parallel',    // 平行中心线
  VERTICAL: 'vertical'     // 垂直于中心线
};


/**
 * 默认配置
 */
export const DEFAULT_STRIP_CONFIG = {
  leftExtension: 50,
  rightExtension: 50,
  cuttingDistance: 1000,
  routeMode: ROUTE_MODE.ZIGZAG,  // 默认弓字航线
  regionIds: [1],
  activeRegionId: 1,
  speed: 10,  // 默认 10 m/s
  overlap: 70,  // 旁向重叠率
  overlapLongitudinal: 80,  // 航向重叠率
  angle: 0,
  margin: 0,
  linkExtensions: true,
  cameraTypes: ['visible'],  // 改为数组，默认选择可见光
  gsdVisible: 5,
  gsdInfrared: 14.06,
  routeDirection: DIRECTION_MODE.PARALLEL, // 默认平行
  elevationOptimization: true,
  edgeImageOptimization: false,
  includeCenterLine: false,  // 是否强制包含中心线
  photoMode: 'time',
  photoInterval: 2,
  photoDistanceInterval: 10,
  executeHeightMode: 'relativeToStartPoint',
  realTimeFollowSurface: false,
  dsmFile: '',
  dsmResource: null,
  waitingTakeoffReference: false
};


/**
 * 参数限制
 */
export const STRIP_ROUTE_LIMITS = {
  MIN_EXTENSION: 5,
  MAX_EXTENSION: 500,
  MIN_CUTTING_DISTANCE: 50,
  MAX_CUTTING_DISTANCE: 5000,
  MIN_ALTITUDE: 20,
  MAX_ALTITUDE: 500,
  MIN_SPEED: 1,
  MAX_SPEED: 15,
  MIN_OVERLAP: 0,
  MAX_OVERLAP: 90,
  MIN_CENTER_LINE_POINTS: 2,
  MAX_CENTER_LINE_POINTS: 100
};
