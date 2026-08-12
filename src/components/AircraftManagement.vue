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
const statusFilter = ref('all')
const selectedIds = ref([])
const editingId = ref('')
const form = reactive({ aircraftId: '', name: '', modelCode: '', ipAddr: '', status: 'offline' })

const filteredAircrafts = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return aircrafts.value.filter((item) => {
    const matchesQuery = !query || [item.aircraftId, item.name, item.modelCode, item.ipAddr].some((value) => String(value || '').toLowerCase().includes(query))
    return matchesQuery && (statusFilter.value === 'all' || item.status === statusFilter.value)
  })
})
const onlineCount = computed(() => aircrafts.value.filter((item) => item.status === 'online').length)
const maintenanceCount = computed(() => aircrafts.value.filter((item) => item.status === 'maintenance').length)

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
    selectedIds.value = selectedIds.value.filter((id) => aircrafts.value.some((item) => item.aircraftId === id))
  } catch (error) {
    errorText.value = error.message
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = ''
  Object.assign(form, { aircraftId: '', name: '', modelCode: '', ipAddr: '', status: 'offline' })
}

function editAircraft(item) {
  editingId.value = item.aircraftId
  Object.assign(form, { aircraftId: item.aircraftId, name: item.name || '', modelCode: item.modelCode || '', ipAddr: item.ipAddr || '', status: item.status || 'offline' })
}

async function saveAircraft() {
  if (!form.aircraftId.trim() || !form.name.trim() || !form.modelCode) {
    message.warning('请填写飞机 ID、名称并选择机型')
    return
  }
  saving.value = true
  errorText.value = ''
  try {
    await taskApiRequest(editingId.value ? `/aircrafts/${encodeResourceId(editingId.value)}` : '/aircrafts', {
      method: editingId.value ? 'PUT' : 'POST',
      body: JSON.stringify({ aircraftId: form.aircraftId.trim(), name: form.name.trim(), modelCode: form.modelCode, ipAddr: form.ipAddr.trim(), status: form.status })
    })
    message.success(editingId.value ? '飞机信息已更新' : '飞机资产已创建')
    resetForm()
    await loadData()
  } catch (error) {
    errorText.value = error.message
  } finally {
    saving.value = false
  }
}

function toggleSelection(id, checked) {
  selectedIds.value = checked ? [...new Set([...selectedIds.value, id])] : selectedIds.value.filter((item) => item !== id)
}

async function removeAircraft(item) {
  if (item.status === 'online') return message.error('在线飞机禁止删除，请先离线')
  if (!await askConfirm('删除飞机资产', `确认删除 ${item.aircraftId}（${item.name || '-'}）？`)) return
  try {
    await taskApiRequest(`/aircrafts/${encodeResourceId(item.aircraftId)}`, { method: 'DELETE' })
    message.success(`已删除飞机 ${item.aircraftId}`)
    if (editingId.value === item.aircraftId) resetForm()
    await loadData()
  } catch (error) {
    errorText.value = error.message
  }
}

