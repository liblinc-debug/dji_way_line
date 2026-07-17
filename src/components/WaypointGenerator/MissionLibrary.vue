<template>
  <div class="h-full bg-white flex flex-col shadow-lg font-sans overflow-hidden border-r border-gray-200">
    <div class="p-4 bg-gray-50 border-b border-gray-200">
      <div class="flex justify-between items-center mb-3">
        <h2 class="m-0 text-base font-medium text-gray-900">航线库</h2>
        <a-button type="text" size="small" @click="$emit('create')">
          <template #icon><span class="text-lg">+</span></template>
        </a-button>
      </div>

      <div class="flex gap-3">
        <a-dropdown>
          <a class="text-xs text-gray-500 flex items-center gap-1 cursor-pointer hover:text-primary" @click.prevent>
            全部机型
            <span class="text-[10px]">▼</span>
          </a>
          <template #overlay>
            <a-menu>
              <a-menu-item>全部机型</a-menu-item>
              <a-menu-item>Matrice 30</a-menu-item>
              <a-menu-item>Mavic 3E/T</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <a-dropdown>
          <a class="text-xs text-gray-500 flex items-center gap-1 cursor-pointer hover:text-primary" @click.prevent>
            时间倒序
            <span class="text-[10px]">▼</span>
          </a>
          <template #overlay>
            <a-menu>
              <a-menu-item>时间倒序</a-menu-item>
              <a-menu-item>时间正序</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2.5">
      <a-list :data-source="sortedMissions" :split="false">
        <template #renderItem="{ item }">
          <div
            class="bg-gray-50 rounded p-3 mb-2 cursor-pointer border border-transparent transition-all hover:bg-gray-100 group relative"
            @click="$emit('select', item.id)">
            <div class="flex justify-between items-start gap-2 mb-2 pr-14">
              <span class="text-sm font-medium text-gray-900 truncate min-w-0 flex-1">{{ item.name }}</span>
              <div class="flex gap-1 flex-none">
                <a-button type="text" size="small" class="!px-1 !h-6" @click.stop="$emit('download', item.id)">
                  <span class="text-xs">下载</span>
                </a-button>
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
import { computed } from 'vue';
import {
  getDroneDisplayName,
  getLegacyAircraftModelDisplayName
} from '../../constants/aircraftModels.js';

const props = defineProps({
  missions: {
    type: Array,
    default: () => []
  }
});

defineEmits(['create', 'select', 'edit', 'delete', 'download']);

const sortedMissions = computed(() => [...props.missions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
const simpleImage = Empty.PRESENTED_IMAGE_SIMPLE;

const getDroneName = (aircraftModel, droneEnumValue, droneSubEnumValue) => (
  getLegacyAircraftModelDisplayName(aircraftModel) || getDroneDisplayName(droneEnumValue, droneSubEnumValue)
);

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
