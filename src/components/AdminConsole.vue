<script setup>
import { onMounted, reactive, ref } from 'vue'

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
  dry_run: false,
  priority: 'P2',
  operator: 'ops'
})

const ackForm = reactive({
  dispatchId: '',
  correlationId: ''
})

const createdDispatch = ref(null)

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

async function dispatchMission() {
  loading.dispatch = true
  errorText.value = ''
  try {
    const data = await request(`/missions/${dispatchForm.missionId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({
        aircraft_id: dispatchForm.aircraftId,
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

onMounted(async () => {
  await Promise.all([loadModels(), loadAircrafts(), loadMissions()])
})
</script>

<template>
  <div class="admin-root">
    <header class="admin-header">
      <div>
        <h1>UAV Task 管理与发布中心</h1>
        <p>覆盖 M1-M4：机型、飞机、发布、ACK、状态回放</p>
      </div>
      <div class="api-config">
        <span>API Base</span>
        <input v-model="apiBase" placeholder="http://127.0.0.1:8090" />
        <button @click="applyApiBase">连接</button>
      </div>
    </header>

    <p v-if="errorText" class="error">{{ errorText }}</p>

    <div class="grid-2">
      <section class="panel">
        <h2>机型管理</h2>
        <div class="row">
          <input v-model="modelForm.modelCode" placeholder="modelCode" />
          <input v-model="modelForm.modelName" placeholder="modelName" />
          <input v-model="modelForm.vendor" placeholder="vendor" />
        </div>
        <div class="row checks">
          <label><input type="checkbox" v-model="modelForm.supports_gimbal" /> supports_gimbal</label>
          <label><input type="checkbox" v-model="modelForm.supports_actuator" /> supports_actuator</label>
          <button @click="createModel">新增机型</button>
          <button @click="loadModels" :disabled="loading.models">刷新</button>
        </div>
        <table>
          <thead>
            <tr><th>编码</th><th>名称</th><th>厂商</th><th>能力</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in models" :key="item.modelCode">
              <td>{{ item.modelCode }}</td>
              <td>{{ item.modelName }}</td>
              <td>{{ item.vendor || '-' }}</td>
              <td>{{ JSON.stringify(item.capabilities || {}) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <h2>飞机资产管理</h2>
        <div class="row">
          <input v-model="aircraftForm.aircraftId" placeholder="aircraftId" />
          <input v-model="aircraftForm.name" placeholder="name" />
          <input v-model="aircraftForm.modelCode" placeholder="modelCode" />
        </div>
        <div class="row">
          <input v-model="aircraftForm.ipAddr" placeholder="ipAddr" />
          <select v-model="aircraftForm.status">
            <option value="online">online</option>
            <option value="offline">offline</option>
            <option value="maintenance">maintenance</option>
          </select>
          <button @click="createAircraft">新增飞机</button>
          <button @click="loadAircrafts" :disabled="loading.aircrafts">刷新</button>
        </div>
        <table>
          <thead>
            <tr><th>ID</th><th>名称</th><th>机型</th><th>IP</th><th>状态</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in aircrafts" :key="item.aircraftId">
              <td>{{ item.aircraftId }}</td>
              <td>{{ item.name }}</td>
              <td>{{ item.modelCode }}</td>
              <td>{{ item.ipAddr }}</td>
              <td>{{ item.status }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <section class="panel">
      <h2>任务发布中心</h2>
      <div class="row">
        <select v-model="dispatchForm.missionId">
          <option disabled value="">选择 mission</option>
          <option v-for="m in missions" :key="m.missionId" :value="m.missionId">{{ m.missionId }}</option>
        </select>
        <select v-model="dispatchForm.aircraftId">
          <option disabled value="">选择 aircraft</option>
          <option v-for="a in aircrafts" :key="a.aircraftId" :value="a.aircraftId">{{ a.aircraftId }}</option>
        </select>
        <select v-model="dispatchForm.priority">
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
        </select>
        <input v-model="dispatchForm.operator" placeholder="operator" />
        <label><input type="checkbox" v-model="dispatchForm.dry_run" /> dry_run</label>
        <button @click="dispatchMission" :disabled="loading.dispatch">发布</button>
        <button @click="loadMissions" :disabled="loading.missions">刷新任务</button>
      </div>

      <div v-if="createdDispatch" class="hint">
        <div>dispatchId: {{ createdDispatch.dispatchId }}</div>
        <div>status: {{ createdDispatch.dispatchStatus }}</div>
      </div>

      <div class="row">
        <input v-model="ackForm.dispatchId" placeholder="dispatchId" />
        <input v-model="ackForm.correlationId" placeholder="correlationId" />
        <button @click="sendAck">手工注入 ACK(success)</button>
        <button @click="loadDispatchEvents">查看事件</button>
        <button @click="loadReplay" :disabled="loading.replay">状态回放</button>
      </div>

      <div class="grid-2">
        <div>
          <h3>发布事件流</h3>
          <pre>{{ JSON.stringify(dispatchEvents, null, 2) }}</pre>
        </div>
        <div>
          <h3>回放结果（事件 + Redpanda 状态）</h3>
          <pre>{{ JSON.stringify(dispatchReplay, null, 2) }}</pre>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-root {
  min-height: 100vh;
  background: #f4f6f9;
  padding: 20px;
  color: #1f2a37;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.admin-header h1 {
  margin: 0;
  font-size: 24px;
}

.admin-header p {
  margin: 6px 0 0;
  color: #6b7280;
}

.api-config {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error {
  padding: 10px 12px;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 8px;
}

.grid-2 {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  margin-bottom: 16px;
}

.panel h2 {
  margin-top: 0;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

input,
select,
button {
  height: 34px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0 10px;
}

button {
  background: #0f766e;
  color: #fff;
  cursor: pointer;
  border: none;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  padding: 8px;
  font-size: 13px;
}

pre {
  background: #0b1020;
  color: #e6edf3;
  border-radius: 8px;
  padding: 10px;
  overflow: auto;
  min-height: 140px;
}

.hint {
  background: #ecfeff;
  border: 1px solid #67e8f9;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
}

@media (max-width: 1000px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }

  .admin-header {
    flex-direction: column;
  }
}
</style>
