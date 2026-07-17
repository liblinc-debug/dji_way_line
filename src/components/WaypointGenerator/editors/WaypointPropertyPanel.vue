<script setup>
import { computed, watch } from 'vue';
import { ACTION_ICON, ACTION_LABEL, ACTION_TYPE, DEFAULT_ACTION_PARAMS } from '../../../types/waypointRoute.js';

const props = defineProps({
    index: Number,
    waypoint: {
        type: Object,
        required: true
    },
    selectedActionIndex: {
        type: Number,
        default: -1
    }
});

const emit = defineEmits(['update:waypoint', 'close', 'preview-action', 'select-action', 'remove-action']);

const currentAction = computed(() => {
    if (props.selectedActionIndex === -1) return null;
    return props.waypoint.actions[props.selectedActionIndex];
});

const updateWp = (key, value) => {
    emit('update:waypoint', { ...props.waypoint, [key]: value });
};

const updateActionParams = (key, value) => {
    const newActions = [...props.waypoint.actions];
    newActions[props.selectedActionIndex] = {
        ...newActions[props.selectedActionIndex],
        params: { ...newActions[props.selectedActionIndex].params, [key]: value }
    };
    emit('update:waypoint', { ...props.waypoint, actions: newActions });
};

const handleTypeChange = (newType) => {
    const newActions = [...props.waypoint.actions];
    newActions[props.selectedActionIndex] = {
        type: newType,
        params: { ...DEFAULT_ACTION_PARAMS[newType] }
    };
    emit('update:waypoint', { ...props.waypoint, actions: newActions });
};

// 触发预览监听
watch(() => currentAction.value, (action) => {
    if (action && [ACTION_TYPE.ZOOM, ACTION_TYPE.GIMBAL_PITCH, ACTION_TYPE.AIRCRAFT_YAW].includes(action.type)) {
        emit('preview-action', action);
    }
}, { deep: true });

</script>

