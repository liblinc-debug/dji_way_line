export const AIRCRAFT_SERIES = {
  m30: {
    id: 'm30',
    name: '经纬 M30 系列',
    models: [
      { id: 'm30', name: 'Matrice 30', droneEnumValue: 67, droneSubEnumValue: 0, payloadEnumValue: 52, payloadSubEnumValue: 0, payloadPositionIndex: 0 },
      { id: 'm30t', name: 'Matrice 30T', droneEnumValue: 67, droneSubEnumValue: 1, payloadEnumValue: 53, payloadSubEnumValue: 0, payloadPositionIndex: 0 }
    ]
  },
  m3e: {
    id: 'm3e',
    name: 'Mavic 3 行业系列',
    models: [
      { id: 'm3e', name: 'Mavic 3E', droneEnumValue: 77, droneSubEnumValue: 0, payloadEnumValue: 66, payloadSubEnumValue: 0, payloadPositionIndex: 0 },
      { id: 'm3t', name: 'Mavic 3T', droneEnumValue: 77, droneSubEnumValue: 1, payloadEnumValue: 67, payloadSubEnumValue: 0, payloadPositionIndex: 0 },
      { id: 'm3m', name: 'Mavic 3M', droneEnumValue: 77, droneSubEnumValue: 2, payloadEnumValue: 68, payloadSubEnumValue: 0, payloadPositionIndex: 0 }
    ]
  },
  m3d: {
    id: 'm3d',
    name: 'Matrice 3D 系列',
    models: [
      { id: 'm3d', name: 'Matrice 3D', droneEnumValue: 91, droneSubEnumValue: 0, payloadEnumValue: 80, payloadSubEnumValue: 0, payloadPositionIndex: 0 },
      { id: 'm3td', name: 'Matrice 3TD', droneEnumValue: 91, droneSubEnumValue: 1, payloadEnumValue: 81, payloadSubEnumValue: 2, payloadPositionIndex: 0 }
    ]
  },
  m4e: {
    id: 'm4e',
    name: 'Matrice 4 行业系列',
    models: [
      { id: 'm4e', name: 'Matrice 4E', droneEnumValue: 99, droneSubEnumValue: 0, payloadEnumValue: 88, payloadSubEnumValue: 0, payloadPositionIndex: 0 },
      { id: 'm4t', name: 'Matrice 4T', droneEnumValue: 99, droneSubEnumValue: 1, payloadEnumValue: 89, payloadSubEnumValue: 2, payloadPositionIndex: 0 }
    ]
  },
  m4d: {
    id: 'm4d',
    name: 'Matrice 4D 系列',
    models: [
      { id: 'm4d', name: 'Matrice 4D', droneEnumValue: 100, droneSubEnumValue: 0, payloadEnumValue: 98, payloadSubEnumValue: 0, payloadPositionIndex: 0 },
      { id: 'm4td', name: 'Matrice 4TD', droneEnumValue: 100, droneSubEnumValue: 1, payloadEnumValue: 99, payloadSubEnumValue: 0, payloadPositionIndex: 0 }
    ]
  },
  m400: {
    id: 'm400',
    name: 'Matrice 400',
    models: [
      { id: 'm400', name: 'Matrice 400', droneEnumValue: 103, droneSubEnumValue: 0, payloadEnumValue: 0, payloadSubEnumValue: 0, payloadPositionIndex: 0 }
    ]
  }
};

export const AIRCRAFT_MODEL_META = Object.values(AIRCRAFT_SERIES)
  .flatMap((series) => series.models.map((model) => ({
    ...model,
    aircraftSeries: series.id,
    aircraftSeriesName: series.name
  })))
  .reduce((accumulator, model) => {
    accumulator[model.id] = model;
    return accumulator;
  }, {});

export const AIRCRAFT_SERIES_LIST = Object.values(AIRCRAFT_SERIES).map(({ id, name }) => ({ id, name }));

export const LEGACY_AIRCRAFT_SERIES_LIST = [
  { id: 'm30', name: '\u7ecf\u7eac M30 \u7cfb\u5217' },
  { id: 'm3e', name: 'Mavic 3 \u884c\u4e1a\u7cfb\u5217' },
  { id: 'm3d', name: 'Matrice 3D \u7cfb\u5217' },
  { id: 'm4e', name: 'Matrice 4 \u884c\u4e1a\u7cfb\u5217' },
  { id: 'm4d', name: 'Matrice 4D \u7cfb\u5217' },
  { id: 'm400', name: 'Matrice 400' }
];

const V2_REFERENCE_M30_EXPORT_META = {
  droneEnumValue: 67,
  droneSubEnumValue: 0,
  payloadEnumValue: 52,
  payloadSubEnumValue: 0,
  payloadPositionIndex: 0
};

const V2_REFERENCE_M3TD_EXPORT_META = {
  droneEnumValue: 91,
  droneSubEnumValue: 1,
  payloadEnumValue: 81,
  payloadSubEnumValue: 2,
  payloadPositionIndex: 0
};

export const AIRCRAFT_MODEL_BY_ENUM_KEY = {
  '67:0:52:0': 'm30',
  '67:1:53:0': 'm30t',
  '77:0:66:0': 'm3e',
  '77:1:67:0': 'm3t',
  '77:2:68:0': 'm3m',
  '91:0:80:0': 'm3d',
  '91:1:81:0': 'm3td',
  '91:1:81:2': 'm3td',
  '99:0:88:0': 'm4e',
  '99:1:89:0': 'm4t',
  '99:1:89:2': 'm4t',
  '100:0:98:0': 'm4d',
  '100:1:99:0': 'm4td',
  '103:0:0:0': 'm400',
  // Backward compatibility for older locally exported missions.
  '90:0:80:0': 'm3d',
  '90:1:81:0': 'm3td',
  '100:0:90:0': 'm4d',
  '100:1:91:0': 'm4td',
  '100:1:91:2': 'm4td',
  '100:1:99:2': 'm4td',
  '101:0:90:0': 'm4d',
  '101:0:98:0': 'm4d',
  '100:0:0:0': 'm400'
};

