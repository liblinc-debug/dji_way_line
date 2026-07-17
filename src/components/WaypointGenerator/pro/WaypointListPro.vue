<template>
  <div class="flex flex-col text-gray-700">
    <div class="flex justify-between items-center mb-4 px-1">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">航点列表</span>
        <span class="text-xs text-gray-400">({{ waypoints.length }})</span>
      </div>
      <div class="flex gap-1">
        <a-button size="small" type="text" class="!text-gray-500 hover:!bg-gray-100 !px-1"
          :disabled="waypoints.length < 2" @click="$emit('reverse')">
          反转
        </a-button>
        <a-popconfirm title="确定要清空所有航点吗？" @confirm="$emit('clear')">
          <a-button size="small" type="text" danger class="hover:!bg-red-50 !px-1">
            清空
          </a-button>
        </a-popconfirm>
      </div>
    </div>

    <!-- 中心线航点提示 -->
    <div v-if="isCenterline && waypoints.length > 0"
      class="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-[10px] text-blue-300">
      💡 提示: 中心线航点修改后航线将自动重构。
    </div>

    <div class="flex flex-col gap-3 relative h-full">
      <div v-for="(wp, index) in waypoints" :key="index"
        class="bg-white p-3 rounded-lg border transition-all shadow-sm hover:shadow-md relative group cursor-pointer"
        :class="selectedWpIndex === index ? 'border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/10' : 'border-gray-100 hover:border-blue-300'"
        @click="$emit('select', index)">

        <div class="flex justify-between items-center mb-2">
          <div class="flex items-center gap-2">
            <!-- Index Badge -->
            <div
              class="w-5 h-5 rounded-sm bg-blue-600 flex items-center justify-center text-white text-[9px] font-black italic">
              #{{ index + 1 }}
            </div>
            <!-- Added Actions List -->
            <div v-if="!isCenterline" class="flex flex-wrap gap-1 mt-1">
              <div v-for="(action, aIdx) in wp.actions" :key="aIdx"
                class="px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 transition-all" :class="[
                  selectedWpIndex === index && selectedActionIndex === aIdx
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                ]" @click.stop="$emit('select-action', { wpIndex: index, actionIndex: aIdx })">
                <span>{{ ACTION_ICON[action.type] }}</span>
                <span class="font-medium">{{ ACTION_LABEL[action.type] }}</span>
                <button @click.stop="$emit('remove-action', { wpIndex: index, actionIndex: aIdx })"
                  class="ml-1 opacity-40 hover:opacity-100 italic">×</button>
              </div>

              <!-- Add Action Trigger -->
              <a-popover trigger="click" placement="rightTop" overlay-class-name="action-picker-popover">
                <template #content>
                  <div class="grid grid-cols-4 gap-2 p-2 w-64 bg-white rounded-lg border border-gray-100 shadow-xl">
                    <div v-for="(label, type) in ACTION_LABEL" :key="type"
                      class="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors group"
                      @click="$emit('add-action', { wpIndex: index, type })">
                      <span class="text-xl transform group-hover:scale-110 transition-transform">{{ ACTION_ICON[type]
                        }}</span>
                      <span class="text-[8px] text-gray-500 text-center leading-tight font-medium">{{ label }}</span>
                    </div>
                  </div>
                </template>
                <button
                  class="px-1.5 py-0.5 rounded border border-dashed border-gray-300 text-[10px] text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all">
                  ＋ 添加动作
                </button>
              </a-popover>
            </div>
          </div>

          <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button @click.stop="$emit('record-pose', index)"
              class="text-xs hover:text-blue-600 text-gray-400 transition-colors" title="记录姿态">📸</button>
            <button @click.stop="$emit('remove', index)"
              class="text-xs hover:text-red-500 text-gray-400 transition-colors" title="删除">🗑️</button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="bg-gray-50 p-2 rounded border border-gray-100">
            <div class="text-[8px] text-gray-400 uppercase font-black mb-0.5">纬度</div>
            <div class="text-[10px] font-mono text-blue-600">{{ wp.lat.toFixed(6) }}</div>
          </div>
          <div class="bg-gray-50 p-2 rounded border border-gray-100">
            <div class="text-[8px] text-gray-400 uppercase font-black mb-0.5">经度</div>
            <div class="text-[10px] font-mono text-blue-600">{{ wp.lng.toFixed(6) }}</div>
          </div>
          <div class="bg-gray-50/50 p-2 rounded border border-gray-100 flex items-center justify-between">
            <span class="text-[8px] text-gray-400 uppercase font-black">相对高度</span>
            <span class="text-[10px] font-bold text-gray-700">{{ wp.height || 0 }}m</span>
          </div>
          <div class="bg-gray-50/50 p-2 rounded border border-gray-100 flex items-center justify-between">
            <span class="text-[8px] text-gray-400 uppercase font-black">速度</span>
            <span class="text-[10px] font-bold text-gray-700">{{ wp.speed || 0 }}m/s</span>
          </div>
        </div>
      </div>

      <div v-if="waypoints.length === 0"
        class="py-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
        <span class="text-3xl mb-2 opacity-40">🗺️</span>
        <span class="text-[10px] text-gray-400 uppercase font-black tracking-widest">暂无航点</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ACTION_ICON } from '../../../types/waypointRoute.js';

const props = defineProps({
  waypoints: {
    type: Array,
    required: true
  },
  isCenterline: {
    type: Boolean,
    default: false
  },
  selectedWpIndex: {
    type: Number,
    default: -1
  },
  selectedActionIndex: {
    type: Number,
    default: -1
  }
});

const emit = defineEmits([
  'update:waypoints', 'remove', 'clear', 'reverse', 'record-pose',
  'preview-action', 'select', 'select-action', 'add-action', 'remove-action'
]);

import { ACTION_LABEL } from '../../../types/waypointRoute.js';

const updateWaypoint = (index, key, value) => {
  const newWaypoints = [...props.waypoints];
  newWaypoints[index] = { ...newWaypoints[index], [key]: value };
  emit('update:waypoints', newWaypoints);
};
</script>

<style scoped>
/* 可以在此处增加更细腻的深色模式样式覆盖 */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 2px;
}

.dji-light-input {
  border-radius: 4px !important;
  border: 1px solid #eee !important;
  background: #fafafa !important;
}

.dji-light-input :deep(.ant-input-number-input) {
  font-weight: 600 !important;
  color: #555 !important;
}

.dji-light-checkbox :deep(.ant-checkbox-inner) {
  border-radius: 3px !important;
}
</style>
