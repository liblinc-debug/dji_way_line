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
        <h3 class="section-title mb-2">选择飞行器</h3>
        <a-row :gutter="12">
          <a-col :span="4" v-for="aircraft in aircraftSeriesList" :key="aircraft.id">
            <div class="aircraft-card" :class="{ 'aircraft-card-active': form.aircraftSeries === aircraft.id }"
              @click="selectSeries(aircraft.id)">
              {{ aircraft.name }}
            </div>
          </a-col>
        </a-row>
      </div>

      <div class="mb-4">
        <h3 class="section-title mb-2">选择型号</h3>
        <a-row :gutter="12">
          <a-col :span="4" v-for="model in currentModels" :key="model.key">
            <div class="aircraft-card" :class="{ 'aircraft-card-active': form.aircraftModel === model.modelId }"
              @click="form.aircraftModel = model.modelId">
              {{ model.label }}
            </div>
          </a-col>
        </a-row>
      </div>

      <div class="mb-0">
        <h3 class="section-title mb-2">航线名称</h3>
        <a-input v-model:value="form.missionName" placeholder="请输入航线名称" />
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
import { computed, reactive, watch } from 'vue';
import {
  getAircraftModelMeta,
  getLegacyAircraftModelOptions,
  getV2CompatibleWaypointExportMeta,
  LEGACY_AIRCRAFT_SERIES_LIST
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
const aircraftSeriesList = LEGACY_AIRCRAFT_SERIES_LIST;

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
  aircraftSeries: 'm30',
  aircraftModel: 'm30t',
  missionName: '新建航点航线'
});

const applyInitialValues = (values = {}) => {
  const model = getAircraftModelMeta(values.aircraftModel);
  form.routeType = 'waypoint';
  if (model) {
    form.aircraftSeries = model.aircraftSeries;
    form.aircraftModel = model.id;
  }
  if (values.missionName) {
    form.missionName = values.missionName;
  }
};

watch(
  () => props.initialValues,
  (values) => applyInitialValues(values),
  { deep: true, immediate: true }
);

const currentModels = computed(() => getLegacyAircraftModelOptions(form.aircraftSeries, 'waypoint'));

const selectRoute = (route) => {
  if (route.disabled) return;
  form.routeType = 'waypoint';
  if (!form.missionName || form.missionName === '新建航线') {
    form.missionName = '新建航点航线';
  }
};

const selectSeries = (seriesId) => {
  form.aircraftSeries = seriesId;
  const seriesModels = getLegacyAircraftModelOptions(seriesId, 'waypoint');
  if (seriesModels.length > 0) {
    form.aircraftModel = seriesModels[0].modelId;
  }
};

watch(
  () => form.aircraftSeries,
  (seriesId) => {
    const seriesModels = getLegacyAircraftModelOptions(seriesId, 'waypoint');
    if (!seriesModels.some((model) => model.modelId === form.aircraftModel)) {
      form.aircraftModel = seriesModels[0]?.modelId || '';
    }
  }
);

const handleConfirm = () => {
  emit('confirm', {
    ...form,
    routeType: 'waypoint',
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
