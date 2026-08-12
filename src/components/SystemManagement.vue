<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getTaskApiBase } from '../utils/taskApi.js'

const apiBase = ref(getTaskApiBase())
const loading = ref(false)
const saving = ref(false)
const errorText = ref('')
const config = reactive({
  server: {},
  client: {},
  storage: {},
  mqtt: { broker: '', clientId: '', username: '', password: '', topicPrefix: 'uav', topicComm: '' },
  mavlink: {},
  redpanda: { brokers: '', topicTelemetry: '', topicComm: '', topicState: '' },
  web: {},
  logging: {}
})
const testing = reactive({ api: false, mqtt: false, redpanda: false })
const results = reactive({ api: null, mqtt: null, redpanda: null })

const allConnected = computed(() => ['api', 'mqtt', 'redpanda'].every((type) => results[type]?.ok))

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return data
}

async function loadSettings() {
  loading.value = true
  errorText.value = ''
  try {
    const response = await fetch(`${getTaskApiBase()}/system/settings`)
    Object.assign(config, await parseResponse(response))
  } catch (error) {
    errorText.value = `配置读取失败：${error.message}`
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  errorText.value = ''
  try {
    const currentApiBase = getTaskApiBase()
    const response = await fetch(`${currentApiBase}/system/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    const data = await parseResponse(response)
    localStorage.setItem('uav_task_api_base', apiBase.value.trim().replace(/\/$/, ''))
    message.success(data.restartRequired ? '配置已保存，中间件配置将在重启 Server 后生效' : '配置已保存')
  } catch (error) {
    errorText.value = `配置保存失败：${error.message}`
  } finally {
    saving.value = false
  }
}

function setResult(type, ok, detail) {
  results[type] = { ok, detail, testedAt: new Date().toLocaleTimeString() }
}

async function testAPI() {
  testing.api = true
  try {
    const started = performance.now()
    const response = await fetch(`${apiBase.value.trim().replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(5000) })
    await parseResponse(response)
    setResult('api', true, `健康检查通过 · ${Math.round(performance.now() - started)} ms`)
  } catch (error) {
    setResult('api', false, error.message)
  } finally {
    testing.api = false
  }
}

async function testMiddleware(type) {
  testing[type] = true
  try {
    const response = await fetch(`${getTaskApiBase()}/system/connections/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, broker: config.mqtt.broker, brokers: config.redpanda.brokers })
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`)
    setResult(type, true, `${data.target} 可连接 · ${data.latencyMs} ms`)
  } catch (error) {
    setResult(type, false, error.message)
  } finally {
    testing[type] = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="system-page">
    <div class="system-scroll">
      <div class="system-intro">
        <div><h2>连接与中间件</h2><p>集中维护平台服务地址和消息基础设施。建议保存前逐项测试连接。</p></div>
        <div :class="['overall-status', { ready: allConnected }]"><i></i>{{ allConnected ? '所有连接测试正常' : '等待完成连接测试' }}</div>
      </div>

      <a-alert v-if="errorText" class="mb-4" type="error" show-icon :message="errorText" />

      <div class="settings-grid" :class="{ 'is-loading': loading }">
        <section class="setting-card api-card">
          <div class="setting-head">
            <div class="setting-icon api">API</div>
            <div><h3>资源与连接</h3><p>任务平台 Server API 地址</p></div>
            <span :class="['test-state', results.api?.ok ? 'success' : results.api ? 'failed' : 'idle']">{{ results.api?.ok ? '连接正常' : results.api ? '连接失败' : '未测试' }}</span>
          </div>
          <div class="setting-body">
            <label>Server API 地址</label>
            <a-input v-model:value="apiBase" placeholder="http://127.0.0.1:8090" />
            <div class="connection-result" :class="{ error: results.api && !results.api.ok }"><span>{{ results.api?.detail || '测试时将请求 /health 健康检查接口' }}</span><small v-if="results.api">{{ results.api.testedAt }}</small></div>
          </div>
          <div class="setting-actions"><a-button :loading="testing.api" @click="testAPI">测试 API 连接</a-button></div>
        </section>

        <section class="setting-card">
          <div class="setting-head">
            <div class="setting-icon mqtt">MQ</div>
            <div><h3>MQTT 服务</h3><p>任务命令与飞机 ACK 消息通道</p></div>
            <span :class="['test-state', results.mqtt?.ok ? 'success' : results.mqtt ? 'failed' : 'idle']">{{ results.mqtt?.ok ? '端口可达' : results.mqtt ? '连接失败' : '未测试' }}</span>
          </div>
          <div class="setting-body two-column">
            <div class="wide"><label>Broker 地址</label><a-input v-model:value="config.mqtt.broker" placeholder="tcp://127.0.0.1:1883" /></div>
            <div><label>Client ID</label><a-input v-model:value="config.mqtt.clientId" placeholder="uav_task_server" /></div>
            <div><label>Topic 前缀</label><a-input v-model:value="config.mqtt.topicPrefix" placeholder="uav" /></div>
            <div><label>用户名</label><a-input v-model:value="config.mqtt.username" placeholder="可选" /></div>
            <div><label>密码</label><a-input-password v-model:value="config.mqtt.password" placeholder="可选" /></div>
            <div class="wide"><label>通信 Topic</label><a-input v-model:value="config.mqtt.topicComm" placeholder="uav/v1/*/comm/report" /></div>
            <div class="connection-result wide" :class="{ error: results.mqtt && !results.mqtt.ok }"><span>{{ results.mqtt?.detail || '由 Server 对 Broker 地址执行 TCP 联通测试' }}</span><small v-if="results.mqtt">{{ results.mqtt.testedAt }}</small></div>
          </div>
          <div class="setting-actions"><a-button :loading="testing.mqtt" @click="testMiddleware('mqtt')">测试 MQTT 连接</a-button></div>
        </section>

        <section class="setting-card">
          <div class="setting-head">
            <div class="setting-icon redpanda">RP</div>
            <div><h3>Redpanda 连接</h3><p>执行状态流、遥测与通信报告</p></div>
            <span :class="['test-state', results.redpanda?.ok ? 'success' : results.redpanda ? 'failed' : 'idle']">{{ results.redpanda?.ok ? '端口可达' : results.redpanda ? '连接失败' : '未测试' }}</span>
          </div>
          <div class="setting-body two-column">
            <div class="wide"><label>Brokers</label><a-input v-model:value="config.redpanda.brokers" placeholder="127.0.0.1:19092，多个地址用逗号分隔" /></div>
            <div><label>状态 Topic</label><a-input v-model:value="config.redpanda.topicState" placeholder="uav.aircraft.command_acks" /></div>
            <div><label>遥测 Topic</label><a-input v-model:value="config.redpanda.topicTelemetry" placeholder="mavlink.aircraft.telemetry" /></div>
            <div class="wide"><label>通信 Topic</label><a-input v-model:value="config.redpanda.topicComm" placeholder="uav.aircraft.reports" /></div>
            <div class="connection-result wide" :class="{ error: results.redpanda && !results.redpanda.ok }"><span>{{ results.redpanda?.detail || '由 Server 对首个 Broker 执行 TCP 联通测试' }}</span><small v-if="results.redpanda">{{ results.redpanda.testedAt }}</small></div>
          </div>
          <div class="setting-actions"><a-button :loading="testing.redpanda" @click="testMiddleware('redpanda')">测试 Redpanda 连接</a-button></div>
        </section>
      </div>

      <div class="save-bar">
        <div><strong>保存系统配置</strong><span>MQTT 与 Redpanda 参数保存后，需重启 Server 以重建连接。</span></div>
        <a-button :loading="loading" @click="loadSettings">恢复已保存配置</a-button>
        <a-button type="primary" size="large" :loading="saving" @click="saveSettings">保存全部配置</a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.system-page { width: 100%; height: 100%; overflow: hidden; background: #edf1f7; }
.system-scroll { height: 100%; padding: 22px; overflow-y: auto; }
.system-intro { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 18px; padding: 17px 20px; border: 1px solid #dfe6ef; border-radius: 12px; background: #fff; box-shadow: 0 5px 18px rgba(15,23,42,.045); }
.system-intro h2 { margin: 0; color: #172238; font-size: 16px; }.system-intro p { margin: 4px 0 0; color: #8793a5; font-size: 11px; }
.overall-status { display: flex; align-items: center; gap: 7px; color: #8792a3; font-size: 11px; }.overall-status i { width: 7px; height: 7px; border-radius: 50%; background: #aab3bf; }.overall-status.ready { color: #07835a; }.overall-status.ready i { background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,.5); }
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; transition: opacity .2s; }.settings-grid.is-loading { opacity: .5; pointer-events: none; }.api-card { grid-column: 1 / -1; }
.setting-card { display: flex; flex-direction: column; overflow: hidden; border: 1px solid #dfe6ef; border-radius: 12px; background: #fff; box-shadow: 0 6px 22px rgba(15,23,42,.05); }
.setting-head { display: grid; grid-template-columns: 38px 1fr auto; align-items: center; gap: 11px; padding: 15px 17px; border-bottom: 1px solid #e7ecf2; background: #fafbfd; }.setting-head h3 { margin: 0; color: #1b273b; font-size: 14px; }.setting-head p { margin: 2px 0 0; color: #909bad; font-size: 10px; }
.setting-icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px; font-size: 10px; font-weight: 800; letter-spacing: .04em; }.setting-icon.api { color: #2866d2; background: #e9f1ff; }.setting-icon.mqtt { color: #7c4bc4; background: #f1eaff; }.setting-icon.redpanda { color: #d45a38; background: #fff0eb; }
.test-state { padding: 4px 8px; border-radius: 999px; font-size: 9px; }.test-state.idle { color: #7e8999; background: #edf0f4; }.test-state.success { color: #067957; background: #e6f8f1; }.test-state.failed { color: #c2413a; background: #fff0ee; }
.setting-body { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 16px 17px; }.setting-body.two-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; }.setting-body .wide { grid-column: 1 / -1; }.setting-body label { margin-top: 2px; color: #657287; font-size: 10px; font-weight: 650; }
.connection-result { min-height: 31px; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 5px; padding: 6px 9px; border-radius: 7px; color: #657d70; font-size: 10px; background: #f0f8f5; }.connection-result.error { color: #b84a43; background: #fff2f0; }.connection-result small { flex: none; color: #9aa5b5; }
.setting-actions { display: flex; justify-content: flex-end; padding: 11px 17px; border-top: 1px solid #edf0f4; background: #fafbfd; }
.save-bar { position: sticky; bottom: -22px; z-index: 4; display: flex; align-items: center; gap: 10px; margin-top: 18px; padding: 14px 18px; border: 1px solid #dbe3ee; border-radius: 12px 12px 0 0; background: rgba(255,255,255,.95); box-shadow: 0 -7px 25px rgba(15,23,42,.08); backdrop-filter: blur(12px); }.save-bar div { min-width: 0; flex: 1; }.save-bar strong { display: block; color: #27344a; font-size: 12px; }.save-bar span { color: #8a96a8; font-size: 10px; }
:deep(.ant-input), :deep(.ant-input-affix-wrapper), :deep(.ant-btn) { border-radius: 8px; }
@media (max-width: 1000px) { .settings-grid { grid-template-columns: 1fr; }.api-card { grid-column: auto; } }
@media (max-width: 700px) { .system-scroll { padding: 12px; }.system-intro, .save-bar { align-items: flex-start; flex-direction: column; }.setting-body.two-column { grid-template-columns: 1fr; }.setting-body .wide { grid-column: auto; }.save-bar { bottom: -12px; } }
</style>
