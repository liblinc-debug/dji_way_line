const safeFilename = (value = 'wayline') => {
  const raw = String(value || 'wayline').trim();
  const sanitized = raw
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'wayline';
};

export const downloadWaylineBlob = (blob, missionName = 'wayline') => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(missionName)}.kmz`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const buildLocalWaylineResult = ({ missionName, missionId, updatedAt } = {}) => ({
  missionName,
  missionId,
  updatedAt: updatedAt || Date.now(),
  storage: 'local'
});
