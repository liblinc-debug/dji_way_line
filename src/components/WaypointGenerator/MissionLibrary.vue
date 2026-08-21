<template>
  <div class="h-full bg-white flex flex-col shadow-lg font-sans overflow-hidden border-r border-gray-200">
    <div class="p-4 bg-gray-50 border-b border-gray-200">
      <div class="flex justify-between items-center mb-3">
        <h2 class="m-0 text-base font-medium text-gray-900">航线库</h2>
        <div class="flex items-center gap-1">
          <input ref="importInput" class="hidden" type="file" accept=".kmz,.json,application/json,application/vnd.google-earth.kmz"
            @change="handleImportFile" />
          <a-tooltip title="导入航线（支持 KMZ/JSON）">
            <a-button type="text" size="small" aria-label="导入航线" @click="importInput?.click()">
              <template #icon>
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
                </svg>
              </template>
            </a-button>
          </a-tooltip>
          <a-button type="text" size="small" title="新增航线" @click="$emit('create')">
            <template #icon><span class="text-lg">+</span></template>
          </a-button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <a-select :value="activeModelFilter" size="small" @update:value="activeModelFilter = $event">
          <a-select-option value="all">全部机型</a-select-option>
          <a-select-option v-for="code in modelFilterOptions" :key="code" :value="code">{{ code }}</a-select-option>
        </a-select>

        <a-select :value="sortOrder" size="small" @update:value="sortOrder = $event">
          <a-select-option value="desc">时间倒序</a-select-option>
          <a-select-option value="asc">时间正序</a-select-option>
        </a-select>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2.5">
      <a-list :data-source="sortedMissions" :split="false">
        <template #renderItem="{ item }">
          <div
            class="bg-gray-50 rounded p-3 mb-2 cursor-pointer border border-transparent transition-all hover:bg-gray-100 group relative"
            @click="$emit('select', item.id)">
            <div class="flex justify-between items-start gap-2 mb-2">
              <div v-if="editingMissionId === item.id" class="flex min-w-0 flex-1 items-center gap-1" @click.stop>
                <a-input
                  v-model:value="draftMissionName"
                  size="small"
                  class="min-w-0 flex-1"
                  :maxlength="80"
                  autofocus
                  @press-enter="confirmRename(item.id)"
                  @keydown.esc="cancelRename"
                />
                <a-button type="text" size="small" class="!h-7 !px-1 text-green-600" title="保存名称"
                  :disabled="!draftMissionName.trim()" @click.stop="confirmRename(item.id)">✅</a-button>
                <a-button type="text" size="small" class="!h-7 !px-1 text-gray-500" title="取消编辑"
                  @click.stop="cancelRename">✕</a-button>
              </div>
              <div v-else class="flex min-w-0 flex-1 items-center gap-1">
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{{ item.name }}</span>
                <a-button type="text" size="small" class="!h-6 !px-1 opacity-70 hover:opacity-100"
                  title="编辑航线名称" @click.stop="startRename(item)">✏️</a-button>
              </div>
              <div v-if="editingMissionId !== item.id" class="flex gap-1 flex-none">
                <a-dropdown :trigger="['click']">
                  <a-button type="text" size="small" class="!px-1 !h-6" @click.stop>
                    <span class="text-xs">下载⌄</span>
                  </a-button>
                  <template #overlay>
                    <a-menu @click="handleDownloadMenuClick($event, item.id)">
                      <a-menu-item key="kmz">下载 KMZ</a-menu-item>
                      <a-menu-item key="json">下载 JSON</a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
                <a-button type="text" size="small" class="!px-1 !h-6" @click.stop="$emit('edit', item.id)">
                  <span class="text-xs">编辑</span>
                </a-button>
                <a-popconfirm title="确定要删除该航线吗？" ok-text="确定" cancel-text="取消" @confirm="$emit('delete', item.id)"
                  @click.stop>
                  <a-button type="text" danger size="small" class="!px-1 !h-6" @click.stop>
                    <span class="text-xs">删除</span>
                  </a-button>
                </a-popconfirm>
              </div>
            </div>

            <div class="text-xs text-gray-600">
              <div class="flex items-center gap-1.5 mb-1">
                <span>{{ getDroneName(item.config.aircraftModel, item.config.droneEnumValue, item.config.droneSubEnumValue) }}</span>
              </div>
              <div class="flex items-center gap-1 mt-1 flex-wrap">
                <a-tag v-for="code in getLinkedModelCodes(item)" :key="`${item.id}-${code}`" color="blue" class="!text-[10px] !px-1 !py-0">
                  {{ code }}
                </a-tag>
              </div>
              <div class="text-[11px] text-gray-400 mt-2">
                <span>更新时间 {{ formatDate(item.updatedAt) }}</span>
              </div>
            </div>
          </div>
        </template>

        <template #empty>
          <div class="py-12 flex flex-col items-center">
            <a-empty description="暂无航线" :image="simpleImage" />
            <a-button type="primary" class="mt-4" @click="$emit('create')">新建航线</a-button>
          </div>
        </template>
      </a-list>
    </div>
  </div>
</template>

<script setup>
import { Empty } from 'ant-design-vue';
import { computed, ref } from 'vue';
import {
  getDroneDisplayName,
  getLegacyAircraftModelDisplayName
} from '../../constants/aircraftModels.js';
import { getMissionLinkingSummary } from '../../utils/routeLinking.js';

const props = defineProps({
  missions: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['create', 'select', 'edit', 'delete', 'download', 'rename', 'import']);

const activeModelFilter = ref('all');
const sortOrder = ref('desc');
const editingMissionId = ref(null);
const draftMissionName = ref('');
const importInput = ref(null);

const handleImportFile = (event) => {
  const file = event.target.files?.[0];
  if (file) emit('import', file);
  event.target.value = '';
};

const startRename = (mission) => {
  editingMissionId.value = mission.id;
  draftMissionName.value = String(mission.name || '');
};

const cancelRename = () => {
  editingMissionId.value = null;
  draftMissionName.value = '';
};

const confirmRename = (id) => {
  const name = draftMissionName.value.trim();
  if (!name) return;
  emit('rename', { id, name });
  cancelRename();
};

const handleDownloadMenuClick = ({ key }, id) => {
  emit('download', { id, format: key });
};

const modelFilterOptions = computed(() => {
  const set = new Set();
  for (const m of props.missions || []) {
    const summary = getMissionLinkingSummary(m);
    for (const code of summary.modelCodes || []) {
      set.add(code);
    }
    if (m?.config?.aircraftModel) {
      set.add(m.config.aircraftModel);
    }
  }
  return [...set];
});

const sortedMissions = computed(() => {
  const filtered = (props.missions || []).filter((m) => {
    if (activeModelFilter.value === 'all') return true;
    const summary = getMissionLinkingSummary(m);
    const linked = summary.modelCodes || [];
    return linked.includes(activeModelFilter.value) || m?.config?.aircraftModel === activeModelFilter.value;
  });

  const factor = sortOrder.value === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => ((a.updatedAt || 0) - (b.updatedAt || 0)) * factor);
});
const simpleImage = Empty.PRESENTED_IMAGE_SIMPLE;

const getDroneName = (aircraftModel, droneEnumValue, droneSubEnumValue) => (
  getLegacyAircraftModelDisplayName(aircraftModel) || getDroneDisplayName(droneEnumValue, droneSubEnumValue)
);

const getLinkedModelCodes = (mission) => getMissionLinkingSummary(mission).modelCodes || [];

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\//g, '-');
};
</script>

<style scoped>
:deep(.ant-list-empty-text) {
  padding: 0;
}
</style>
