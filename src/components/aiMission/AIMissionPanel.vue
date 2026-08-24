<template>
  <div v-if="aiFeatureEnabled" class="ai-mission-root pointer-events-auto">
    <button v-if="!open" type="button" class="ai-trigger" title="打开 AI 飞行助手" @click="open = true">
      <span class="ai-trigger-dot"></span>
      <span>AI 飞行助手</span>
    </button>

    <aside v-else class="ai-panel" aria-label="AI 飞行助手">
      <header class="ai-header">
        <div>
          <div class="ai-eyebrow">MISSION COPILOT</div>
          <h2>AI 飞行助手</h2>
          <p>当前任务：{{ currentTaskName }}</p>
        </div>
        <button type="button" class="ai-close" aria-label="关闭" @click="open = false">×</button>
      </header>

      <div class="ai-safety-note">
        AI 仅生成可审阅草稿，不会保存、下发、起飞或绕过安全限制。
      </div>

      <div ref="messagesRef" class="ai-messages">
        <div v-for="(item, index) in messages" :key="index" :class="['ai-message-row', item.role]">
          <div class="ai-avatar">{{ item.role === 'user' ? '你' : 'AI' }}</div>
          <div class="ai-bubble">{{ item.content }}</div>
        </div>
        <div v-if="loading" class="ai-message-row assistant">
          <div class="ai-avatar">AI</div>
          <div class="ai-bubble ai-typing"><i></i><i></i><i></i></div>
        </div>
      </div>

      <section v-if="draft" class="ai-preview">
        <div class="ai-section-title">
          <span>任务预览</span>
          <span :class="['ai-status', responseStatus.toLowerCase()]">{{ statusText }}</span>
        </div>
        <div class="ai-metrics">
          <div><small>航点</small><strong>{{ draft.waypoints.length }}</strong></div>
          <div><small>距离</small><strong>{{ distanceText }}</strong></div>
          <div><small>时间</small><strong>{{ durationText }}</strong></div>
          <div><small>结束</small><strong>{{ finishText }}</strong></div>
        </div>
        <div class="ai-plan-name">{{ draft.missionName }}</div>
        <p class="ai-summary">{{ draft.summary }}</p>
        <div v-if="actionSummary.length" class="ai-actions">
          <span v-for="item in actionSummary" :key="item">{{ item }}</span>
        </div>
        <div v-if="warnings.length" class="ai-warnings">
          <div v-for="warning in warnings" :key="`${warning.code}-${warning.waypointId || ''}`"
            :class="['ai-warning', warning.level === 'ERROR' ? 'error' : 'warning']">
            <b>{{ warning.level === 'ERROR' ? '×' : '!' }}</b>
            <span>{{ warning.message }}</span>
          </div>
        </div>
        <div class="ai-preview-actions">
          <button type="button" class="secondary" :disabled="loading" @click="focusInput">继续修改</button>
          <button type="button" class="secondary" :disabled="loading" @click="saveDraft">保存草稿</button>
          <button type="button" class="secondary" :disabled="loading" @click="restartPlanning">重新规划</button>
          <button type="button" class="secondary" :disabled="loading || revision < 2" @click="sendPreset('撤销AI修改')">撤销 AI 修改</button>
          <button type="button" class="primary" :disabled="!canApply" @click="applyDraft">应用到任务</button>
        </div>
        <p class="ai-confirm-hint">应用后仍需在原任务编辑器中检查并手动保存；下发流程保持不变。</p>
      </section>

      <footer class="ai-composer">
        <button type="button" class="ai-map-select" :disabled="loading" @click="requestMapSelection">
          <span>⌖</span>
          <span>
            <strong>地图选点</strong>
            <small>{{ mapContext?.selectedPoint ? selectedPointText : '点击后在地图上选择目标位置' }}</small>
          </span>
        </button>
        <div class="ai-quick-list">
          <button v-for="item in quickActions" :key="item.label" type="button" :disabled="loading"
            @click="sendPreset(item.prompt)">{{ item.label }}</button>
        </div>
        <div class="ai-input-row">
          <textarea ref="inputRef" v-model="input" rows="2" placeholder="请输入任务需求…" :disabled="loading"
            @keydown.enter.exact.prevent="send"></textarea>
          <button type="button" :disabled="loading || !input.trim()" @click="send">发送</button>
        </div>
        <div class="ai-map-context">
          <span :class="{ ready: Boolean(mapContext?.selectedPoint) }"></span>
          {{ mapContext?.selectedPoint ? '已读取最近地图选点' : '尚无地图选点' }}
        </div>
      </footer>
    </aside>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { message as antMessage } from 'ant-design-vue'
import { chatAIMission } from '../../services/aiMissionService.js'
import { convertMissionToAIContext } from '../../missionPlanner/adapter.js'

