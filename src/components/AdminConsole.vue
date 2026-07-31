<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { checkRouteAircraftCompatibility, getMissionLinkingSummary } from '../utils/routeLinking.js'

const apiBase = ref(localStorage.getItem('uav_task_api_base') || 'http://127.0.0.1:8090')
const loading = reactive({
  models: false,
  aircrafts: false,
  missions: false,
  dispatch: false,
  replay: false
})

const models = ref([])
const aircrafts = ref([])
const missions = ref([])
const dispatchEvents = ref([])
const dispatchReplay = ref(null)
const errorText = ref('')
const selectedModelCodes = ref([])
const selectedAircraftIds = ref([])

const modelForm = reactive({
  modelCode: '',
  modelName: '',
  vendor: '',
  supports_gimbal: true,
  supports_actuator: false
})

const aircraftForm = reactive({
  aircraftId: '',
  name: '',
  modelCode: '',
  ipAddr: '',
  status: 'offline'
})

const dispatchForm = reactive({
  missionId: '',
  aircraftId: '',
  route_id: '',
  dry_run: false,
  priority: 'P2',
  operator: 'ops',
  auto_filter_aircraft: true
})

const ackForm = reactive({
  dispatchId: '',
  correlationId: ''
})

const createdDispatch = ref(null)
const compatibleAircraftRows = ref([])
const incompatibleAircraftRows = ref([])

const modelCapabilitiesMap = computed(() => {
  const map = {}
  for (const m of models.value) {
    if (m?.modelCode) {
      map[m.modelCode] = m.capabilities || {}
    }
  }
  return map
})

const selectedMission = computed(() => missions.value.find((m) => m.missionId === dispatchForm.missionId) || null)

const missionLinkingSummary = computed(() => {
  if (!selectedMission.value) return null
  return getMissionLinkingSummary(selectedMission.value)
})

const aircraftOptionsForDispatch = computed(() => {
  if (!dispatchForm.auto_filter_aircraft) return aircrafts.value
  return compatibleAircraftRows.value
})

function recalcCompatibility() {
  if (!selectedMission.value) {
    compatibleAircraftRows.value = []
    incompatibleAircraftRows.value = []
    return
  }

  const okRows = []
  const badRows = []
  for (const aircraft of aircrafts.value) {
    const result = checkRouteAircraftCompatibility({
      mission: selectedMission.value,
      aircraft,
      modelCapabilitiesMap: modelCapabilitiesMap.value
    })
    if (result.ok) {
      okRows.push(aircraft)
    } else {
      badRows.push({
        aircraftId: aircraft.aircraftId,
        name: aircraft.name,
        modelCode: aircraft.modelCode,
        errors: result.errors
      })
    }
  }

  compatibleAircraftRows.value = okRows
  incompatibleAircraftRows.value = badRows

  if (dispatchForm.auto_filter_aircraft && dispatchForm.aircraftId) {
    const exists = okRows.some((a) => a.aircraftId === dispatchForm.aircraftId)
    if (!exists) {
      dispatchForm.aircraftId = ''
    }
  }
}