export const DRONE_NAME_BY_ENUM_KEY = {
  '67:0': 'Matrice 30',
  '67:1': 'Matrice 30T',
  '77:0': 'Mavic 3E',
  '77:1': 'Mavic 3T',
  '77:2': 'Mavic 3M',
  '91:0': 'Matrice 3D',
  '91:1': 'Matrice 3TD',
  '99:0': 'Matrice 4E',
  '99:1': 'Matrice 4T',
  '100:0': 'Matrice 4D',
  '100:1': 'Matrice 4TD',
  '103:0': 'Matrice 400',
  // Backward compatibility for older local data.
  '90:0': 'Matrice 3D',
  '90:1': 'Matrice 3TD',
  '101:0': 'Matrice 4D'
};

export const getAircraftModelMeta = (aircraftModel) => AIRCRAFT_MODEL_META[String(aircraftModel || '').trim().toLowerCase()] || null;

export const getAircraftModelDisplayName = (aircraftModel) => {
  const meta = getAircraftModelMeta(aircraftModel);
  return meta?.name || '';
};

export const getLegacyAircraftModelDisplayName = (aircraftModel) => {
  const normalizedModel = String(aircraftModel || '').trim().toLowerCase();

  if (normalizedModel === 'm30') return '\u7ecf\u7eac M30';
  if (normalizedModel === 'm30t') return '\u7ecf\u7eac M30 T';
  if (normalizedModel === 'm3d') return 'Matrice 3D';
  if (normalizedModel === 'm3td') return 'm3td';
  if (['m3e', 'm3t', 'm3m'].includes(normalizedModel)) return 'Mavic 3 \u4f01\u4e1a\u7248';
  if (normalizedModel === 'm4e') return 'M4E';
  if (normalizedModel === 'm4t') return 'M4T';
  if (normalizedModel === 'm4d') return 'M4D';
  if (normalizedModel === 'm4td') return 'M4TD';
  if (normalizedModel === 'm400') return 'Matrice 400';

  return getAircraftModelDisplayName(aircraftModel);
};

export const getLegacyAircraftModelOptions = (seriesId, routeType = 'waypoint') => {
  const normalizedSeriesId = String(seriesId || '').trim().toLowerCase();
  const normalizedRouteType = String(routeType || '').trim().toLowerCase();

  switch (normalizedSeriesId) {
    case 'm30':
      return [
        { key: 'm30', label: '\u7ecf\u7eac M30', modelId: 'm30' },
        { key: 'm30t', label: '\u7ecf\u7eac M30 T', modelId: 'm30t' }
      ];
    case 'm3e':
      return [
        {
          key: 'mavic3-enterprise',
          label: 'Mavic 3 \u4f01\u4e1a\u7248',
          modelId: normalizedRouteType === 'patrol' ? 'm3t' : 'm3e'
        }
      ];
    case 'm3d':
      return [
        { key: 'm3d', label: 'Matrice 3D', modelId: 'm3d' },
        { key: 'm3td', label: 'm3td', modelId: 'm3td' }
      ];
    case 'm4e':
      return [
        { key: 'm4e', label: 'M4E', modelId: 'm4e' },
        { key: 'm4t', label: 'M4T', modelId: 'm4t' }
      ];
    case 'm4d':
      return [
        { key: 'm4d', label: 'M4D', modelId: 'm4d' },
        { key: 'm4td', label: 'M4TD', modelId: 'm4td' }
      ];
    case 'm400':
      return [
        { key: 'm400', label: 'Matrice 400', modelId: 'm400' }
      ];
    default:
      return [];
  }
};

export const getV2CompatibleWaypointExportMeta = (aircraftModel) => {
  const normalizedModel = String(aircraftModel || '').trim().toLowerCase();

  if (normalizedModel.includes('m30')) {
    return { ...V2_REFERENCE_M30_EXPORT_META };
  }

  if (normalizedModel.includes('matrice 3d') || normalizedModel.includes('m3d') || normalizedModel.includes('m3td')) {
    return { ...V2_REFERENCE_M3TD_EXPORT_META };
  }

  return { ...V2_REFERENCE_M3TD_EXPORT_META };
};

export const getDroneDisplayName = (droneEnumValue, droneSubEnumValue = null) => {
  const normalizedDroneEnumValue = Number(droneEnumValue);
  const normalizedDroneSubEnumValue = Number(droneSubEnumValue);
  if (!Number.isFinite(normalizedDroneEnumValue)) return '未知机型';

  const exactKey = Number.isFinite(normalizedDroneSubEnumValue)
    ? `${normalizedDroneEnumValue}:${normalizedDroneSubEnumValue}`
    : null;

  if (exactKey && DRONE_NAME_BY_ENUM_KEY[exactKey]) {
    return DRONE_NAME_BY_ENUM_KEY[exactKey];
  }

  const fallbackKey = Object.keys(DRONE_NAME_BY_ENUM_KEY)
    .find((key) => key.startsWith(`${normalizedDroneEnumValue}:`));

  return fallbackKey ? DRONE_NAME_BY_ENUM_KEY[fallbackKey] : '未知机型';
};