const props = defineProps({
  mission: { type: Object, default: null },
  mapContext: { type: Object, default: () => ({}) },
  droneContext: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['apply', 'request-map-selection'])
const aiFeatureEnabled = import.meta.env.VITE_AI_ENABLED !== 'false'
const open = ref(false)
const input = ref('')
const loading = ref(false)
const messagesRef = ref(null)
const inputRef = ref(null)
const draft = ref(null)
const warnings = ref([])
const validation = ref(null)
const responseStatus = ref('NEED_CONFIRM')
const revision = ref(0)
const missingFields = ref([])
const conversationId = ref(sessionStorage.getItem('ai-mission-conversation-id') || '')
const messages = ref([
  { role: 'assistant', content: '告诉我去哪里、飞多高、速度、执行动作和结束方式。关键坐标不明确时，我会请你地图选点。' }
])

const quickActions = [
  { label: '规划航线', prompt: '帮我规划一次飞行任务' },
  { label: '区域巡检', prompt: '扫描我在地图上选择的区域' },
  { label: '环绕目标', prompt: '绕我点击的位置顺时针飞一圈' },
  { label: '拍照任务', prompt: '在任务末尾拍5张照片' },
  { label: '录像任务', prompt: '任务过程中录像' },
  { label: '返航', prompt: '任务结束后自动返航' },
  { label: '检查任务', prompt: '检查当前任务的安全性' }
]

const currentTaskName = computed(() => props.mission?.name || props.mission?.config?.missionName || '未创建任务')
const canApply = computed(() => Boolean(draft.value) && validation.value?.valid === true && responseStatus.value === 'READY' && !loading.value)
const statusText = computed(() => responseStatus.value === 'READY' ? '校验通过' : responseStatus.value === 'REJECTED' ? '已拒绝' : '需要确认')
const distanceText = computed(() => {
  const value = Number(validation.value?.metrics?.distanceMeters || 0)
  return value >= 1000 ? `${(value / 1000).toFixed(1)}km` : `${value.toFixed(0)}m`
})
const durationText = computed(() => {
  const seconds = Number(validation.value?.metrics?.estimatedSeconds || 0)
  return seconds >= 60 ? `${Math.ceil(seconds / 60)}分钟` : `${Math.ceil(seconds)}秒`
})
const finishText = computed(() => ({ RTH: '返航', LAND: '降落', HOVER: '悬停' }[draft.value?.finish?.type] || '待确认'))
const actionSummary = computed(() => {
  const labels = { HOVER: '悬停', TAKE_PHOTO: '拍照', PANORAMA: '全景拍照', TIMELAPSE: '定时拍照', START_RECORD: '开始录像', STOP_RECORD: '结束录像', GIMBAL: '云台', FACE_TARGET: '朝向目标' }
  return [...new Set((draft.value?.waypoints || []).flatMap(waypoint => waypoint.actions || []).map(action => labels[action.type] || action.type))]
})
const selectedPointText = computed(() => {
  const point = props.mapContext?.selectedPoint
  if (!point) return ''
  const coordinate = `${Number(point.lng).toFixed(6)}, ${Number(point.lat).toFixed(6)}`
  return point.name ? `${point.name} · ${coordinate}` : coordinate
})

function buildDroneContext() {
  const config = props.mission?.config || {}
  const homeLat = Number(config.takeOffPointLat ?? config.takeoffPoint?.lat)
  const homeLng = Number(config.takeOffPointLng ?? config.takeoffPoint?.lng)
  return {
    ...props.droneContext,
    ...(Number.isFinite(homeLat) && Number.isFinite(homeLng) ? { home: { lat: homeLat, lng: homeLng, alt: Number(config.takeOffPointHeight || 0) } } : {})
  }
}

async function sendPreset(prompt) {
  input.value = prompt
  await send()
}

async function send() {
  const content = input.value.trim()
  if (!content || loading.value) return
  messages.value.push({ role: 'user', content })
  input.value = ''
  loading.value = true
  await scrollToBottom()
  try {
    const response = await chatAIMission({
      conversationId: conversationId.value,
      message: content,
      missionContext: convertMissionToAIContext(props.mission || {}),
      droneContext: buildDroneContext(),
      mapContext: props.mapContext || {}
    })
    conversationId.value = response.conversationId
    sessionStorage.setItem('ai-mission-conversation-id', response.conversationId)
    messages.value.push({ role: 'assistant', content: response.reply })
    // The backend is authoritative. A null mission means the previous draft
    // was intentionally cleared (for example when a new destination is given).
    draft.value = response.mission || null
    warnings.value = response.warnings || []
    validation.value = response.validation || null
    responseStatus.value = response.status || 'NEED_CONFIRM'
    revision.value = Number(response.revision || 0)
    missingFields.value = response.missingFields || []
    if (missingFields.value.includes('destination')) {
      requestMapSelection()
    }
  } catch (error) {
    messages.value.push({ role: 'assistant', content: `AI 服务暂时不可用：${error.message}。现有任务编辑与执行功能不受影响。` })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

function requestMapSelection() {
  open.value = true
  emit('request-map-selection')
}

async function useSelectedMapPoint(point) {
  if (!point || loading.value) return
  open.value = true
  const name = point.name || '地图选点'
  messages.value.push({
    role: 'assistant',
    content: `已选择：${name}\n经度 ${Number(point.lng).toFixed(7)}，纬度 ${Number(point.lat).toFixed(7)}。正在将此位置用于当前规划。`
  })
  input.value = '使用刚才的地图选点作为目标位置'
  await nextTick()
  await send()
}

function applyDraft() {
  if (!canApply.value) return
  emit('apply', draft.value)
  antMessage.success('AI 草稿已应用到任务编辑器，请人工复核后保存')
}

function focusInput() {
  inputRef.value?.focus()
}

function saveDraft() {
  if (!draft.value) return
  localStorage.setItem(`ai-mission-draft-${conversationId.value || 'local'}`, JSON.stringify({
    mission: draft.value,
    validation: validation.value,
    revision: revision.value,
    savedAt: Date.now()
  }))
  antMessage.success('AI 草稿已保存；服务端会话状态也已持久化')
}

function restartPlanning() {
  conversationId.value = ''
  sessionStorage.removeItem('ai-mission-conversation-id')
  draft.value = null
  warnings.value = []
  validation.value = null
  responseStatus.value = 'NEED_CONFIRM'
  revision.value = 0
  missingFields.value = []
  messages.value = [{ role: 'assistant', content: '已开始新的规划。请重新描述目标位置、飞行高度、速度、动作和结束方式。' }]
  nextTick(focusInput)
}

defineExpose({ useSelectedMapPoint })

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}
</script>

<style scoped>
.ai-mission-root { position: fixed; right: 20px; bottom: 22px; z-index: 12000; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.ai-trigger { display: flex; align-items: center; gap: 9px; border: 1px solid rgba(96,165,250,.55); border-radius: 999px; background: rgba(10,20,38,.92); color: #fff; padding: 11px 16px; box-shadow: 0 16px 40px rgba(15,23,42,.32); font-size: 13px; font-weight: 700; cursor: pointer; backdrop-filter: blur(16px); }
.ai-trigger:hover { background: #13243e; transform: translateY(-1px); }
.ai-trigger-dot { width: 8px; height: 8px; border-radius: 50%; background: #60a5fa; box-shadow: 0 0 0 5px rgba(96,165,250,.15); }
.ai-panel { width: 390px; max-height: calc(100vh - 120px); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(148,163,184,.3); border-radius: 18px; background: rgba(248,250,252,.97); box-shadow: 0 28px 80px rgba(15,23,42,.36); backdrop-filter: blur(24px); color: #1e293b; }
.ai-header { display: flex; justify-content: space-between; padding: 17px 18px 14px; color: #fff; background: linear-gradient(135deg,#0f172a,#172554 60%,#1d4ed8); }
.ai-eyebrow { font-size: 9px; letter-spacing: .18em; color: #93c5fd; font-weight: 800; }
.ai-header h2 { margin: 3px 0 2px; font-size: 18px; line-height: 24px; font-weight: 800; }
.ai-header p { margin: 0; max-width: 295px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: #cbd5e1; }
.ai-close { border: 0; background: transparent; color: #cbd5e1; font-size: 25px; line-height: 24px; cursor: pointer; }
.ai-safety-note { padding: 8px 14px; border-bottom: 1px solid #dbeafe; background: #eff6ff; color: #1d4ed8; font-size: 10px; line-height: 15px; }
.ai-messages { min-height: 120px; max-height: 250px; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 11px; }
.ai-message-row { display: flex; gap: 8px; align-items: flex-start; }
.ai-message-row.user { flex-direction: row-reverse; }
.ai-avatar { width: 25px; height: 25px; border-radius: 8px; background: #dbeafe; color: #1d4ed8; display: grid; place-items: center; font-size: 9px; font-weight: 900; flex: 0 0 auto; }
.user .ai-avatar { background: #e2e8f0; color: #475569; }
.ai-bubble { max-width: 305px; border-radius: 4px 12px 12px; background: #fff; border: 1px solid #e2e8f0; padding: 9px 11px; font-size: 12px; line-height: 18px; white-space: pre-wrap; box-shadow: 0 3px 10px rgba(15,23,42,.04); }
.user .ai-bubble { border-radius: 12px 4px 12px 12px; border-color: #bfdbfe; background: #2563eb; color: #fff; }
.ai-typing { display: flex; gap: 4px; padding: 13px; }
.ai-typing i { width: 5px; height: 5px; border-radius: 50%; background: #60a5fa; animation: pulse 1s infinite alternate; }
.ai-typing i:nth-child(2) { animation-delay: .2s; }.ai-typing i:nth-child(3) { animation-delay: .4s; }
@keyframes pulse { to { opacity: .25; transform: translateY(-2px); } }
.ai-preview { margin: 0 12px 12px; padding: 12px; border: 1px solid #dbeafe; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgba(30,64,175,.06); }
.ai-section-title { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; }
.ai-status { border-radius: 999px; padding: 3px 7px; font-size: 9px; background: #fef3c7; color: #b45309; }.ai-status.ready { background:#dcfce7;color:#15803d; }.ai-status.rejected { background:#fee2e2;color:#b91c1c; }
.ai-metrics { display: grid; grid-template-columns: repeat(4,1fr); gap: 5px; margin: 10px 0; }
.ai-metrics div { padding: 7px 5px; border-radius: 7px; background: #f8fafc; text-align: center; }.ai-metrics small { display:block;color:#94a3b8;font-size:8px; }.ai-metrics strong { display:block;margin-top:2px;color:#0f172a;font-size:11px; }
.ai-plan-name { font-size: 13px; font-weight: 800; }.ai-summary { margin: 3px 0 8px; color:#64748b;font-size:10px; }
.ai-actions { display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px; }.ai-actions span { background:#eff6ff;color:#2563eb;border-radius:5px;padding:3px 6px;font-size:9px; }
.ai-warnings { display:flex;flex-direction:column;gap:4px;max-height:90px;overflow-y:auto; }.ai-warning { display:flex;gap:6px;padding:5px 7px;border-radius:6px;background:#fffbeb;color:#92400e;font-size:9px;line-height:13px; }.ai-warning.error { background:#fef2f2;color:#b91c1c; }.ai-warning b { flex:0 0 auto; }
.ai-preview-actions { display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;margin-top:10px; }.ai-preview-actions button { border-radius:7px;padding:6px 8px;font-size:9px;font-weight:700;cursor:pointer; }.ai-preview-actions .secondary { border:1px solid #cbd5e1;background:#fff;color:#475569; }.ai-preview-actions .primary { border:1px solid #2563eb;background:#2563eb;color:#fff; }.ai-preview-actions button:disabled { opacity:.4;cursor:not-allowed; }
.ai-confirm-hint { margin:7px 0 0;color:#94a3b8;font-size:8px;line-height:12px; }
.ai-composer { border-top:1px solid #e2e8f0;background:#fff;padding:10px 12px 11px; }
.ai-map-select { width:100%;display:flex;align-items:center;gap:9px;margin-bottom:8px;border:1px solid #bfdbfe;border-radius:9px;background:#eff6ff;color:#1d4ed8;padding:7px 9px;text-align:left;cursor:pointer; }.ai-map-select:hover { border-color:#60a5fa;background:#dbeafe; }.ai-map-select:disabled { opacity:.45;cursor:not-allowed; }.ai-map-select>span:first-child { width:24px;height:24px;border-radius:7px;background:#2563eb;color:#fff;display:grid;place-items:center;font-size:15px;font-weight:900; }.ai-map-select>span:last-child { min-width:0;display:flex;flex-direction:column; }.ai-map-select strong { font-size:10px;line-height:14px; }.ai-map-select small { max-width:295px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:8px;line-height:12px;font-weight:400; }
.ai-quick-list { display:flex;gap:5px;overflow-x:auto;padding-bottom:8px; }.ai-quick-list button { flex:0 0 auto;border:1px solid #dbeafe;border-radius:999px;background:#eff6ff;color:#1d4ed8;padding:4px 8px;font-size:9px;cursor:pointer; }
.ai-input-row { display:flex;gap:7px;align-items:stretch; }.ai-input-row textarea { flex:1;resize:none;border:1px solid #cbd5e1;border-radius:9px;padding:8px 9px;font-size:11px;line-height:16px;outline:none; }.ai-input-row textarea:focus { border-color:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.13); }.ai-input-row > button { border:0;border-radius:9px;background:#0f172a;color:#fff;padding:0 13px;font-size:10px;font-weight:800;cursor:pointer; }.ai-input-row > button:disabled { opacity:.35;cursor:not-allowed; }
.ai-map-context { display:flex;align-items:center;gap:5px;margin-top:6px;color:#94a3b8;font-size:8px; }.ai-map-context span { width:5px;height:5px;border-radius:50%;background:#cbd5e1; }.ai-map-context span.ready { background:#22c55e; }
@media (max-width: 700px) { .ai-mission-root { right:8px;bottom:8px; }.ai-panel { width:calc(100vw - 16px);max-height:calc(100vh - 16px); } }
</style>
