const DEFAULT_ROUTE_LINKING = {
  autoMatch: true,
  modelCodes: [],
  requirements: []
}

const clone = (value) => JSON.parse(JSON.stringify(value || {}))

const normalizeRequirement = (item = {}) => ({
  key: String(item.key || '').trim(),
  op: ['eq', 'gte', 'in'].includes(item.op) ? item.op : 'eq',
  value: item.value
})

export const normalizeRouteLinking = (config = {}) => {
  const raw = config?.routeLinking || config?.linking || {}
  const next = {
    autoMatch: raw.autoMatch !== false,
    modelCodes: Array.isArray(raw.modelCodes) ? raw.modelCodes.map((v) => String(v).trim()).filter(Boolean) : [],
    requirements: Array.isArray(raw.requirements) ? raw.requirements.map(normalizeRequirement).filter((r) => r.key) : []
  }

  return {
    ...DEFAULT_ROUTE_LINKING,
    ...next
  }
}

export const deriveRequirementsFromMissionConfig = (config = {}) => {
  const req = []

  if (config?.shootPhoto || config?.recordVideo) {
    req.push({ key: 'supports_gimbal', op: 'eq', value: true })
  }

  if (config?.aiPatrol?.enabled || config?.scanSetting?.aiEnabled) {
    req.push({ key: 'supports_ai_patrol', op: 'eq', value: true })
  }

  return req
}

export const mergeDerivedRequirements = (config = {}) => {
  const linking = normalizeRouteLinking(config)
  const manual = linking.requirements
  const derived = deriveRequirementsFromMissionConfig(config)

  const map = new Map()
  for (const item of [...manual, ...derived]) {
    const key = `${item.key}:${item.op}:${JSON.stringify(item.value)}`
    map.set(key, item)
  }

  return {
    ...linking,
    requirements: [...map.values()]
  }
}

const compareReq = (caps, req) => {
  const current = caps?.[req.key]
  if (req.op === 'eq') return current === req.value
  if (req.op === 'gte') return Number(current) >= Number(req.value)
  if (req.op === 'in') {
    if (!Array.isArray(req.value)) return false
    return req.value.includes(current)
  }
  return false
}

export const checkRouteAircraftCompatibility = ({ mission, aircraft, modelCapabilitiesMap = {} }) => {
  const errors = []
  const status = String(aircraft?.status || '').toLowerCase()
  if (status !== 'online') {
    errors.push(status === 'maintenance' ? '飞机维护中' : '飞机离线')
  }

  const missionConfig = mission?.config || mission?.routeConfig || {}
  const linking = mergeDerivedRequirements(missionConfig)

  if (linking.modelCodes.length > 0 && !linking.modelCodes.includes(String(aircraft?.modelCode || ''))) {
    errors.push('机型不在航线绑定范围内')
  }

  const modelCode = String(aircraft?.modelCode || '')
  const caps = clone(modelCapabilitiesMap?.[modelCode] || {})
  for (const req of linking.requirements) {
    if (!compareReq(caps, req)) {
      errors.push(`能力不满足: ${req.key}`)
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    linking
  }
}

export const getMissionLinkingSummary = (mission) => {
  const cfg = mission?.config || mission?.routeConfig || {}
  const linking = mergeDerivedRequirements(cfg)
  return {
    modelCodes: linking.modelCodes,
    requirements: linking.requirements,
    autoMatch: linking.autoMatch
  }
}
