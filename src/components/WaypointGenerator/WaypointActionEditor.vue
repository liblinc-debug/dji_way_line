<template>
  <a-modal :open="open" title="航点动作设置" @ok="handleOk" @cancel="$emit('cancel')" width="600px" ok-text="确定"
    cancel-text="取消">
    <div class="waypoint-action-editor">
      <div class="mb-4">
        <a-button type="primary" @click="addAction">
          <template #icon><span>➕</span></template>
          添加动作
        </a-button>
      </div>

      <a-table :dataSource="localActions" :columns="columns" :pagination="false" size="small">
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'type'">
            <a-select v-model:value="record.type" style="width: 120px" @change="handleTypeChange(index)">
              <a-select-option v-for="(label, type) in ACTION_LABEL" :key="type" :value="type">
                {{ ACTION_ICON[type] }} {{ label }}
              </a-select-option>
            </a-select>
          </template>

          <template v-if="column.key === 'params'">
            <div class="flex flex-col gap-2">
              <!-- 变焦参数 -->
              <div v-if="record.type === ACTION_TYPE.ZOOM"
                class="w-[220px] flex flex-col gap-2 p-2 bg-gray-50/50 rounded-lg border border-gray-100">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] text-gray-400 font-bold uppercase">Zoom</span>
                  <span class="text-sm font-black text-blue-500 font-mono">{{ record.params.zoomFactor?.toFixed(1) ||
                    '1.0' }}X</span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    @click="record.params.zoomFactor = Math.max(1, +((record.params.zoomFactor || 1) - 1).toFixed(1))"
                    class="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded shadow-sm">−</button>
                  <a-slider v-model:value="record.params.zoomFactor" :min="1" :max="112" :step="0.1"
                    class="flex-1 !m-0 zoom-slider-custom" />
                  <button
                    @click="record.params.zoomFactor = Math.min(112, +((record.params.zoomFactor || 1) + 1).toFixed(1))"
                    class="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded shadow-sm">+</button>
                </div>
              </div>

              <!-- 云台俯仰参数 -->
              <div v-if="record.type === ACTION_TYPE.GIMBAL_PITCH" class="flex flex-col gap-1 w-full max-w-[200px]">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-gray-400 font-bold">俯仰角度</span>
                  <span class="text-gray-600 font-black font-mono text-sm">{{ record.params.gimbalPitchRotateAngle || 0
                  }}°</span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    @click="record.params.gimbalPitchRotateAngle = Math.max(-90, (record.params.gimbalPitchRotateAngle || 0) - 1)"
                    class="step-btn">−</button>
                  <a-slider v-model:value="record.params.gimbalPitchRotateAngle" :min="-90" :max="70"
                    class="flex-1 zoom-slider-custom" />
                  <button
                    @click="record.params.gimbalPitchRotateAngle = Math.min(70, (record.params.gimbalPitchRotateAngle || 0) + 1)"
                    class="step-btn">+</button>
                </div>
              </div>

              <!-- 悬停参数 -->
              <div v-if="record.type === ACTION_TYPE.HOVER" class="flex items-center gap-2">
                <span class="text-xs text-gray-500">悬停时间:</span>
                <a-input-number v-model:value="record.params.hoverTime" :min="1" :max="3600" size="small" />
                <span class="text-xs text-gray-400">s</span>
              </div>

              <!-- 偏航角参数 -->
              <div v-if="record.type === ACTION_TYPE.AIRCRAFT_YAW" class="flex flex-col gap-2 w-full max-w-[200px]">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-gray-400 font-bold">机头朝向</span>
                  <span class="text-gray-600 font-black font-mono text-sm">{{ record.params.aircraftYawAngle || 0
                  }}°</span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    @click="record.params.aircraftYawAngle = ((record.params.aircraftYawAngle || 0) - 1 + 360) % 360"
                    class="step-btn">−</button>
                  <a-slider v-model:value="record.params.aircraftYawAngle" :min="0" :max="359"
                    class="flex-1 zoom-slider-custom" />
                  <button @click="record.params.aircraftYawAngle = ((record.params.aircraftYawAngle || 0) + 1) % 360"
                    class="step-btn">+</button>
                </div>
                <a-radio-group v-model:value="record.params.aircraftRotateDirection" size="small" class="mt-1">
                  <a-radio :value="0">顺时针</a-radio>
                  <a-radio :value="1">逆时针</a-radio>
                </a-radio-group>
              </div>

              <!-- 等时间隔拍照 -->
              <div v-if="record.type === ACTION_TYPE.START_TIMED_PHOTO" class="flex items-center gap-2">
                <span class="text-xs text-gray-500">间隔时长:</span>
                <a-input-number v-model:value="record.params.photoInterval" :min="1" :max="30" size="small" />
                <span class="text-xs text-gray-400">s</span>
              </div>

              <!-- 等距间隔拍照 -->
              <div v-if="record.type === ACTION_TYPE.START_DISTANCE_PHOTO" class="flex items-center gap-2">
                <span class="text-xs text-gray-500">间隔距离:</span>
                <a-input-number v-model:value="record.params.photoDistanceInterval" :min="1" :max="100" size="small" />
                <span class="text-xs text-gray-400">m</span>
              </div>

              <!-- 全景拍照 -->
              <div v-if="record.type === ACTION_TYPE.PANORAMA" class="flex items-center gap-2">
                <span class="text-xs text-gray-500">全景模式:</span>
                <a-select v-model:value="record.params.subMode" size="small" style="width: 100px">
                  <a-select-option value="pano_shot_360">360° 全景</a-select-option>
                  <a-select-option value="pano_shot_3x1">3x1 全景</a-select-option>
                  <a-select-option value="pano_shot_3x3">3x3 全景</a-select-option>
                  <a-select-option value="pano_shot_3x7">3x7 全景</a-select-option>
                </a-select>
              </div>

              <!-- 新建文件夹 -->
              <div v-if="record.type === ACTION_TYPE.CUSTOM_DIR_NAME" class="flex items-center gap-2">
                <span class="text-xs text-gray-500">文件夹名:</span>
                <a-input v-model:value="record.params.directoryName" size="small" placeholder="DJI_..."
                  style="width: 120px" />
              </div>

              <!-- 激光点云录制 -->
              <div v-if="record.type === ACTION_TYPE.RECORD_POINT_CLOUD" class="flex items-center gap-2">
                <span class="text-xs text-gray-500">操作:</span>
                <a-select v-model:value="record.params.pointCloudOperateType" size="small" style="width: 100px">
                  <a-select-option value="start">开始录制</a-select-option>
                  <a-select-option value="stop">停止录制</a-select-option>
                  <a-select-option value="pause">暂停录制</a-select-option>
                  <a-select-option value="resume">恢复录制</a-select-option>
                </a-select>
              </div>

              <!-- 探照灯参数 -->
              <div v-if="record.type === ACTION_TYPE.SPOTLIGHT" class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">模式:</span>
                  <a-select v-model:value="record.params.spotlightMode" size="small" style="width: 80px">
                    <a-select-option value="on">常亮</a-select-option>
                    <a-select-option value="off">关闭</a-select-option>
                    <a-select-option value="blink">闪烁</a-select-option>
                  </a-select>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">亮度:</span>
                  <a-slider v-model:value="record.params.spotlightBrightness" :min="0" :max="100" style="flex: 1" />
                </div>
              </div>

              <!-- 喊话器参数 -->
              <div v-if="record.type === ACTION_TYPE.SPEAKER" class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">模式:</span>
                  <a-select v-model:value="record.params.speakerMode" size="small" style="width: 100px">
                    <a-select-option value="start">连续播放</a-select-option>
                    <a-select-option value="stop">停止播放</a-select-option>
                    <a-select-option value="play_once">播放一次</a-select-option>
                  </a-select>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">音量:</span>
                  <a-slider v-model:value="record.params.speakerVolume" :min="0" :max="100" style="flex: 1" />
                </div>
              </div>

              <!-- 智能识别参数 -->
              <div v-if="record.type === ACTION_TYPE.SMART_RECOGNITION" class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">动作:</span>
                  <a-select v-model:value="record.params.smartRecognitionMode" size="small" style="width: 80px">
                    <a-select-option value="start">开始</a-select-option>
                    <a-select-option value="stop">停止</a-select-option>
                  </a-select>
                </div>
                <div v-if="record.params.smartRecognitionMode === 'start'" class="flex flex-col">
                  <span class="text-xs text-gray-500">识别对象:</span>
                  <a-checkbox-group v-model:value="record.params.smartRecognitionType">
                    <a-checkbox value="person">人</a-checkbox>
                    <a-checkbox value="vehicle">车辆</a-checkbox>
                    <a-checkbox value="boat">船</a-checkbox>
                  </a-checkbox-group>
                </div>
              </div>

              <!-- 延时摄影参数 -->
              <div v-if="record.type === ACTION_TYPE.START_TIME_LAPSE" class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">间隔:</span>
                  <a-input-number v-model:value="record.params.photoInterval" :min="1" :max="30" size="small" />
                  <span class="text-xs text-gray-400">s</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">镜头:</span>
                  <a-select v-model:value="record.params.payloadLensIndex" size="small" style="width: 100px">
                    <a-select-option value="visable">可见光</a-select-option>
                    <a-select-option value="infrared">红外</a-select-option>
                  </a-select>
                </div>
              </div>

              <div
                v-if="[ACTION_TYPE.TAKE_PHOTO, ACTION_TYPE.START_RECORD, ACTION_TYPE.STOP_RECORD, ACTION_TYPE.STOP_INTERVAL_PHOTO, ACTION_TYPE.ORIENTED_PHOTO, ACTION_TYPE.GIMBAL_ANGLE_LOCK, ACTION_TYPE.GIMBAL_ANGLE_UNLOCK, ACTION_TYPE.STOP_TIME_LAPSE].includes(record.type)"
                class="text-xs text-gray-400">
                无额外参数
              </div>
            </div>
          </template>

          <template v-if="column.key === 'operation'">
            <a-button type="text" danger size="small" @click="removeAction(index)">删除</a-button>
          </template>
        </template>
      </a-table>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue';
