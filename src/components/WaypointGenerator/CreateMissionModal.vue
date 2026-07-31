<template>
  <a-modal :open="visible" title="创建航线" :width="900" @cancel="$emit('cancel')" centered class="create-mission-modal">
    <div class="modal-content px-4">
      <div v-for="group in routeGroups" :key="group.title" class="mb-4">
        <h3 class="section-title mb-2">{{ group.title }}</h3>
        <a-row :gutter="12">
          <a-col :span="6" v-for="route in group.routes" :key="route.type">
            <div
              class="route-card"
              :class="{
                'route-card-active': form.routeType === route.type,
                'route-card-disabled': route.disabled
              }"
              @click="selectRoute(route)"
            >
              <div class="route-icon mb-2" v-html="route.icon"></div>
              <div class="route-name text-xs">{{ route.name }}</div>
              <div v-if="route.disabled" class="route-status">暂不可用</div>
            </div>
          </a-col>
        </a-row>
      </div>

      <div class="mb-4">
        <h3 class="section-title mb-2">选择型号（机型管理）</h3>
        <div class="text-[11px] text-gray-500 mb-2">优先显示你在机型管理中定义的机型；若未配置则回退到内置机型。</div>
        <div v-if="modelLoadError" class="text-[11px] text-red-500 mb-2">{{ modelLoadError }}</div>
        <a-row :gutter="12">
          <a-col :span="6" v-for="model in modelOptions" :key="model.modelCode">
            <div class="aircraft-card" :class="{ 'aircraft-card-active': form.aircraftModel === model.modelCode }"
              @click="form.aircraftModel = model.modelCode">
              {{ model.modelName }}
            </div>
          </a-col>
        </a-row>
      </div>

      <div class="mb-0">
        <h3 class="section-title mb-2">航线名称</h3>
        <a-input :value="form.missionName" placeholder="请输入航线名称" @update:value="form.missionName = $event" />
      </div>

      <div class="mb-0 mt-4">
        <h3 class="section-title mb-2">适用范围与能力约束（1.2.1）</h3>
        <div class="text-[12px] text-gray-500 mb-2">航线将按当前选中机型自动绑定，不再绑定具体飞机。</div>
        <div class="mt-2 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <span class="text-[12px] text-gray-600">自动匹配可执行飞机</span>
          <a-switch :checked="form.autoMatch" @update:checked="form.autoMatch = $event" />
        </div>
        <div class="mt-2">
          <div class="text-[12px] text-gray-500 mb-1">能力需求（JSON）</div>
          <a-textarea
            :value="form.requirementsJson"
            @update:value="form.requirementsJson = $event"
            :rows="4"
            placeholder='如: [{"key":"supports_gimbal","op":"eq","value":true}]'
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <a-button @click="$emit('cancel')">取消</a-button>
        <a-button type="primary" @click="handleConfirm">确定</a-button>
      </div>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import {
  AIRCRAFT_MODEL_META,
  getAircraftModelMeta,
  getV2CompatibleWaypointExportMeta
} from '../../constants/aircraftModels.js';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  initialValues: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['cancel', 'confirm']);
const modelLoadError = ref('');
const userDefinedModels = ref([]);

const fallbackModels = Object.values(AIRCRAFT_MODEL_META).map((item) => ({
  modelCode: item.id,
  modelName: item.name
}));

const modelOptions = computed(() => (
  userDefinedModels.value.length ? userDefinedModels.value : fallbackModels
));