async function request(path, options = {}) {
  const resp = await fetch(`${apiBase.value}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(data.error || `HTTP ${resp.status}`)
  }
  return data
}

async function loadModels() {
  loading.models = true
  errorText.value = ''
  try {
    const data = await request('/models')
    models.value = data.items || []
  } catch (err) {
    errorText.value = err.message
  } finally {
    loading.models = false
    recalcCompatibility()
  }
}

async function loadAircrafts() {
  loading.aircrafts = true
  errorText.value = ''
  try {
    const data = await request('/aircrafts')
    aircrafts.value = data.items || []
  } catch (err) {
    errorText.value = err.message
  } finally {
    loading.aircrafts = false
    recalcCompatibility()
  }
}

async function loadMissions() {
  loading.missions = true
  errorText.value = ''
  try {
    const data = await request('/missions')
    missions.value = data.items || []
  } catch (err) {
    errorText.value = err.message
  } finally {
    loading.missions = false
    recalcCompatibility()
  }
}

async function createModel() {
  errorText.value = ''
  try {
    await request('/models', {
      method: 'POST',
      body: JSON.stringify({
        modelCode: modelForm.modelCode,
        modelName: modelForm.modelName,
        vendor: modelForm.vendor,
        capabilities: {
          supports_gimbal: modelForm.supports_gimbal,
          supports_actuator: modelForm.supports_actuator
        }
      })
    })
    await loadModels()
  } catch (err) {
    errorText.value = err.message
  }
}

function encodePathSegment(value) {
  return encodeURIComponent(String(value || ''))
}

function clearSelections() {
  selectedModelCodes.value = []
  selectedAircraftIds.value = []
}

function toggleModelSelection(modelCode, checked) {
  if (checked) {
    if (!selectedModelCodes.value.includes(modelCode)) {
      selectedModelCodes.value.push(modelCode)
    }
    return
  }
  selectedModelCodes.value = selectedModelCodes.value.filter((v) => v !== modelCode)
}

function toggleAircraftSelection(aircraftId, checked) {
  if (checked) {
    if (!selectedAircraftIds.value.includes(aircraftId)) {
      selectedAircraftIds.value.push(aircraftId)
    }
    return
  }
  selectedAircraftIds.value = selectedAircraftIds.value.filter((v) => v !== aircraftId)
}

function isAircraftDeleteLocked(item) {
  return String(item?.status || '').toLowerCase() === 'online'
}

async function replaceModelReferences(oldModelCode, newModelCode) {
  const relatedAircrafts = aircrafts.value.filter((a) => a.modelCode === oldModelCode)
  if (!relatedAircrafts.length) return

  await Promise.all(relatedAircrafts.map((a) => {
    const payload = {
      aircraftId: a.aircraftId,
      name: a.name,
      modelCode: newModelCode,
      ipAddr: a.ipAddr,
      status: a.status
    }
    return request(`/aircrafts/${encodePathSegment(a.aircraftId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  }))
}

async function deleteModelByCode(modelCode) {
  await request(`/models/${encodePathSegment(modelCode)}`, { method: 'DELETE' })
}

async function deleteAircraftById(aircraftId) {
  await request(`/aircrafts/${encodePathSegment(aircraftId)}`, { method: 'DELETE' })
}

function askConfirm(title, content) {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      okText: '确认',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    })
  })
}

async function removeModel(item) {
  const modelCode = item?.modelCode
  if (!modelCode) return

  errorText.value = ''
  try {
    const relatedAircrafts = aircrafts.value.filter((a) => a.modelCode === modelCode)
    if (relatedAircrafts.length) {
      const input = window.prompt(
        `机型 ${modelCode} 正被 ${relatedAircrafts.length} 架飞机引用。\n请输入替代机型编码后继续删除（取消则终止）：`
      )
      if (!input) return
      const replacementCode = String(input).trim()
      if (!replacementCode || replacementCode === modelCode) {
        message.error('替代机型编码无效')
        return
      }
      const replacementExists = models.value.some((m) => m.modelCode === replacementCode)
      if (!replacementExists) {
        message.error('替代机型不存在，请先创建')
        return
      }

      const confirmed = await askConfirm(
        '确认替换并删除',
        `将 ${relatedAircrafts.length} 架飞机从 ${modelCode} 替换为 ${replacementCode}，然后删除机型 ${modelCode}。`
      )
      if (!confirmed) return

      await replaceModelReferences(modelCode, replacementCode)
    } else {
      const confirmed = await askConfirm('确认删除机型', `删除后不可恢复：${modelCode}`)
      if (!confirmed) return
    }

    await deleteModelByCode(modelCode)
    message.success(`已删除机型 ${modelCode}`)
    await Promise.all([loadModels(), loadAircrafts()])
    clearSelections()
  } catch (err) {
    errorText.value = err.message
  }
}

async function batchRemoveModels() {
  if (!selectedModelCodes.value.length) {
    message.warning('请先勾选机型')
    return
  }

  const related = selectedModelCodes.value.filter((code) => aircrafts.value.some((a) => a.modelCode === code))
  if (related.length) {
    message.error(`以下机型仍被引用，无法批量删除：${related.join(', ')}`)
    return
  }

  const confirmed = await askConfirm('确认批量删除机型', `共 ${selectedModelCodes.value.length} 项，删除后不可恢复。`)
  if (!confirmed) return

  errorText.value = ''
  let success = 0
  const failed = []
  for (const modelCode of selectedModelCodes.value) {
    try {
      await deleteModelByCode(modelCode)
      success += 1
    } catch (err) {
      failed.push(`${modelCode}: ${err.message}`)
    }
  }

  if (success) {
    message.success(`机型删除成功 ${success} 项`)
  }
  if (failed.length) {
    errorText.value = failed.join('\n')
  }
  await loadModels()
  clearSelections()
}

