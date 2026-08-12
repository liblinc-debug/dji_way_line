<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { checkRouteAircraftCompatibility, getMissionLinkingSummary } from '../utils/routeLinking.js'

const ROUTE_LIBRARY_STORAGE_KEY = 'missions'
const apiBase = ref(localStorage.getItem('uav_task_api_base') || 'http://127.0.0.1:8090')
const loading = reactive({
  models: false,
  aircrafts: false,
  dispatch: false,
  replay: false
})

const models = ref([])
const aircrafts = ref([])
const routeLibrary = ref([])
const dispatchEvents = ref([])
const dispatchReplay = ref(null)
const errorText = ref('')

const dispatchForm = reactive({
  aircraftModelCode: '',
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
const submittingMode = ref('publish')

const modelCapabilitiesMap = computed(() => {
  const map = {}
  for (const m of models.value) {
    if (m?.modelCode) {
      map[m.modelCode] = m.capabilities || {}
    }
  }
  return map
})

const selectedRoute = computed(() => routeLibrary.value.find((r) => String(r.id) === String(dispatchForm.route_id)) || null)

const routeOptionsForDispatch = computed(() => {
  const modelCode = String(dispatchForm.aircraftModelCode || '').trim()
  if (!modelCode) return routeLibrary.value

  return routeLibrary.value.filter((route) => {
    const summary = getMissionLinkingSummary(route)
    const modelCodes = summary?.modelCodes || []
    if (modelCodes.length > 0) {
      return modelCodes.includes(modelCode)
    }
    return String(route?.config?.aircraftModel || '') === modelCode
  })
})

const modelCodesForDispatch = computed(() => {
  const set = new Set(models.value.map((m) => m.modelCode).filter(Boolean))
  for (const route of routeLibrary.value) {
    const summary = getMissionLinkingSummary(route)
    for (const code of summary.modelCodes || []) {
      set.add(code)
    }
  }
  return [...set]
})

const missionLinkingSummary = computed(() => {
  if (selectedRoute.value) return getMissionLinkingSummary(selectedRoute.value)
  return null
})

const aircraftOptionsForDispatch = computed(() => {
  const byModel = dispatchForm.aircraftModelCode
    ? aircrafts.value.filter((a) => String(a.modelCode || '') === String(dispatchForm.aircraftModelCode))
    : aircrafts.value
  if (!dispatchForm.auto_filter_aircraft) return byModel
  const allowed = new Set(
    compatibleAircraftRows.value
      .filter((a) => a.publishOk || a.dryRunOk)
      .map((a) => a.aircraftId)
  )
  return byModel.filter((a) => allowed.has(a.aircraftId))
})

const selectedAircraft = computed(() => (
  aircrafts.value.find((a) => a.aircraftId === dispatchForm.aircraftId) || null
))

const isPublishDisabled = computed(() => {
  if (!dispatchForm.aircraftId) return true
  const status = String(selectedAircraft.value?.status || '').toLowerCase()
  return status !== 'online'
})

const isTestRunDisabled = computed(() => {
  if (!dispatchForm.dry_run) return true
  if (!dispatchForm.route_id) return true
  if (!dispatchForm.aircraftId) return true
  const status = String(selectedAircraft.value?.status || '').toLowerCase()
  if (status === 'maintenance') return true
  return false
})

function loadRouteLibraryFromLocal() {
  try {
    const raw = localStorage.getItem(ROUTE_LIBRARY_STORAGE_KEY)
    if (!raw) {
      routeLibrary.value = []
      return
    }
    const parsed = JSON.parse(raw)
    routeLibrary.value = Array.isArray(parsed) ? parsed : []
  } catch (err) {
    routeLibrary.value = []
    errorText.value = `航线库读取失败: ${err.message}`
  }
}

function recalcCompatibility() {
  const route = selectedRoute.value
  if (!route) {
    compatibleAircraftRows.value = []
    incompatibleAircraftRows.value = []
    return
  }

  const okRows = []
  const badRows = []
  for (const aircraft of aircrafts.value) {
    const publishResult = checkRouteAircraftCompatibility({
      mission: route,
      aircraft,
      modelCapabilitiesMap: modelCapabilitiesMap.value
    })
    const dryRunResult = checkRouteAircraftCompatibility({
      mission: route,
      aircraft,
      modelCapabilitiesMap: modelCapabilitiesMap.value,
      allowOffline: true
    })

    okRows.push({
      ...aircraft,
      publishOk: publishResult.ok,
      dryRunOk: dryRunResult.ok,
      publishErrors: publishResult.errors,
      dryRunErrors: dryRunResult.errors
    })

    if (!publishResult.ok || !dryRunResult.ok) {
      badRows.push({
        aircraftId: aircraft.aircraftId,
        name: aircraft.name,
        modelCode: aircraft.modelCode,
        publishErrors: publishResult.errors,
        dryRunErrors: dryRunResult.errors,
        dryRunAllowed: dryRunResult.ok
      })
    }
  }

  compatibleAircraftRows.value = okRows
  incompatibleAircraftRows.value = badRows

  if (dispatchForm.auto_filter_aircraft && dispatchForm.aircraftId) {
    const exists = okRows.some((a) => a.aircraftId === dispatchForm.aircraftId && (a.publishOk || a.dryRunOk))
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

async function submitDispatch({ dryRun }) {
  if (!dispatchForm.route_id) {
    errorText.value = '请先在航线库中选择航线'
    return
  }

  if (!dispatchForm.aircraftId) {
    errorText.value = '请选择飞机后再执行'
    return
  }

  const selected = selectedAircraft.value
  const status = String(selected?.status || '').toLowerCase()
  if (!dryRun && String(selected?.status || '').toLowerCase() !== 'online') {
    errorText.value = '离线飞机禁止正式发布，请使用测试运行'
    return
  }

  if (dryRun && status === 'maintenance') {
    errorText.value = '维护中飞机不能执行测试运行'
    return
  }

  submittingMode.value = dryRun ? 'test' : 'publish'

  loading.dispatch = true
  errorText.value = ''
  try {
    const data = await request(`/tasks/${dispatchForm.route_id}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({
        aircraft_id: dispatchForm.aircraftId,
        route_id: dispatchForm.route_id,
        dry_run: dryRun,
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
    submittingMode.value = 'publish'
  }
}

async function dispatchMission() {
  return submitDispatch({ dryRun: false })
}

async function testRunMission() {
  return submitDispatch({ dryRun: true })
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

watch(
  () => [dispatchForm.route_id, dispatchForm.aircraftModelCode, dispatchForm.auto_filter_aircraft, aircrafts.value.length, models.value.length],
  () => {
    recalcCompatibility()
  },
  { deep: false }
)

watch(
  () => dispatchForm.aircraftModelCode,
  () => {
    const exists = routeOptionsForDispatch.value.some((r) => String(r.id) === String(dispatchForm.route_id))
    if (!exists) {
      dispatchForm.route_id = ''
    }
    dispatchForm.aircraftId = ''
  }
)

onMounted(async () => {
  loadRouteLibraryFromLocal()
  await Promise.all([loadModels(), loadAircrafts()])
  if (!dispatchForm.aircraftModelCode && modelCodesForDispatch.value.length > 0) {
    dispatchForm.aircraftModelCode = modelCodesForDispatch.value[0]
  }
  recalcCompatibility()
})
</script>

<template>
  <div class="admin-root flex h-full w-full overflow-hidden font-sans bg-[#edf1f7] text-gray-800">
    <main class="flex-1 h-full min-w-0 flex flex-col">
      <div class="px-5 py-3 border-b border-gray-200 bg-white/90 backdrop-blur-sm flex items-center justify-between gap-4">
        <div>
          <div class="text-[10px] font-black uppercase tracking-widest text-blue-500">Dispatch Workspace</div>
          <div class="text-lg font-semibold text-gray-800 mt-1">任务发布工作台</div>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <span class="operation-stat"><b>{{ routeLibrary.length }}</b> 条任务</span>
          <span class="w-1 h-1 rounded-full bg-gray-300"></span>
          <span class="operation-stat"><b>{{ aircrafts.length }}</b> 架飞机</span>
          <span class="w-1 h-1 rounded-full bg-gray-300"></span>
          <span class="operation-stat"><b>{{ models.length }}</b> 个机型</span>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto p-5 admin-scrollbar">
        <a-alert v-if="errorText" class="mb-4" type="error" show-icon :message="errorText" />

        <section class="editor-shell mb-5">
          <div class="editor-shell-head">
            <div class="flex items-center gap-2">
              <span class="section-kicker">01</span>
              <span class="font-bold tracking-tight text-gray-700">发布配置</span>
            </div>
            <div class="flex gap-2">
              <a-button size="small" @click="loadRouteLibraryFromLocal">刷新航线库</a-button>
              <a-button size="small" @click="testRunMission" :disabled="isTestRunDisabled" :loading="loading.dispatch && submittingMode === 'test'">
                测试运行
              </a-button>
              <a-button size="small" type="primary" @click="dispatchMission" :disabled="isPublishDisabled" :loading="loading.dispatch && submittingMode === 'publish'">
                发布部署
              </a-button>
            </div>
          </div>

          <div class="grid xl:grid-cols-[1.2fr_1fr] gap-4 p-4 bg-white">
            <div class="space-y-3">
              <div>
                <div class="field-label">飞机型号</div>
                <a-select :value="dispatchForm.aircraftModelCode" class="w-full" placeholder="先选择飞机型号"
                  @update:value="dispatchForm.aircraftModelCode = $event">
                  <a-select-option v-for="code in modelCodesForDispatch" :key="code" :value="code">{{ code }}</a-select-option>
                </a-select>
              </div>
              <div>
                <div class="field-label">航线选择（即任务选择）</div>
                <a-select :value="dispatchForm.route_id" class="w-full" placeholder="按所选机型筛选任务/航线"
                  @update:value="dispatchForm.route_id = $event">
                  <a-select-option v-for="r in routeOptionsForDispatch" :key="r.id" :value="String(r.id)">
                    {{ r.name || r.id }}
                  </a-select-option>
                </a-select>
              </div>
              <div>
                <div class="field-label">飞机选择</div>
                <a-select :value="dispatchForm.aircraftId" class="w-full" placeholder="选择 aircraft" @update:value="dispatchForm.aircraftId = $event">
                  <a-select-option v-for="a in aircraftOptionsForDispatch" :key="a.aircraftId" :value="a.aircraftId">
                    {{ a.aircraftId }} · {{ a.name }} · {{ a.status }}
                  </a-select-option>
                </a-select>
                <div v-if="selectedAircraft" class="mt-2 text-[11px] text-gray-500">
                  当前选择：{{ selectedAircraft.aircraftId }} / {{ selectedAircraft.modelCode }} / {{ selectedAircraft.status }}
                  <span v-if="selectedAircraft.status !== 'online'" class="text-amber-600">，离线飞机只能测试运行</span>
                </div>
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
              <div class="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700 leading-5">
                <div>测试运行：允许选择离线飞机，仅做能力校验，不下发任务。</div>
                <div>发布部署：仅允许在线飞机，离线时按钮自动禁用。</div>
              </div>
            </div>

            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div class="text-[10px] font-black uppercase tracking-widest text-gray-400">最近发布</div>
              <div v-if="createdDispatch" class="mt-3 space-y-2 text-sm">
                <div class="dispatch-meta-row"><span>dispatchId</span><strong>{{ createdDispatch.dispatchId }}</strong></div>
                <div class="dispatch-meta-row"><span>status</span><a-tag color="processing">{{ createdDispatch.dispatchStatus }}</a-tag></div>
                <div class="dispatch-meta-row"><span>aircraft</span><strong>{{ createdDispatch.aircraftId }}</strong></div>
                <div class="dispatch-meta-row"><span>任务</span><strong>{{ createdDispatch.taskId || createdDispatch.missionId }}</strong></div>
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
                  <span v-if="row.dryRunAllowed"> - 测试运行可用，正式发布不可用（{{ row.publishErrors.join(' / ') }}）</span>
                  <span v-else> - {{ row.publishErrors.join(' / ') }}</span>
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

.operation-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 4px 8px;
  border: 1px solid #e3e9f1;
  border-radius: 7px;
  background: #f8fafc;
}

.operation-stat b {
  color: #2767d8;
  font-size: 13px;
}

.section-kicker {
  width: 24px;
  height: 20px;
  display: inline-grid;
  place-items: center;
  border-radius: 6px;
  color: #3973dc;
  font-size: 9px;
  font-weight: 800;
  background: #eaf1ff;
}

.admin-card,
.editor-shell {
  border: 1px solid #dfe5ee;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 5px 18px rgba(15, 23, 42, 0.055);
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
  background: #f8fafc;
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
  background: #f4f7fb;
  border-color: #d9e3f2;
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