<template>
    <div class="flex flex-col h-full bg-white text-gray-800">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div class="flex items-center gap-2">
                <template v-if="selectedActionIndex === -1">
                    <div
                        class="w-5 h-5 rounded-sm bg-blue-600 flex items-center justify-center text-white text-[10px] font-black italic shadow-sm">
                        #{{ index + 1 }}
                    </div>
                    <span class="text-xs font-bold text-gray-700">航点属性</span>
                </template>
                <template v-else>
                    <button @click="$emit('select-action', -1)"
                        class="text-gray-400 hover:text-blue-500 mr-2 transition-colors">◀</button>
                    <span class="text-xs font-bold text-gray-700 text-blue-600">{{ ACTION_ICON[currentAction.type] }} {{
                        ACTION_LABEL[currentAction.type] }}</span>
                </template>
            </div>
            <a-button type="text" size="small" @click="$emit('close')"
                class="hover:bg-gray-200 rounded-full">✕</a-button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <!-- Mode 1: Waypoint Basic Params -->
            <div v-if="selectedActionIndex === -1">
                <section class="mb-6">
                    <div
                        class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span>📍 基础参数</span>
                        <div class="h-px flex-1 bg-gray-100"></div>
                    </div>

                    <div class="grid grid-cols-1 gap-4">
                        <a-form-item label="相对高度 (m)" class="!mb-0">
                            <a-input-number :value="waypoint.height" @update:value="val => updateWp('height', val)"
                                :min="0" :max="500" class="w-full dji-light-input" />
                        </a-form-item>
                        <a-form-item label="飞行速度 (m/s)" class="!mb-0">
                            <a-input-number :value="waypoint.speed" @update:value="val => updateWp('speed', val)"
                                :min="1" :max="15" class="w-full dji-light-input" />
                        </a-form-item>
                    </div>
                </section>

                <section>
                    <div
                        class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span>🎬 已有动作 ({{ waypoint.actions?.length || 0 }})</span>
                        <div class="h-px flex-1 bg-gray-100"></div>
                    </div>
                    <div v-if="!waypoint.actions || waypoint.actions.length === 0"
                        class="py-10 text-center text-gray-300 text-[10px] italic bg-gray-50/50 rounded-lg border border-dashed border-gray-100">
                        请在左侧点击“添加动作”
                    </div>
                    <div v-else class="flex flex-col gap-2">
                        <div v-for="(action, aIdx) in waypoint.actions" :key="aIdx"
                            class="p-2 border border-gray-100 rounded bg-gray-50/50 hover:border-blue-200 cursor-pointer flex justify-between items-center transition-all"
                            @click="$emit('select-action', aIdx)">
                            <div class="flex items-center gap-2">
                                <span class="text-lg">{{ ACTION_ICON[action.type] }}</span>
                                <span class="text-xs font-medium text-gray-600">{{ ACTION_LABEL[action.type] }}</span>
                            </div>
                            <span class="text-gray-300 text-[10px]">▶</span>
                        </div>
                    </div>
                </section>
            </div>

            <!-- Mode 2: Single Action Editor -->
            <div v-else-if="currentAction">
                <section class="mb-4">
                    <a-form-item label="任务动作" class="mb-4">
                        <a-select :value="currentAction.type" @update:value="handleTypeChange"
                            class="w-full dji-light-input">
                            <a-select-option v-for="(label, type) in ACTION_LABEL" :key="type" :value="type">
                                {{ ACTION_ICON[type] }} {{ label }}
                            </a-select-option>
                        </a-select>
                    </a-form-item>

                    <div class="p-4 rounded-lg bg-blue-50/30 border border-blue-100 space-y-4">
                        <!-- Custom Params based on Type -->
                        <div v-if="currentAction.type === ACTION_TYPE.ZOOM">
                            <div class="mb-2 flex items-center justify-between">
                                <span class="text-xs text-gray-400 font-bold">变焦倍率</span>
                                <span class="text-sm font-black text-blue-500 font-mono">{{
                                    currentAction.params.zoomFactor?.toFixed(1) || '1.0' }}X</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <button
                                    @click="updateActionParams('zoomFactor', Math.max(1, +((currentAction.params.zoomFactor || 1) - 1).toFixed(1)))"
                                    class="step-btn">−</button>
                                <div class="flex-1 px-1">
                                    <a-slider :value="currentAction.params.zoomFactor || 1"
                                        @update:value="val => updateActionParams('zoomFactor', val)" :min="1" :max="112"
                                        :step="0.1" class="zoom-slider-custom !m-0" />
                                </div>
                                <button
                                    @click="updateActionParams('zoomFactor', Math.min(112, +((currentAction.params.zoomFactor || 1) + 1).toFixed(1)))"
                                    class="step-btn">+</button>
                            </div>
                        </div>

                        <div v-if="currentAction.type === ACTION_TYPE.START_TIMED_PHOTO">
                            <div class="mb-4">
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex justify-between">
                                    <span>拍照间隔 (s)</span>
                                    <span class="text-blue-500 font-mono">{{ currentAction.params.photoInterval }}s</span>
                                </div>
                                <a-input-number :value="currentAction.params.photoInterval"
                                    @update:value="val => updateActionParams('photoInterval', val)" :min="0.1"
                                    :max="9999" class="w-full dji-light-input bg-white" placeholder="请输入时间间隔" />
                            </div>

                            <div class="mb-4">
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">镜头选择</div>
                                <a-select :value="currentAction.params.payloadLensIndex || 'followRoute'"
                                    @update:value="val => updateActionParams('payloadLensIndex', val)"
                                    class="w-full dji-light-input">
                                    <a-select-option value="followRoute">跟随航线 (Follow Route)</a-select-option>
                                    <a-select-option value="visable,ir">可见光+红外 (Visible+IR)</a-select-option>
                                    <a-select-option value="visable">可见光 (Visible)</a-select-option>
                                    <a-select-option value="ir">红外 (Infrared)</a-select-option>
                                </a-select>
                            </div>
                        </div>

                        <div v-if="currentAction.type === ACTION_TYPE.START_DISTANCE_PHOTO">
                            <div class="mb-4">
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex justify-between">
                                    <span>拍照间隔 (m)</span>
                                    <span class="text-blue-500 font-mono">{{ currentAction.params.photoDistanceInterval }}m</span>
                                </div>
                                <a-input-number :value="currentAction.params.photoDistanceInterval"
                                    @update:value="val => updateActionParams('photoDistanceInterval', val)" :min="0.1"
                                    :max="9999" class="w-full dji-light-input bg-white" placeholder="请输入距离间隔" />
                            </div>

                            <div class="mb-4">
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">镜头选择</div>
                                <a-select :value="currentAction.params.payloadLensIndex || 'followRoute'"
                                    @update:value="val => updateActionParams('payloadLensIndex', val)"
                                    class="w-full dji-light-input">
                                    <a-select-option value="followRoute">跟随航线 (Follow Route)</a-select-option>
                                    <a-select-option value="visable,ir">可见光+红外 (Visible+IR)</a-select-option>
                                    <a-select-option value="visable">可见光 (Visible)</a-select-option>
                                    <a-select-option value="ir">红外 (Infrared)</a-select-option>
                                </a-select>
                            </div>
                        </div>

                        <div v-if="currentAction.type === ACTION_TYPE.STOP_INTERVAL_PHOTO">
                            <div class="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
                                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">停止间隔拍照</div>
                                <div class="text-[9px] text-gray-400 mt-1">此动作将停止之前启动的定时或定距拍照任务</div>
                            </div>
                        </div>

                        <div v-if="currentAction.type === ACTION_TYPE.GIMBAL_PITCH">
                            <div class="mb-2 flex items-center justify-between">
                                <span class="text-xs text-gray-400 font-bold">俯仰角度</span>
                                <span class="text-sm font-black text-gray-600 font-mono">{{
                                    currentAction.params.gimbalPitchRotateAngle || 0 }}°</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <button
                                    @click="updateActionParams('gimbalPitchRotateAngle', Math.max(-90, (currentAction.params.gimbalPitchRotateAngle || 0) - 1))"
                                    class="step-btn">−</button>
                                <div class="flex-1 px-1">
                                    <a-slider :value="currentAction.params.gimbalPitchRotateAngle || 0"
                                        @update:value="val => updateActionParams('gimbalPitchRotateAngle', val)"
                                        :min="-90" :max="70" class="zoom-slider-custom !m-0" />
                                </div>
                                <button
                                    @click="updateActionParams('gimbalPitchRotateAngle', Math.min(70, (currentAction.params.gimbalPitchRotateAngle || 0) + 1))"
                                    class="step-btn">+</button>
                            </div>
                        </div>

                        <div v-if="currentAction.type === ACTION_TYPE.AIRCRAFT_YAW">
                            <div class="mb-2 flex items-center justify-between">
                                <span class="text-xs text-gray-400 font-bold">机头朝向</span>
                                <span class="text-sm font-black text-gray-600 font-mono">{{
                                    currentAction.params.aircraftYawAngle || 0 }}°</span>
                            </div>
                            <div class="flex items-center gap-3">
                                <button
                                    @click="updateActionParams('aircraftYawAngle', ((currentAction.params.aircraftYawAngle || 0) - 1 + 360) % 360)"
                                    class="step-btn">−</button>
                                <div class="flex-1 px-1">
                                    <a-slider :value="currentAction.params.aircraftYawAngle || 0"
                                        @update:value="val => updateActionParams('aircraftYawAngle', val)" :min="0"
                                        :max="359" class="zoom-slider-custom !m-0" />
                                </div>
                                <button
                                    @click="updateActionParams('aircraftYawAngle', ((currentAction.params.aircraftYawAngle || 0) + 1) % 360)"
                                    class="step-btn">+</button>
                            </div>
                        </div>

                        <div v-if="currentAction.type === ACTION_TYPE.CUSTOM_DIR_NAME">
                            <a-form-item label="文件夹名称" class="!mb-0">
                                <a-input :value="currentAction.params.directoryName"
                                    @update:value="val => updateActionParams('directoryName', val)"
                                    placeholder="请输入自定义文件夹名称"
                                    class="w-full dji-light-input bg-white" />
                            </a-form-item>
                        </div>

                        <div v-if="currentAction.type === ACTION_TYPE.HOVER">
                            <a-form-item label="悬停时间 (s)" class="!mb-0">
                                <a-input-number :value="currentAction.params.hoverTime"
                                    @update:value="val => updateActionParams('hoverTime', val)" :min="1" :max="3600"
                                    class="w-full dji-light-input" />
                            </a-form-item>
                        </div>

                        <div v-if="[ACTION_TYPE.TAKE_PHOTO, ACTION_TYPE.START_RECORD, ACTION_TYPE.STOP_RECORD].includes(currentAction.type)"
                            class="text-[10px] text-blue-500 italic text-center py-4 underline underline-offset-4 decoration-blue-200">
                            此动作执行系统原子指令，无需额外参数。
                        </div>
                    </div>
                </section>

                <a-button danger type="dashed" block
                    @click="$emit('remove-action', { wpIndex: index, actionIndex: selectedActionIndex })"
                    class="mt-8 !text-xs font-bold">
                    💥 移除此指令
                </a-button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.dji-light-input {
    border-radius: 4px !important;
    border: 1px solid #eee !important;
    background: #fafafa !important;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 2px;
}

.step-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #9ca3af;
    font-weight: bold;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
    line-height: 1;
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