async function createAircraft() {
  errorText.value = ''
  try {
    await request('/aircrafts', {
      method: 'POST',
      body: JSON.stringify({
        aircraftId: aircraftForm.aircraftId,
        name: aircraftForm.name,
        modelCode: aircraftForm.modelCode,
        ipAddr: aircraftForm.ipAddr,
        status: aircraftForm.status
      })
    })
    await loadAircrafts()
  } catch (err) {
    errorText.value = err.message
  }
}

async function removeAircraft(item) {
  const aircraftId = item?.aircraftId
  if (!aircraftId) return

  if (isAircraftDeleteLocked(item)) {
    message.error('在线飞机禁止删除，请先离线并确认无执行任务')
    return
  }

  const confirmed = await askConfirm('确认删除飞机资产', `删除后不可恢复：${aircraftId} (${item.name || '-'})`)
  if (!confirmed) return

  errorText.value = ''
  try {
    await deleteAircraftById(aircraftId)
    message.success(`已删除飞机 ${aircraftId}`)
    await loadAircrafts()
    clearSelections()
  } catch (err) {
    errorText.value = err.message
  }
}

async function batchRemoveAircrafts() {
  if (!selectedAircraftIds.value.length) {
    message.warning('请先勾选飞机')
    return
  }

  const lockedIds = selectedAircraftIds.value.filter((id) => {
    const aircraft = aircrafts.value.find((a) => a.aircraftId === id)
    return isAircraftDeleteLocked(aircraft)
  })
  if (lockedIds.length) {
    message.error(`存在在线飞机，禁止删除：${lockedIds.join(', ')}`)
    return
  }

  const confirmed = await askConfirm('确认批量删除飞机', `共 ${selectedAircraftIds.value.length} 项，删除后不可恢复。`)
  if (!confirmed) return

  errorText.value = ''
  let success = 0
  const failed = []
  for (const aircraftId of selectedAircraftIds.value) {
    try {
      await deleteAircraftById(aircraftId)
      success += 1
    } catch (err) {
      failed.push(`${aircraftId}: ${err.message}`)
    }
  }

  if (success) {
    message.success(`飞机删除成功 ${success} 项`)
  }
  if (failed.length) {
    errorText.value = failed.join('\n')
  }
  await loadAircrafts()
  clearSelections()
}