const loadUserDefinedModels = async () => {
  modelLoadError.value = '';
  try {
    const apiBase = localStorage.getItem('uav_task_api_base') || 'http://127.0.0.1:8090';
    const resp = await fetch(`${apiBase}/models`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json().catch(() => ({}));
    const items = Array.isArray(data?.items) ? data.items : [];
    userDefinedModels.value = items
      .map((item) => ({
        modelCode: String(item?.modelCode || '').trim(),
        modelName: String(item?.modelName || item?.modelCode || '').trim()
      }))
      .filter((item) => item.modelCode);
  } catch (error) {
    userDefinedModels.value = [];
    modelLoadError.value = '未获取到机型管理数据，已使用内置机型。';
  }
};

const waypointIcon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 18L9 6L14 14L20 4" stroke-linecap="round" stroke-linejoin="round" /><circle cx="4" cy="18" r="2" fill="currentColor" /><circle cx="9" cy="6" r="2" fill="currentColor" /><circle cx="14" cy="14" r="2" fill="currentColor" /><circle cx="20" cy="4" r="2" fill="currentColor" /></svg>';
const patrolIcon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></svg>';
const mappingIcon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16v16H4z" stroke-dasharray="2 2" /><path d="M6 8h8M14 8v4M14 12H6M6 12v4M6 16h8" /></svg>';
const stripIcon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12c0-4 2-8 6-8s6 4 6 8s2 8 6 8" /></svg>';
const slopeIcon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 22L12 2L22 22H2Z" /></svg>';
const geometryIcon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>';
const closePhotographyIcon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 2v4M16 2v4M8 18v4M16 18v4" /></svg>';

const routeGroups = [
  {
    title: '巡逻巡检航线',
    routes: [
      { type: 'waypoint', name: '航点航线', icon: waypointIcon },
      { type: 'patrol', name: '巡逻航线', icon: patrolIcon, disabled: true }
    ]
  },
  {
    title: '测绘航线',
    routes: [
      { type: 'mapping', name: '面状航线', icon: mappingIcon, disabled: true },
      { type: 'strip', name: '带状航线', icon: stripIcon, disabled: true }
    ]
  },
  {
    title: '精细化测绘航线',
    routes: [
      { type: 'slope', name: '斜面航线', icon: slopeIcon, disabled: true },
      { type: 'geometry', name: '几何体航线', icon: geometryIcon, disabled: true },
      { type: 'closePhotography', name: '贴近摄影航线', icon: closePhotographyIcon, disabled: true }
    ]
  }
];

const form = reactive({
  routeType: 'waypoint',
  aircraftModel: 'm30t',
  missionName: '新建航点航线',
  autoMatch: true,
  requirementsJson: '[{"key":"supports_gimbal","op":"eq","value":true}]'
});

const applyInitialValues = (values = {}) => {
  const model = getAircraftModelMeta(values.aircraftModel);
  form.routeType = 'waypoint';
  if (model) {
    form.aircraftModel = model.id;
  } else if (values.aircraftModel) {
    form.aircraftModel = String(values.aircraftModel);
  }
  if (values.missionName) {
    form.missionName = values.missionName;
  }
  form.autoMatch = values?.routeLinking?.autoMatch !== false;
  form.requirementsJson = values?.routeLinking?.requirements
    ? JSON.stringify(values.routeLinking.requirements, null, 2)
    : '[{"key":"supports_gimbal","op":"eq","value":true}]';
};

watch(
  () => props.initialValues,
  (values) => applyInitialValues(values),
  { deep: true, immediate: true }
);

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    loadUserDefinedModels();
  },
  { immediate: true }
);

watch(
  () => modelOptions.value,
  (options) => {
    if (!options.length) return;
    if (!options.some((item) => item.modelCode === form.aircraftModel)) {
      form.aircraftModel = options[0].modelCode;
    }
  },
  { immediate: true }
);

const selectRoute = (route) => {
  if (route.disabled) return;
  form.routeType = 'waypoint';
  if (!form.missionName || form.missionName === '新建航线') {
    form.missionName = '新建航点航线';
  }
};

const handleConfirm = () => {
  let requirements = [];
  try {
    const parsed = JSON.parse(form.requirementsJson || '[]');
    requirements = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    requirements = [];
  }

  emit('confirm', {
    ...form,
    routeType: 'waypoint',
    routeLinking: {
      autoMatch: form.autoMatch,
      modelCodes: form.aircraftModel ? [form.aircraftModel] : [],
      aircraftIds: [],
      requirements
    },
    ...getV2CompatibleWaypointExportMeta(form.aircraftModel)
  });
};
</script>

<style scoped>
.modal-content {
  padding: 0;
}

.section-title {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 8px;
  font-weight: 500;
}

.route-card {
  background: #f9fafb;
  border: 2px solid transparent;
  border-radius: 6px;
  padding: 14px 12px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  min-height: 96px;
}

.route-card:hover:not(.route-card-disabled) {
  background: #f3f4f6;
  transform: translateY(-2px);
}

.route-card-active {
  background: #dbeafe !important;
  border-color: #3498db !important;
}

.route-card-disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: grayscale(1);
  background: #f3f4f6;
  border-color: #e5e7eb;
}

.route-icon {
  margin-bottom: 8px;
  color: #6b7280;
  line-height: 0;
}

.route-card-active .route-icon {
  color: #3498db;
}

.route-card-disabled .route-icon,
.route-card-disabled .route-name {
  color: #9ca3af;
}

.route-name {
  font-size: 12px;
  color: #374151;
  font-weight: 500;
  text-align: center;
}

.route-status {
  margin-top: 5px;
  font-size: 10px;
  color: #9ca3af;
  line-height: 1;
}

.aircraft-card {
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px 4px;
  cursor: pointer;
  text-align: center;
  font-size: 12px;
  color: #374151;
  transition: all 0.3s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aircraft-card:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.aircraft-card-active {
  background: #3498db !important;
  border-color: #3498db !important;
  color: white !important;
  font-weight: 600;
}
</style>