import { ACTION_ICON, ACTION_LABEL, ACTION_TYPE, DEFAULT_ACTION_PARAMS } from '../../types/waypointRoute.js';

const props = defineProps({
  open: Boolean,
  actions: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['ok', 'cancel', 'preview-action']);

const localActions = ref([]);

watch(() => props.open, (newVal) => {
  if (newVal) {
    localActions.value = props.actions.map(a => JSON.parse(JSON.stringify(a)));
  }
});

const columns = [
  { title: '动作类型', key: 'type', width: 140 },
  { title: '动作参数', key: 'params' },
  { title: '操作', key: 'operation', width: 80 }
];

const addAction = () => {
  localActions.value.push({
    type: ACTION_TYPE.TAKE_PHOTO,
    params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.TAKE_PHOTO] }
  });
};

const removeAction = (index) => {
  localActions.value.splice(index, 1);
};

const handleTypeChange = (index) => {
  const type = localActions.value[index].type;
  localActions.value[index].params = { ...DEFAULT_ACTION_PARAMS[type] };
};

const handleOk = () => {
  emit('ok', localActions.value);
};

// 监听动作参数变化，实时触发预览
watch(localActions, (newActions) => {
  // 查找当前正在编辑或可能影响 FOV 的动作
  // 这里我们发送整个动作列表的变化，或者通过某种方式定位当前修改
  // 为了简化，每当变焦或角度动作变化时，我们通知外部组件
  newActions.forEach((action) => {
    if ([ACTION_TYPE.ZOOM, ACTION_TYPE.GIMBAL_PITCH, ACTION_TYPE.AIRCRAFT_YAW].includes(action.type)) {
      emit('preview-action', action);
    }
  });
}, { deep: true });
</script>

<style scoped>
.waypoint-action-editor {
  max-height: 500px;
  overflow-y: auto;
}

.step-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  color: #9ca3af;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.step-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.step-btn:active {
  transform: scale(0.9);
}

:deep(.zoom-slider-custom) {
  padding: 4px 0;
}

:deep(.zoom-slider-custom .ant-slider-track) {
  background-color: #3b82f6 !important;
  height: 4px !important;
}

:deep(.zoom-slider-custom .ant-slider-rail) {
  height: 4px !important;
  background-color: #f3f4f6 !important;
}

:deep(.zoom-slider-custom .ant-slider-handle) {
  width: 14px !important;
  height: 14px !important;
  margin-top: -5px !important;
  border: 2px solid #3b82f6 !important;
  background-color: #fff !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
}
</style>

<style scoped>
.waypoint-action-editor :deep(.ant-table-wrapper) {
  margin-top: 12px;
}
</style>