async function dispatchMission() {
  loading.dispatch = true
  errorText.value = ''
  try {
    const data = await request(`/missions/${dispatchForm.missionId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({
        aircraft_id: dispatchForm.aircraftId,
        route_id: dispatchForm.route_id || dispatchForm.missionId,
        dry_run: dispatchForm.dry_run,
        priority: dispatchForm.priority,
        operator: dispatchForm.operator
      })
    })
    createdDispatch.value = data
    ackForm.dispatchId = data.dispatchId
    await loadDispatchEvents()
  } catch (err) {
    errorText.value = err.message
  } finally {
    loading.dispatch = false
  }
}

async function sendAck() {
  if (!ackForm.dispatchId || !ackForm.correlationId) {
    errorText.value = '请输入 dispatchId 和 correlationId'
    return
  }
  errorText.value = ''
  try {
    await request(`/dispatches/${ackForm.dispatchId}/acks`, {
      method: 'POST',
      body: JSON.stringify({
        correlation_id: ackForm.correlationId,
        data: {
          status: 'succeeded',
          command_event_type: 'payload.command',
          command_message_id: `manual-${Date.now()}`
        }
      })
    })
    await loadDispatchEvents()
    await loadReplay()
  } catch (err) {
    errorText.value = err.message
  }
}

async function loadDispatchEvents() {
  if (!ackForm.dispatchId) return
  try {
    const data = await request(`/dispatches/${ackForm.dispatchId}/events`)
    dispatchEvents.value = data.items || []
    if (!ackForm.correlationId) {
      const first = dispatchEvents.value.find((e) => e.correlationId)
      if (first) {
        ackForm.correlationId = first.correlationId
      }
    }
  } catch (err) {
    errorText.value = err.message
  }
}

async function loadReplay() {
  if (!ackForm.dispatchId) return
  loading.replay = true
  try {
    dispatchReplay.value = await request(`/dispatches/${ackForm.dispatchId}/replay`)
  } catch (err) {
    errorText.value = err.message
  } finally {
    loading.replay = false
  }
}

async function applyApiBase() {
  localStorage.setItem('uav_task_api_base', apiBase.value)
  await Promise.all([loadModels(), loadAircrafts(), loadMissions()])
}

watch(
  () => [dispatchForm.missionId, dispatchForm.auto_filter_aircraft, aircrafts.value.length, models.value.length],
  () => {
    recalcCompatibility()
  },
  { deep: false }
)

watch(
  () => dispatchForm.missionId,
  (missionId) => {
    dispatchForm.route_id = missionId || ''
    if (dispatchForm.auto_filter_aircraft) {
      dispatchForm.aircraftId = ''
    }
  }
)

onMounted(async () => {
  await Promise.all([loadModels(), loadAircrafts(), loadMissions()])
  recalcCompatibility()
})
</script>

<template>
  <div class="admin-root flex h-screen w-screen overflow-hidden font-sans bg-[#f3f4f6] text-gray-800">
    <aside class="h-full w-[360px] shrink-0 border-r border-gray-200 bg-white shadow-lg flex flex-col min-h-0">
      <div class="p-4 bg-gray-50 border-b border-gray-200">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 class="m-0 text-base font-medium text-gray-900">任务运营中心</h2>
            <p class="m-0 mt-1 text-xs text-gray-500">机型、飞机、发布、ACK、状态回放</p>
          </div>
          <a-tag color="blue">M1-M4</a-tag>
        </div>
        <div class="flex gap-2 items-center">
          <a-input :value="apiBase" size="small" placeholder="http://127.0.0.1:8090" @update:value="apiBase = $event" />
          <a-button size="small" type="primary" @click="applyApiBase">连接</a-button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-3 admin-scrollbar">
        <section class="admin-card model-section">
          <div class="panel-head">
            <div>
              <div class="panel-title">机型管理</div>
              <div class="panel-subtitle">能力模板维护</div>
            </div>
            <div class="flex items-center gap-2">
              <a-button type="text" size="small" danger @click="batchRemoveModels">批量删除</a-button>
              <a-button type="text" size="small" @click="loadModels" :loading="loading.models">刷新</a-button>
            </div>
          </div>
          <div class="space-y-2">
            <a-input :value="modelForm.modelCode" size="small" placeholder="机型编码 modelCode" @update:value="modelForm.modelCode = $event" />
            <a-input :value="modelForm.modelName" size="small" placeholder="机型名称 modelName" @update:value="modelForm.modelName = $event" />
            <a-input :value="modelForm.vendor" size="small" placeholder="厂商 vendor" @update:value="modelForm.vendor = $event" />
            <div class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <div class="text-[11px] font-medium text-gray-500 mb-2">能力开关</div>
              <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-700">
                <a-checkbox :checked="modelForm.supports_gimbal" @update:checked="modelForm.supports_gimbal = $event">supports_gimbal</a-checkbox>
                <a-checkbox :checked="modelForm.supports_actuator" @update:checked="modelForm.supports_actuator = $event">supports_actuator</a-checkbox>
              </div>
            </div>
            <a-button block type="primary" @click="createModel">新增机型</a-button>
          </div>
          <a-list class="mt-3" :data-source="models" :split="false">
            <template #renderItem="{ item }">
              <div class="list-item-card">
                <div class="flex items-start justify-between gap-3">
                  <a-checkbox
                    class="mt-0.5"
                    :checked="selectedModelCodes.includes(item.modelCode)"
                    @update:checked="toggleModelSelection(item.modelCode, $event)"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-gray-900 truncate">{{ item.modelName }}</div>
                    <div class="text-[11px] text-gray-400 mt-1">{{ item.modelCode }} <span v-if="item.vendor">· {{ item.vendor }}</span></div>
                  </div>
                  <a-tag color="processing">{{ Object.keys(item.capabilities || {}).length }} 能力</a-tag>
                </div>
                <div class="text-[11px] text-gray-500 mt-2 break-all">{{ JSON.stringify(item.capabilities || {}) }}</div>
                <div class="mt-2 flex justify-end">
                  <a-button size="small" danger @click="removeModel(item)">删除</a-button>
                </div>
              </div>
            </template>
            <template #empty>
              <a-empty description="暂无机型" />
            </template>
          </a-list>
        </section>

        <section class="admin-card aircraft-section">
          <div class="panel-head">
            <div>
              <div class="panel-title">飞机资产</div>
              <div class="panel-subtitle">在线状态与机型绑定</div>
            </div>
            <div class="flex items-center gap-2">
              <a-button type="text" size="small" danger @click="batchRemoveAircrafts">批量删除</a-button>
              <a-button type="text" size="small" @click="loadAircrafts" :loading="loading.aircrafts">刷新</a-button>
            </div>
          </div>
          <div class="space-y-2">
            <a-input :value="aircraftForm.aircraftId" size="small" placeholder="飞机 ID aircraftId" @update:value="aircraftForm.aircraftId = $event" />
            <a-input :value="aircraftForm.name" size="small" placeholder="展示名称" @update:value="aircraftForm.name = $event" />
            <a-input :value="aircraftForm.modelCode" size="small" placeholder="机型编码 modelCode" @update:value="aircraftForm.modelCode = $event" />
            <div class="grid grid-cols-[1fr_120px] gap-2">
              <a-input :value="aircraftForm.ipAddr" size="small" placeholder="IP 地址 ipAddr" @update:value="aircraftForm.ipAddr = $event" />
              <a-select :value="aircraftForm.status" size="small" @update:value="aircraftForm.status = $event">
                <a-select-option value="online">online</a-select-option>
                <a-select-option value="offline">offline</a-select-option>
                <a-select-option value="maintenance">maintenance</a-select-option>
              </a-select>
            </div>
            <a-button block type="primary" @click="createAircraft">新增飞机</a-button>
          </div>
          <a-list class="mt-3" :data-source="aircrafts" :split="false">
            <template #renderItem="{ item }">
              <div class="list-item-card">
                <div class="flex items-start justify-between gap-3">
                  <a-checkbox
                    class="mt-0.5"
                    :checked="selectedAircraftIds.includes(item.aircraftId)"
                    :disabled="isAircraftDeleteLocked(item)"
                    @update:checked="toggleAircraftSelection(item.aircraftId, $event)"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium text-gray-900 truncate">{{ item.name }}</div>
                    <div class="text-[11px] text-gray-400 mt-1">{{ item.aircraftId }} · {{ item.modelCode }}</div>
                  </div>
                  <a-tag :color="item.status === 'online' ? 'success' : item.status === 'maintenance' ? 'warning' : 'default'">
                    {{ item.status }}
                  </a-tag>
                </div>
                <div class="text-[11px] text-gray-500 mt-2">{{ item.ipAddr || '-' }}</div>
                <div class="mt-2 flex justify-end">
                  <a-button size="small" danger :disabled="isAircraftDeleteLocked(item)" @click="removeAircraft(item)">删除</a-button>
                </div>
              </div>
            </template>
            <template #empty>
              <a-empty description="暂无飞机" />
            </template>
          </a-list>
        </section>
      </div>
    </aside>

    <main class="flex-1 h-full min-w-0 flex flex-col">
      <div class="px-5 py-4 border-b border-gray-200 bg-white/85 backdrop-blur-sm flex items-center justify-between gap-4">
        <div>
          <div class="text-[10px] font-black uppercase tracking-widest text-gray-400">Dispatch Center</div>
          <div class="text-lg font-semibold text-gray-800 mt-1">任务发布中心</div>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <span>missions {{ missions.length }}</span>
          <span class="w-1 h-1 rounded-full bg-gray-300"></span>
          <span>aircrafts {{ aircrafts.length }}</span>
          <span class="w-1 h-1 rounded-full bg-gray-300"></span>
          <span>models {{ models.length }}</span>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto p-5 admin-scrollbar">
        <a-alert v-if="errorText" class="mb-4" type="error" show-icon :message="errorText" />

        <section class="editor-shell mb-5">
          <div class="editor-shell-head">
            <div class="flex items-center gap-2">
              <span class="text-blue-600 font-bold">🛫</span>
              <span class="font-bold tracking-tight text-gray-700">发布配置</span>
            </div>
            <div class="flex gap-2">
              <a-button size="small" @click="loadMissions" :loading="loading.missions">刷新任务</a-button>
              <a-button size="small" type="primary" @click="dispatchMission" :loading="loading.dispatch">发布任务</a-button>
            </div>
          </div>

          <div class="grid xl:grid-cols-[1.2fr_1fr] gap-4 p-4 bg-white">
            <div class="space-y-3">
              <div>
                <div class="field-label">任务选择</div>
                <a-select :value="dispatchForm.missionId" class="w-full" placeholder="选择 mission" @update:value="dispatchForm.missionId = $event">
                  <a-select-option v-for="m in missions" :key="m.missionId" :value="m.missionId">{{ m.missionId }}</a-select-option>
                </a-select>
              </div>
              <div>
                <div class="field-label">航线标识（route_id）</div>
                <a-input :value="dispatchForm.route_id" placeholder="默认跟随 missionId" @update:value="dispatchForm.route_id = $event" />
              </div>
              <div>
                <div class="field-label">飞机选择</div>
                <a-select :value="dispatchForm.aircraftId" class="w-full" placeholder="选择 aircraft" @update:value="dispatchForm.aircraftId = $event">
                  <a-select-option v-for="a in aircraftOptionsForDispatch" :key="a.aircraftId" :value="a.aircraftId">{{ a.aircraftId }} · {{ a.name }}</a-select-option>
                </a-select>
              </div>
              <div class="grid md:grid-cols-[120px_1fr] gap-3">
                <div>
                  <div class="field-label">优先级</div>
                  <a-select :value="dispatchForm.priority" class="w-full" @update:value="dispatchForm.priority = $event">
                    <a-select-option value="P1">P1</a-select-option>
                    <a-select-option value="P2">P2</a-select-option>
                    <a-select-option value="P3">P3</a-select-option>
                  </a-select>
                </div>
                <div>
                  <div class="field-label">操作员</div>
                  <a-input :value="dispatchForm.operator" placeholder="operator" @update:value="dispatchForm.operator = $event" />
                </div>
              </div>
              <div class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <a-checkbox :checked="dispatchForm.dry_run" @update:checked="dispatchForm.dry_run = $event">dry_run，仅做能力校验不下发</a-checkbox>
              </div>
              <div class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <a-checkbox :checked="dispatchForm.auto_filter_aircraft" @update:checked="dispatchForm.auto_filter_aircraft = $event">
                  自动过滤可执行飞机（联动机型/飞机/能力）
                </a-checkbox>
              </div>
            </div>

            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div class="text-[10px] font-black uppercase tracking-widest text-gray-400">最近发布</div>
              <div v-if="createdDispatch" class="mt-3 space-y-2 text-sm">
                <div class="dispatch-meta-row"><span>dispatchId</span><strong>{{ createdDispatch.dispatchId }}</strong></div>
                <div class="dispatch-meta-row"><span>status</span><a-tag color="processing">{{ createdDispatch.dispatchStatus }}</a-tag></div>
                <div class="dispatch-meta-row"><span>aircraft</span><strong>{{ createdDispatch.aircraftId }}</strong></div>
                <div class="dispatch-meta-row"><span>mission</span><strong>{{ createdDispatch.missionId }}</strong></div>
              </div>
              <a-empty v-else class="mt-6" description="尚未发布任务" />

              <div v-if="missionLinkingSummary" class="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] text-blue-800">
                <div>联动规则：机型 {{ missionLinkingSummary.modelCodes?.join(', ') || '未限制' }}</div>
                <div>能力项 {{ missionLinkingSummary.requirements?.length || 0 }} 条</div>
                <div>兼容飞机 {{ compatibleAircraftRows.length }} / {{ aircrafts.length }}</div>
              </div>
            </div>
          </div>
        </section>

        <div class="grid xl:grid-cols-[380px_1fr] gap-5 min-h-[420px]">
          <section class="editor-shell">
            <div class="editor-shell-head">
              <div class="flex items-center gap-2">
                <span class="text-emerald-500 text-[8px] animate-pulse">●</span>
                <span class="font-bold tracking-tight text-gray-700">ACK 注入与事件查询</span>
              </div>
              <a-button size="small" @click="loadDispatchEvents">查看事件</a-button>
            </div>
            <div class="p-4 bg-white space-y-3">
              <div>
                <div class="field-label">dispatchId</div>
                <a-input :value="ackForm.dispatchId" placeholder="dispatchId" @update:value="ackForm.dispatchId = $event" />
              </div>
              <div>
                <div class="field-label">correlationId</div>
                <a-input :value="ackForm.correlationId" placeholder="correlationId" @update:value="ackForm.correlationId = $event" />
              </div>
              <div class="flex gap-2">
                <a-button type="primary" @click="sendAck">注入 ACK(success)</a-button>
                <a-button @click="loadReplay" :loading="loading.replay">状态回放</a-button>
              </div>
              <div class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                发布后会自动提取第一条带 correlationId 的 command.sent 事件，便于回放调试。
              </div>
              <div class="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500 max-h-40 overflow-auto">
                <div class="font-semibold text-gray-700 mb-1">不可执行飞机原因</div>
                <div v-if="!incompatibleAircraftRows.length">全部飞机可执行或暂无数据</div>
                <div v-for="row in incompatibleAircraftRows" :key="row.aircraftId" class="mb-1">
                  <span class="font-medium">{{ row.aircraftId }}</span>
                  <span> - {{ row.errors.join(' / ') }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="editor-shell">
            <div class="editor-shell-head">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-black uppercase tracking-widest text-gray-400">Replay</span>
                <span class="font-bold tracking-tight text-gray-700">事件流与状态回放</span>
              </div>
            </div>
            <div class="grid lg:grid-cols-2 gap-0 border-t border-gray-200 min-h-[360px]">
              <div class="bg-white border-r border-gray-200 min-h-0 flex flex-col">
                <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div class="text-xs font-medium text-gray-700">发布事件流</div>
                </div>
                <pre class="console-view flex-1">{{ JSON.stringify(dispatchEvents, null, 2) }}</pre>
              </div>
              <div class="bg-white min-h-0 flex flex-col">
                <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div class="text-xs font-medium text-gray-700">回放结果（事件 + Redpanda 状态）</div>
                </div>
                <pre class="console-view flex-1">{{ JSON.stringify(dispatchReplay, null, 2) }}</pre>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-root {
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.admin-card,
.editor-shell {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.aircraft-section {
  order: 1;
}

.model-section {
  order: 2;
}

.panel-head,
.editor-shell-head {
  padding: 12px 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.panel-subtitle,
.field-label {
  font-size: 11px;
  color: #9ca3af;
}

.field-label {
  margin-bottom: 6px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.list-item-card {
  background: #f9fafb;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  transition: all 0.2s ease;
}

.list-item-card:hover {
  background: #f3f4f6;
  border-color: #e5e7eb;
}

.dispatch-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed #e5e7eb;
}

.dispatch-meta-row:last-child {
  border-bottom: none;
}

.dispatch-meta-row span {
  color: #9ca3af;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.dispatch-meta-row strong {
  color: #1f2937;
  font-size: 12px;
  font-weight: 700;
  word-break: break-all;
}

.console-view {
  margin: 0;
  padding: 14px;
  overflow: auto;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.55;
}

.admin-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.admin-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.5);
  border-radius: 999px;
}

:deep(.ant-list-empty-text) {
  padding: 20px 0 8px;
}

:deep(.ant-input),
:deep(.ant-select-selector) {
  border-radius: 8px !important;
}

:deep(.ant-btn) {
  border-radius: 8px;
}

@media (max-width: 1100px) {
  .admin-root {
    flex-direction: column;
  }

  .admin-root > aside {
    width: 100%;
    height: auto;
    max-height: 48vh;
  }

  .admin-root > main {
    min-height: 52vh;
  }
}
</style>
