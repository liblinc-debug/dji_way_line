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
