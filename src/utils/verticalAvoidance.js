const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const appendProfilePoint = (target, sample, altitude, stage, groupIndex = null) => {
  const resolvedAltitude = finiteNumber(altitude, finiteNumber(sample.baselineAltitude));
  const previous = target[target.length - 1];
  if (
    previous
    && previous.sampleIndex === sample.sampleIndex
    && Math.abs(previous.altitude - resolvedAltitude) < 0.01
  ) {
    return;
  }
  target.push({
    ...sample,
    altitude: resolvedAltitude,
    stage,
    groupIndex
  });
};

const mergeExpandedObstacleGroups = (groups) => {
  const merged = [];
  groups.forEach((group) => {
    const previous = merged[merged.length - 1];
    if (previous && group.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, group.end);
      previous.obstacleStart = Math.min(previous.obstacleStart, group.obstacleStart);
      previous.obstacleEnd = Math.max(previous.obstacleEnd, group.obstacleEnd);
      return;
    }
    merged.push({ ...group });
  });
  return merged;
};

/**
 * 将逐点抬升的避障剖面转换为严格的“直上 -> 平飞 -> 直下”航迹。
 * samples 必须按航线顺序提供，并带有累计水平距离、规划高度和障碍表面高度。
 */
export const buildVerticalAvoidanceProfile = (samples = [], options = {}) => {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { points: [], obstacleSampleCount: 0, avoidanceSegmentCount: 0, maxAltitudeAdjustment: 0 };
  }

  const clearance = Math.max(2, finiteNumber(options.verticalClearance, 10));
  const fixedClimbHeight = Math.max(5, finiteNumber(options.fixedClimbHeight, 20));
  const lookaheadDistance = Math.max(0, finiteNumber(options.lookaheadDistance, 20));
  const altitudeMode = options.altitudeMode === 'fixed' ? 'fixed' : 'auto';
  const normalizedSamples = samples.map((sample, sampleIndex) => ({
    ...sample,
    sampleIndex,
    distance: Math.max(0, finiteNumber(sample.distance)),
    baselineAltitude: finiteNumber(sample.baselineAltitude),
    surfaceHeight: finiteNumber(sample.surfaceHeight)
  }));
  const blocked = normalizedSamples.map((sample) => (
    sample.surfaceHeight + clearance > sample.baselineAltitude + 0.05
  ));

  const rawGroups = [];
  for (let index = 0; index < blocked.length; index += 1) {
    if (!blocked[index]) continue;
    const obstacleStart = index;
    while (index + 1 < blocked.length && blocked[index + 1]) index += 1;
    const obstacleEnd = index;
    const startDistance = normalizedSamples[obstacleStart].distance - lookaheadDistance;
    const endDistance = normalizedSamples[obstacleEnd].distance + lookaheadDistance;
    let start = obstacleStart;
    let end = obstacleEnd;
    while (start > 0 && normalizedSamples[start - 1].distance >= startDistance) start -= 1;
    while (end + 1 < normalizedSamples.length && normalizedSamples[end + 1].distance <= endDistance) end += 1;
    rawGroups.push({ start, end, obstacleStart, obstacleEnd });
  }

  const groups = mergeExpandedObstacleGroups(rawGroups);
  if (groups.length === 0) {
    return {
      points: normalizedSamples.map((sample) => ({
        ...sample,
        altitude: sample.baselineAltitude,
        stage: 'planned',
        groupIndex: null
      })),
      obstacleSampleCount: 0,
      avoidanceSegmentCount: 0,
      maxAltitudeAdjustment: 0
    };
  }

  const points = [];
  let cursor = 0;
  let maxAltitudeAdjustment = 0;

  groups.forEach((group, groupIndex) => {
    while (cursor < group.start) {
      const sample = normalizedSamples[cursor];
      appendProfilePoint(points, sample, sample.baselineAltitude, 'planned');
      cursor += 1;
    }

    const groupSamples = normalizedSamples.slice(group.start, group.end + 1);
    const obstacleSamples = normalizedSamples.slice(group.obstacleStart, group.obstacleEnd + 1);
    const highestBaseline = Math.max(...groupSamples.map(sample => sample.baselineAltitude));
    const requiredSafeAltitude = Math.max(...obstacleSamples.map(sample => sample.surfaceHeight)) + clearance;
    const requestedFixedAltitude = highestBaseline + fixedClimbHeight;
    const cruiseAltitude = altitudeMode === 'fixed'
      ? Math.max(requestedFixedAltitude, requiredSafeAltitude)
      : Math.max(highestBaseline, requiredSafeAltitude);

    const entry = normalizedSamples[group.start];
    appendProfilePoint(points, entry, entry.baselineAltitude, 'climb-start', groupIndex);
    appendProfilePoint(points, entry, cruiseAltitude, 'climb-end', groupIndex);

    for (let index = group.start + 1; index <= group.end; index += 1) {
      appendProfilePoint(points, normalizedSamples[index], cruiseAltitude, 'overfly', groupIndex);
    }

    const exit = normalizedSamples[group.end];
    appendProfilePoint(points, exit, exit.baselineAltitude, 'descent-end', groupIndex);
    groupSamples.forEach((sample) => {
      maxAltitudeAdjustment = Math.max(
        maxAltitudeAdjustment,
        Math.max(0, cruiseAltitude - sample.baselineAltitude)
      );
    });
    cursor = group.end + 1;
  });

  while (cursor < normalizedSamples.length) {
    const sample = normalizedSamples[cursor];
    appendProfilePoint(points, sample, sample.baselineAltitude, 'planned');
    cursor += 1;
  }

  return {
    points,
    obstacleSampleCount: blocked.filter(Boolean).length,
    avoidanceSegmentCount: groups.length,
    maxAltitudeAdjustment
  };
};
