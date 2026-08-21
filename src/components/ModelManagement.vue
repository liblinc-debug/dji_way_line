<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { encodeResourceId, taskApiRequest } from '../utils/taskApi.js'

const models = ref([])
const aircrafts = ref([])
const loading = ref(false)
const saving = ref(false)
const errorText = ref('')
const keyword = ref('')
const selectedCodes = ref([])
const editingCode = ref('')
const editingCapabilities = ref({})
const form = reactive({ modelCode: '', modelName: '', vendor: '', description: '', supports_gimbal: true, supports_actuator: false })

const filteredModels = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) return models.value
  return models.value.filter((item) => [item.modelCode, item.modelName, item.vendor, item.description].some((value) => String(value || '').toLowerCase().includes(query)))
})

const referencedCount = computed(() => models.value.filter((model) => aircrafts.value.some((aircraft) => aircraft.modelCode === model.modelCode)).length)
const capabilityCount = computed(() => models.value.reduce((total, model) => total + Object.values(model.capabilities || {}).filter(Boolean).length, 0))

function askConfirm(title, content) {
  return new Promise((resolve) => Modal.confirm({ title, content, okText: '确认', cancelText: '取消', onOk: () => resolve(true), onCancel: () => resolve(false) }))
}

async function loadData() {
  loading.value = true
  errorText.value = ''
  try {
    const [modelData, aircraftData] = await Promise.all([taskApiRequest('/models'), taskApiRequest('/aircrafts')])
    models.value = modelData.items || []
    aircrafts.value = aircraftData.items || []
    selectedCodes.value = selectedCodes.value.filter((code) => models.value.some((model) => model.modelCode === code))
  } catch (error) {
    errorText.value = error.message
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingCode.value = ''
  editingCapabilities.value = {}
  Object.assign(form, { modelCode: '', modelName: '', vendor: '', description: '', supports_gimbal: true, supports_actuator: false })
}

function editModel(item) {
  editingCode.value = item.modelCode
  editingCapabilities.value = { ...(item.capabilities || {}) }
  Object.assign(form, {
    modelCode: item.modelCode,
    modelName: item.modelName || '',
    vendor: item.vendor || '',
    description: item.description || '',
    supports_gimbal: item.capabilities?.supports_gimbal === true,
    supports_actuator: item.capabilities?.supports_actuator === true
  })
}

async function saveModel() {
  if (!form.modelCode.trim() || !form.modelName.trim()) {
    message.warning('请填写机型编码和机型名称')
    return
  }
  saving.value = true
  errorText.value = ''
  try {
    await taskApiRequest(editingCode.value ? `/models/${encodeResourceId(editingCode.value)}` : '/models', {
      method: editingCode.value ? 'PUT' : 'POST',
      body: JSON.stringify({
        modelCode: form.modelCode.trim(),
        modelName: form.modelName.trim(),
        vendor: form.vendor.trim(),
        description: form.description.trim(),
        capabilities: { ...editingCapabilities.value, supports_gimbal: form.supports_gimbal, supports_actuator: form.supports_actuator }
      })
    })
    message.success(editingCode.value ? `机型 ${editingCode.value} 已更新` : `机型 ${form.modelCode} 已创建`)
    resetForm()
    await loadData()
  } catch (error) {
    errorText.value = error.message
  } finally {
    saving.value = false
  }
}

function toggleSelection(code, checked) {
  selectedCodes.value = checked
    ? [...new Set([...selectedCodes.value, code])]
    : selectedCodes.value.filter((item) => item !== code)
}

async function replaceModelReferences(oldCode, newCode) {
  const related = aircrafts.value.filter((aircraft) => aircraft.modelCode === oldCode)
  await Promise.all(related.map((aircraft) => taskApiRequest(`/aircrafts/${encodeResourceId(aircraft.aircraftId)}`, {
    method: 'PUT',
    body: JSON.stringify({ ...aircraft, modelCode: newCode })
  })))
}

async function removeModel(model) {
  const code = model?.modelCode
  if (!code) return
  const related = aircrafts.value.filter((aircraft) => aircraft.modelCode === code)
  if (related.length) {
    const input = window.prompt(`机型 ${code} 正被 ${related.length} 架飞机引用。\n请输入替代机型编码后继续：`)
    if (!input) return
    const replacement = input.trim()
    if (replacement === code || !models.value.some((item) => item.modelCode === replacement)) {
      message.error('替代机型不存在或无效')
      return
    }
    if (!await askConfirm('替换并删除机型', `先将 ${related.length} 架飞机切换至 ${replacement}，再删除 ${code}。`)) return
    await replaceModelReferences(code, replacement)
  } else if (!await askConfirm('删除机型', `确认删除 ${code}？此操作不可恢复。`)) return

  try {
    await taskApiRequest(`/models/${encodeResourceId(code)}`, { method: 'DELETE' })
    message.success(`已删除机型 ${code}`)
    if (editingCode.value === code) resetForm()
    await loadData()
  } catch (error) {
    errorText.value = error.message
  }
}

async function batchRemove() {
  if (!selectedCodes.value.length) return message.warning('请先选择机型')
  const referenced = selectedCodes.value.filter((code) => aircrafts.value.some((aircraft) => aircraft.modelCode === code))
  if (referenced.length) return message.error(`以下机型仍被飞机引用：${referenced.join('、')}`)
  if (!await askConfirm('批量删除机型', `确认删除所选 ${selectedCodes.value.length} 个机型？`)) return
  try {
    await Promise.all(selectedCodes.value.map((code) => taskApiRequest(`/models/${encodeResourceId(code)}`, { method: 'DELETE' })))
    message.success('批量删除完成')
    selectedCodes.value = []
    await loadData()
  } catch (error) {
    errorText.value = error.message
  }
}

onMounted(loadData)
</script>

<template>
  <div class="management-page">
    <div class="management-scroll">
      <section class="summary-grid">
        <div class="summary-card"><span>机型总数</span><strong>{{ models.length }}</strong><small>已登记能力模板</small></div>
        <div class="summary-card"><span>已关联机型</span><strong>{{ referencedCount }}</strong><small>存在飞机资产引用</small></div>
        <div class="summary-card accent"><span>有效能力项</span><strong>{{ capabilityCount }}</strong><small>当前启用能力合计</small></div>
      </section>

      <a-alert v-if="errorText" class="mb-4" type="error" show-icon :message="errorText" />

      <div class="management-layout">
        <section class="management-panel list-panel">
          <div class="management-toolbar">
            <div>
              <h2>机型能力模板</h2>
              <p>集中维护机型标识、厂商与任务载荷能力</p>
            </div>
            <div class="toolbar-actions">
              <a-input-search v-model:value="keyword" allow-clear placeholder="搜索编码、名称、厂商或描述" />
              <a-button danger :disabled="!selectedCodes.length" @click="batchRemove">批量删除</a-button>
              <a-button :loading="loading" @click="loadData">刷新</a-button>
            </div>
          </div>

          <div class="resource-table-wrap">
            <table class="resource-table">
              <thead><tr><th class="check-cell"></th><th>机型</th><th>厂商</th><th>描述</th><th>能力摘要</th><th>关联飞机</th><th class="action-cell">操作</th></tr></thead>
              <tbody>
                <tr v-for="model in filteredModels" :key="model.modelCode">
                  <td class="check-cell"><a-checkbox :checked="selectedCodes.includes(model.modelCode)" @update:checked="toggleSelection(model.modelCode, $event)" /></td>
                  <td><strong>{{ model.modelName || '-' }}</strong><small>{{ model.modelCode }}</small></td>
                  <td>{{ model.vendor || '-' }}</td>
                  <td class="description-cell" :title="model.description || ''">{{ model.description || '-' }}</td>
                  <td><div class="capability-tags"><a-tag v-if="model.capabilities?.supports_gimbal" color="blue">云台</a-tag><a-tag v-if="model.capabilities?.supports_actuator" color="purple">执行器</a-tag><span v-if="!Object.values(model.capabilities || {}).some(Boolean)">暂无能力</span></div></td>
                  <td>{{ aircrafts.filter((item) => item.modelCode === model.modelCode).length }} 架</td>
                  <td class="action-cell"><a-button type="link" @click="editModel(model)">编辑</a-button><a-button type="link" danger @click="removeModel(model)">删除</a-button></td>
                </tr>
                <tr v-if="!filteredModels.length"><td colspan="7"><a-empty description="暂无匹配机型" /></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="management-panel form-panel">
          <div class="form-heading"><span class="form-icon">{{ editingCode ? '✎' : '＋' }}</span><div><h2>{{ editingCode ? '编辑机型' : '新增机型' }}</h2><p>{{ editingCode ? `正在编辑 ${editingCode}` : '创建可复用的飞机能力模板' }}</p></div></div>
          <div class="form-body">
            <label>机型编码 <b>*</b></label><a-input v-model:value="form.modelCode" :disabled="!!editingCode" placeholder="例如 DJI-M350" />
            <label>机型名称 <b>*</b></label><a-input v-model:value="form.modelName" placeholder="请输入展示名称" />
            <label>生产厂商</label><a-input v-model:value="form.vendor" placeholder="例如 DJI" />
            <label>描述</label><a-textarea v-model:value="form.description" :maxlength="500" :rows="3" show-count placeholder="填写机型用途、特点或适用任务" />
            <label>任务能力</label>
            <div class="capability-options">
              <a-checkbox v-model:checked="form.supports_gimbal"><span>云台控制</span><small>支持航点云台动作</small></a-checkbox>
              <a-checkbox v-model:checked="form.supports_actuator"><span>外部执行器</span><small>支持撒放、继电器等动作</small></a-checkbox>
            </div>
            <a-button block type="primary" size="large" :loading="saving" @click="saveModel">{{ editingCode ? '保存修改' : '创建机型模板' }}</a-button>
            <a-button block @click="resetForm">{{ editingCode ? '取消编辑' : '清空表单' }}</a-button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './management.css';
</style>
