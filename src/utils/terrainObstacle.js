export const DEFAULT_OBSTACLE_RELIEF_THRESHOLD_METERS = 2;

const finiteHeight = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

/**
 * 区分飞行走廊内的自然地形与高出地形的场景物体。
 * 调用方应尽量隔离 globe，仅采样 3D Tiles/场景物体；这里仍比较同一点的
 * 详细地形高度，过滤地表贴合面和采样误差。
 */
export const resolveCorridorHeightSample = (
  pointSamples = [],
  reliefThreshold = DEFAULT_OBSTACLE_RELIEF_THRESHOLD_METERS
) => {
  const centerTerrainHeight = finiteHeight(pointSamples[0]?.terrainHeight, 0);
  const threshold = Math.max(0, finiteHeight(
    reliefThreshold,
    DEFAULT_OBSTACLE_RELIEF_THRESHOLD_METERS
  ));
  const obstacleHeights = pointSamples
    .map((sample) => {
      const terrainHeight = finiteHeight(sample?.terrainHeight);
      const sceneHeight = finiteHeight(sample?.sceneHeight);
      if (terrainHeight === null || sceneHeight === null) return null;
      return sceneHeight - terrainHeight >= threshold ? sceneHeight : null;
    })
    .filter(height => height !== null);

  return {
    terrainHeight: centerTerrainHeight,
    // 无建筑时回落到中心线地形，使后续避障判断不会把侧坡当作障碍。
    surfaceHeight: Math.max(centerTerrainHeight, ...obstacleHeights),
    obstacleDetected: obstacleHeights.length > 0
  };
};