async function batchRemove() {
  if (!selectedIds.value.length) return message.warning('请先选择飞机')
  const online = selectedIds.value.filter((id) => aircrafts.value.find((item) => item.aircraftId === id)?.status === 'online')
  if (online.length) return message.error(`在线飞机禁止删除：${online.join('、')}`)
  if (!await askConfirm('批量删除飞机', `确认删除所选 ${selectedIds.value.length} 架飞机？`)) return
  try {
    await Promise.all(selectedIds.value.map((id) => taskApiRequest(`/aircrafts/${encodeResourceId(id)}`, { method: 'DELETE' })))
    message.success('批量删除完成')
    selectedIds.value = []
    resetForm()
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
        <div class="summary-card"><span>飞机总数</span><strong>{{ aircrafts.length }}</strong><small>已登记飞机资产</small></div>
        <div class="summary-card success"><span>当前在线</span><strong>{{ onlineCount }}</strong><small>可参与正式任务发布</small></div>
        <div class="summary-card warning"><span>维护状态</span><strong>{{ maintenanceCount }}</strong><small>已暂停任务调度</small></div>
      </section>

      <a-alert v-if="errorText" class="mb-4" type="error" show-icon :message="errorText" />

      <div class="management-layout">
        <section class="management-panel list-panel">
          <div class="management-toolbar">
            <div><h2>飞机资产台账</h2><p>维护飞机身份、机型绑定、网络地址与运行状态</p></div>
            <div class="toolbar-actions">
              <a-input-search v-model:value="keyword" allow-clear placeholder="搜索 ID、名称、机型或 IP" />
              <a-select v-model:value="statusFilter" class="status-filter"><a-select-option value="all">全部状态</a-select-option><a-select-option value="online">在线</a-select-option><a-select-option value="offline">离线</a-select-option><a-select-option value="maintenance">维护中</a-select-option></a-select>
              <a-button danger :disabled="!selectedIds.length" @click="batchRemove">批量删除</a-button>
              <a-button :loading="loading" @click="loadData">刷新</a-button>
            </div>
          </div>

          <div class="resource-table-wrap">
            <table class="resource-table">
              <thead><tr><th class="check-cell"></th><th>飞机</th><th>绑定机型</th><th>网络地址</th><th>运行状态</th><th class="action-cell">操作</th></tr></thead>
              <tbody>
                <tr v-for="aircraft in filteredAircrafts" :key="aircraft.aircraftId">
                  <td class="check-cell"><a-checkbox :checked="selectedIds.includes(aircraft.aircraftId)" :disabled="aircraft.status === 'online'" @update:checked="toggleSelection(aircraft.aircraftId, $event)" /></td>
                  <td><strong>{{ aircraft.name || '-' }}</strong><small>{{ aircraft.aircraftId }}</small></td>
                  <td><span class="model-badge">{{ aircraft.modelCode || '未绑定' }}</span></td>
                  <td>{{ aircraft.ipAddr || '-' }}</td>
                  <td><span :class="['status-badge', aircraft.status]"><i></i>{{ aircraft.status === 'online' ? '在线' : aircraft.status === 'maintenance' ? '维护中' : '离线' }}</span></td>
                  <td class="action-cell"><a-button type="link" @click="editAircraft(aircraft)">编辑</a-button><a-button type="link" danger :disabled="aircraft.status === 'online'" @click="removeAircraft(aircraft)">删除</a-button></td>
                </tr>
                <tr v-if="!filteredAircrafts.length"><td colspan="6"><a-empty description="暂无匹配飞机" /></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="management-panel form-panel">
          <div class="form-heading"><span class="form-icon">{{ editingId ? '✎' : '＋' }}</span><div><h2>{{ editingId ? '编辑飞机' : '新增飞机' }}</h2><p>{{ editingId ? `正在编辑 ${editingId}` : '登记新的飞机资产' }}</p></div></div>
          <div class="form-body">
            <label>飞机 ID <b>*</b></label><a-input v-model:value="form.aircraftId" :disabled="!!editingId" placeholder="例如 UAV-001" />
            <label>展示名称 <b>*</b></label><a-input v-model:value="form.name" placeholder="例如 一号巡检机" />
            <label>绑定机型 <b>*</b></label><a-select v-model:value="form.modelCode" class="w-full" placeholder="选择机型"><a-select-option v-for="model in models" :key="model.modelCode" :value="model.modelCode">{{ model.modelCode }} · {{ model.modelName }}</a-select-option></a-select>
            <label>机载节点 IP</label><a-input v-model:value="form.ipAddr" placeholder="例如 192.168.1.20" />
            <label>运行状态</label><a-segmented v-model:value="form.status" block :options="[{ label: '离线', value: 'offline' }, { label: '在线', value: 'online' }, { label: '维护中', value: 'maintenance' }]" />
            <a-button block type="primary" size="large" :loading="saving" @click="saveAircraft">{{ editingId ? '保存修改' : '创建飞机资产' }}</a-button>
            <a-button block @click="resetForm">{{ editingId ? '取消编辑' : '清空表单' }}</a-button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './management.css';
</style>
