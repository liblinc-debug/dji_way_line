import JSZip from 'jszip';

const safeFilename = (value = 'wayline') => {
  const raw = String(value || 'wayline').trim();
  const sanitized = raw
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'wayline';
};

const downloadBlob = (blob, missionName, extension) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(missionName)}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadWaylineBlob = (blob, missionName = 'wayline') => {
  downloadBlob(blob, missionName, 'kmz');
};

export const buildWaylineJsonDocument = (mission = {}) => {
  const serializedMission = JSON.parse(JSON.stringify(mission || {}));
  return {
    format: 'uav-task-wayline',
    version: 1,
    coordinateSystem: 'WGS84',
    exportedAt: new Date().toISOString(),
    mission: serializedMission
  };
};

export const downloadWaylineJson = (mission = {}, missionName = 'wayline') => {
  const document = buildWaylineJsonDocument(mission);
  const content = JSON.stringify(document, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, missionName || mission?.name, 'json');
};

export const buildLocalWaylineResult = ({ missionName, missionId, updatedAt } = {}) => ({
  missionName,
  missionId,
  updatedAt: updatedAt || Date.now(),
  storage: 'local'
});

const fileBaseName = (name = '导入航线') => String(name).replace(/\.(kmz|json)$/i, '') || '导入航线';

const xmlText = (element, localName) => {
  if (!element) return '';
  return Array.from(element.getElementsByTagName('*'))
    .find(node => node.localName === localName)?.textContent?.trim() || '';
};

const numberFromXml = (element, localName, fallback = 0) => {
  const value = Number(xmlText(element, localName));
  return Number.isFinite(value) ? value : fallback;
};

const parseWpmlAction = (actionElement, waypointIndex, actionIndex) => {
  const actuator = xmlText(actionElement, 'actionActuatorFunc');
  const typeMap = {
    takePhoto: 'takePhoto', startRecord: 'startRecord', stopRecord: 'stopRecord',
    gimbalRotate: 'gimbalPitch', rotateYaw: 'aircraftYaw', hover: 'hover', zoom: 'zoom',
    startIntervalShot: 'startTimedPhoto', startDistanceIntervalShot: 'startDistancePhoto',
    stopIntervalShot: 'stopIntervalPhoto', panoShot: 'panorama'
  };
  const type = typeMap[actuator];
  if (!type) return null;
  const params = {};
  const parameterMap = {
    payloadPositionIndex: 'payloadPositionIndex', gimbalPitchRotateAngle: 'gimbalPitchRotateAngle',
    aircraftHeading: 'aircraftYawAngle', hoverTime: 'hoverTime', photoInterval: 'photoInterval',
    photoDistanceInterval: 'photoDistanceInterval'
  };
  Object.entries(parameterMap).forEach(([tag, key]) => {
    const raw = xmlText(actionElement, tag);
    if (raw !== '' && Number.isFinite(Number(raw))) params[key] = Number(raw);
  });
  const focalLength = numberFromXml(actionElement, 'focalLength', 0);
  if (type === 'zoom' && focalLength > 0) params.zoomFactor = focalLength / 24;
  return { id: `import-${waypointIndex}-${actionIndex}`, type, params };
};

const parseKmzMission = async (file) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const wpmlEntry = zip.file('wpmz/waylines.wpml') || zip.file(/waylines\.wpml$/i)[0]
    || zip.file('wpmz/template.kml') || zip.file(/template\.kml$/i)[0];
  if (!wpmlEntry) throw new Error('KMZ 中缺少 wpmz/waylines.wpml 或 template.kml');
  const xml = await wpmlEntry.async('string');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parserError = document.querySelector('parsererror');
  if (parserError) throw new Error('KMZ 航线 XML 无法解析');

  const executeHeightModeMap = {
    EGM96: 'WGS84', relativeToStartPoint: 'relativeToStartPoint',
    realTimeFollowSurface: 'realTimeFollowSurface'
  };
  const placemarks = Array.from(document.getElementsByTagNameNS('*', 'Placemark'));
  const waypoints = placemarks.map((placemark, fallbackIndex) => {
    const coordinates = xmlText(placemark, 'coordinates').split(',').map(Number);
    if (coordinates.length < 2 || !coordinates.slice(0, 2).every(Number.isFinite)) return null;
    const index = numberFromXml(placemark, 'index', fallbackIndex);
    const actionElements = Array.from(placemark.getElementsByTagNameNS('*', 'action'));
    const actions = actionElements.map((action, actionIndex) => parseWpmlAction(action, index, actionIndex)).filter(Boolean);
    return {
      index,
      lng: coordinates[0],
      lat: coordinates[1],
      height: numberFromXml(placemark, 'executeHeight', numberFromXml(placemark, 'height', coordinates[2] || 70)),
      speed: numberFromXml(placemark, 'waypointSpeed', numberFromXml(document, 'autoFlightSpeed', 5)),
      headingMode: xmlText(placemark, 'waypointHeadingMode') || 'followWayline',
      headingAngle: numberFromXml(placemark, 'waypointHeadingAngle', 0),
      actions
    };
  }).filter(Boolean).sort((a, b) => a.index - b.index);
  if (!waypoints.length) throw new Error('KMZ 中没有可导入的航点');

  const name = fileBaseName(file.name);
  const executeHeightMode = executeHeightModeMap[xmlText(document, 'executeHeightMode') || xmlText(document, 'heightMode')]
    || 'relativeToStartPoint';
  return {
    name,
    config: {
      missionName: name,
      routeType: 'waypoint',
      coordinateSystem: 'WGS84',
      executeHeightMode,
      globalHeight: numberFromXml(document, 'globalHeight', waypoints[0].height),
      globalSpeed: numberFromXml(document, 'autoFlightSpeed', 5),
      takeOffSecurityHeight: numberFromXml(document, 'takeOffSecurityHeight', 20),
      finishAction: xmlText(document, 'finishAction') || 'goHome'
    },
    waypoints
  };
};

const parseJsonMission = async (file) => {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (error) {
    throw new Error('JSON 文件格式无效');
  }
  const mission = parsed?.format === 'uav-task-wayline' ? parsed.mission : (parsed?.mission || parsed);
  if (!mission || typeof mission !== 'object' || !Array.isArray(mission.waypoints)) {
    throw new Error('JSON 中缺少航线 mission.waypoints 数据');
  }
  return JSON.parse(JSON.stringify(mission));
};

export const importWaylineFile = async (file) => {
  if (!file) throw new Error('请选择航线文件');
  if (/\.json$/i.test(file.name)) return parseJsonMission(file);
  if (/\.kmz$/i.test(file.name)) return parseKmzMission(file);
  throw new Error('仅支持 .kmz 或 .json 航线文件');
};
