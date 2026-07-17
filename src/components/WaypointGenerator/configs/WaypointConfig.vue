<template>
    <div class="waypoint-config-panel space-y-6">
        <div class="flex items-center gap-2 mb-2">
            <div class="w-1 h-4 bg-blue-500 rounded-full"></div>
            <h3 class="m-0 text-sm font-bold text-gray-800 tracking-tight">航点航线任务配置</h3>
        </div>

        <a-form layout="vertical" class="space-y-6">
            <!-- Section: Takeoff -->
            <a-form-item class="!mb-0">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">起飞点参考</span></template>
                <div
                    class="group flex items-center justify-between p-3 bg-gray-50/50 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors">
                    <div class="flex flex-col">
                        <span class="text-xs font-medium text-gray-700">起飞点状态</span>
                        <span class="text-[10px] text-gray-400 italic">已锁定至当前位置</span>
                    </div>
                    <a-button type="link" size="small" class="!text-blue-500 !font-bold"
                        @click="$emit('reset-takeoff')">重设位置</a-button>
                </div>
            </a-form-item>

            <!-- Section: Loop Control -->
            <a-form-item class="!mb-0">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">航线执行模式</span></template>
                <div class="flex justify-between items-center bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                    <div class="flex flex-col">
                        <span class="text-xs font-medium text-gray-700">闭合循环</span>
                        <span class="text-[10px] text-gray-400">执行完最后一点后自动回到首点</span>
                    </div>
                    <a-switch :checked="modelValue.isClosedLoop"
                        @update:checked="val => updateConfig('isClosedLoop', val)" size="small" />
                </div>
            </a-form-item>

            <!-- Section: Camera -->
            <a-form-item class="!mb-0">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">任务载荷设置</span></template>
                <div class="space-y-3">
                    <a-radio-group :value="modelValue.photoType" button-style="solid"
                        class="w-full flex dji-radio-group" @update:value="val => updateConfig('photoType', val)">
                        <a-radio-button value="visible" class="flex-1 text-center">可见光</a-radio-button>
                        <a-radio-button value="infrared" class="flex-1 text-center">红外</a-radio-button>
                    </a-radio-group>
                    <div
                        class="flex justify-between items-center bg-gray-50/30 p-2 rounded border border-dashed border-gray-100">
                        <span class="text-[11px] text-gray-500 font-medium">智能低光增强</span>
                        <a-switch :checked="modelValue.lowLightMode"
                            @update:checked="val => updateConfig('lowLightMode', val)" size="small" />
                    </div>
                </div>
            </a-form-item>

            <!-- Section: Climb -->
            <a-form-item class="!mb-0">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">飞向首航点模式</span></template>
                <div class="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    <a-radio-group :value="resolvedClimbMode" button-style="solid"
                        class="w-full flex dji-radio-group border-b border-gray-100"
                        @update:value="updateClimbMode">
                        <a-radio-button value="vertical" class="flex-1 text-center">垂直爬升</a-radio-button>
                        <a-radio-button value="oblique" class="flex-1 text-center">倾斜爬升</a-radio-button>
                    </a-radio-group>

                    <div class="p-4 flex gap-4 bg-white items-center">
                        <div
                            class="flex-1 h-20 bg-gray-50/50 rounded flex items-center justify-center p-2 border border-gray-50">
                            <svg viewBox="0 0 200 80" class="w-full h-full text-gray-300">
                                <line x1="0" y1="70" x2="200" y2="70" stroke="currentColor" stroke-width="0.5"
                                    stroke-dasharray="2,2" />
                                <circle cx="20" cy="70" r="2.5" fill="#4a90e2" />
                                <g v-if="resolvedClimbMode === 'vertical'">
                                    <path fill="none" stroke="#f39c12" stroke-width="1.5" stroke-dasharray="3,2"
                                        d="M20 70 V30 H170" />
                                    <line x1="160" y1="30" x2="160" y2="70" stroke="#2ecc71" stroke-width="1" />
                                    <text x="50" y="20" fill="#999" font-size="7" font-weight="bold">垂直爬升轨迹</text>
                                </g>
                                <g v-else>
                                    <path fill="none" stroke="#2ecc71" stroke-width="1.5" stroke-dasharray="3,2"
                                        d="M20 70 L170 30" />
                                    <text x="50" y="45" fill="#999" font-size="7" font-weight="bold">倾斜爬升轨迹</text>
                                </g>
                                <path d="M170 30 l-3 1.5 l3 -1.5 l1.5 3" stroke="#e74c3c" stroke-width="1"
                                    fill="none" />
                            </svg>
                        </div>
                        <div class="flex flex-col gap-1.5 w-14">
                            <button @click="adjustSafetyHeight(10)"
                                class="h-6 rounded bg-gray-50 border border-gray-100 text-[10px] text-gray-500 hover:bg-gray-100">+10</button>
                            <div class="py-1 rounded border border-blue-500 flex flex-col items-center">
                                <span class="text-xs font-black text-blue-600 leading-none">{{
                                    modelValue.takeOffSecurityHeight
                                }}</span>
                                <span class="text-[7px] text-gray-400 font-bold uppercase">m</span>
                            </div>
                            <button @click="adjustSafetyHeight(-10)"
                                class="h-6 rounded bg-gray-50 border border-gray-100 text-[10px] text-gray-500 hover:bg-gray-100">-10</button>
                        </div>
                    </div>
                </div>
            </a-form-item>

            <!-- Section: Height -->
            <a-form-item class="!mb-0">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">航点高度参考模式</span></template>
                <div class="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    <a-radio-group :value="modelValue.executeHeightMode" button-style="solid"
                        class="w-full flex dji-radio-group border-b border-gray-100"
                        @update:value="val => updateConfig('executeHeightMode', val)">
                        <a-radio-button value="WGS84" class="flex-1 text-center text-[10px]">海拔高度</a-radio-button>
                        <a-radio-button value="relativeToStartPoint"
                            class="flex-1 text-center text-[10px]">相对起飞点高度</a-radio-button>
                        <a-radio-button value="realTimeFollowSurface"
                            class="flex-1 text-center text-[10px]">相对地形高度</a-radio-button>
                    </a-radio-group>
                    <div class="p-4 flex gap-4 bg-white items-center">
                        <div
                            class="flex-1 h-20 bg-gray-50/50 rounded flex items-center justify-center p-2 border border-gray-50">
                            <svg v-if="modelValue.executeHeightMode === 'WGS84'" viewBox="0 0 200 80"
                                class="w-full h-full text-gray-300">
                                <path fill="currentColor" opacity="0.1" d="M0 75 Q 100 65 200 75 L 200 80 L 0 80 Z" />
                                <line x1="0" y1="75" x2="200" y2="75" stroke="currentColor" stroke-width="0.5"
                                    stroke-dasharray="2,2" />
                                <text x="5" y="72" fill="#999" font-size="6">海平面</text>
                                <path d="M 20 65 Q 60 60 100 65 T 180 60" fill="none" stroke="#8b7355"
                                    stroke-width="1.5" />
                                <text x="140" y="70" fill="#8b7355" font-size="6">地面</text>
                                <line x1="120" y1="20" x2="120" y2="75" stroke="#3498db" stroke-width="1.5"
                                    marker-end="url(#arrow)" />
                                <text x="125" y="45" fill="#3498db" font-size="7" font-weight="bold">海拔高度</text>
                                <defs>
                                    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4"
                                        markerHeight="4" orient="auto-start-reverse">
                                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#3498db" />
                                    </marker>
                                </defs>
                            </svg>
                            <svg v-if="modelValue.executeHeightMode === 'relativeToStartPoint'" viewBox="0 0 200 80"
                                class="w-full h-full text-gray-300">
                                <line x1="0" y1="70" x2="200" y2="70" stroke="currentColor" stroke-width="0.5"
                                    stroke-dasharray="2,2" />
                                <text x="5" y="67" fill="#999" font-size="6">地平面</text>
                                <circle cx="40" cy="70" r="3" fill="#3498db" />
                                <text x="32" y="78" fill="#3498db" font-size="6">起飞点</text>
                                <line x1="150" y1="20" x2="150" y2="70" stroke="#3498db" stroke-width="1.5"
                                    marker-end="url(#arrow-rel)" />
                                <text x="155" y="45" fill="#3498db" font-size="7" font-weight="bold">相对起飞高度</text>
                                <defs>
                                    <marker id="arrow-rel" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4"
                                        markerHeight="4" orient="auto-start-reverse">
                                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#3498db" />
                                    </marker>
                                </defs>
                            </svg>
                            <svg v-if="modelValue.executeHeightMode === 'realTimeFollowSurface'" viewBox="0 0 200 80"
                                class="w-full h-full text-gray-300">
                                <path d="M 20 65 Q 60 25 100 65 T 180 45" fill="none" stroke="#8b7355"
                                    stroke-width="1.5" />
                                <path d="M 20 40 Q 60 0 100 40 T 180 20" fill="none" stroke="#2ecc71" stroke-width="1.5"
                                    stroke-dasharray="3,2" />
                                <line x1="100" y1="35" x2="100" y2="60" stroke="#2ecc71" stroke-width="1" />
                                <text x="105" y="50" fill="#2ecc71" font-size="7" font-weight="bold">相对地形高度</text>
                                <text x="140" y="65" fill="#8b7355" font-size="6">地面</text>
                            </svg>
                        </div>
                        <div class="flex flex-col gap-1.5 w-14">
                            <button @click="adjustHeight(10)"
                                class="h-6 rounded bg-gray-50 border border-gray-100 text-[10px] text-gray-500 hover:bg-gray-100">+10</button>
                            <div class="py-1 rounded border border-blue-500 flex flex-col items-center">
                                <span class="text-xs font-black text-blue-600 leading-none">{{ modelValue.globalHeight
                                }}</span>
                                <span class="text-[7px] text-gray-400 font-bold uppercase">m</span>
                            </div>
                            <button @click="adjustHeight(-10)"
                                class="h-6 rounded bg-gray-50 border border-gray-100 text-[10px] text-gray-500 hover:bg-gray-100">-10</button>
                        </div>
                    </div>
                </div>
            </a-form-item>

            <a-form-item class="!mb-4">
                <template #label><span class="text-[11px] font-black text-gray-400 uppercase tracking-widest">全局航线飞行速度
                        (m/s)</span></template>
                <div class="flex items-center gap-3 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                    <a-button @click="adjustSpeed(-1)" size="small" shape="circle">-</a-button>
                    <div class="flex-1 flex items-baseline justify-center gap-1">
                        <span class="text-base font-black text-gray-800 font-mono">{{ modelValue.globalTransitionalSpeed
                        }}</span>
                        <span class="text-[9px] text-gray-400 font-black uppercase">m/s</span>
                    </div>
                    <a-button @click="adjustSpeed(1)" size="small" shape="circle">+</a-button>
                </div>
            </a-form-item>

            <div class="h-px bg-gray-100"></div>

            <a-collapse v-model:activeKey="activeCollapse" :bordered="false" class="dji-collapse bg-white">
                <a-collapse-panel key="1">
                    <template #header><span
                            class="text-[10px] font-black text-gray-400 uppercase tracking-widest">高级飞行参数配置</span></template>
                    <div class="space-y-5 pt-3">
                        <div class="flex justify-between items-center bg-gray-50/30 p-2 rounded border border-gray-100">
                            <span class="text-[11px] text-gray-500 font-medium">起飞速度</span>
                            <div class="flex items-center gap-2">
                                <a-input-number :value="resolvedTakeoffSpeed" size="small" :min="1" :max="15"
                                    @update:value="updateTakeoffSpeed"
                                    class="!w-16 dji-number-input" />
                                <span class="text-[10px] text-gray-400">m/s</span>
                            </div>
                        </div>
                        <div class="flex justify-between items-center py-2 px-1 border-t border-gray-50">
                            <span class="text-[10px] text-gray-500 font-black uppercase">航线绕行避障</span>
                            <a-switch :checked="modelValue.useObstacleAvoidance"
                                @update:checked="val => updateConfig('useObstacleAvoidance', val)" size="small" />
                        </div>
                    </div>
                </a-collapse-panel>
            </a-collapse>
        </a-form>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
    modelValue: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['update:modelValue', 'reset-takeoff']);
const activeCollapse = ref([]);

const getClimbModeByFlyToWaylineMode = (mode) => mode === 'pointToPoint' ? 'oblique' : 'vertical';
const getFlyToWaylineModeByClimbMode = (mode) => mode === 'oblique' ? 'pointToPoint' : 'safely';

const updateConfig = (key, value) => {
    emit('update:modelValue', { ...props.modelValue, [key]: value });
};

const resolvedClimbMode = computed(() => {
    if (props.modelValue?.climbMode === 'vertical' || props.modelValue?.climbMode === 'oblique') {
        return props.modelValue.climbMode;
    }
    return getClimbModeByFlyToWaylineMode(props.modelValue?.flyToWaylineMode);
});

const updateClimbMode = (mode) => {
    const nextMode = mode === 'oblique' ? 'oblique' : 'vertical';
    emit('update:modelValue', {
        ...props.modelValue,
        climbMode: nextMode,
        flyToWaylineMode: getFlyToWaylineModeByClimbMode(nextMode)
    });
};

const resolvedTakeoffSpeed = computed(() => {
    const globalSpeed = Number(props.modelValue?.globalTransitionalSpeed);
    if (Number.isFinite(globalSpeed) && globalSpeed > 0) return globalSpeed;

    const takeoffSpeed = Number(props.modelValue?.takeoffSpeed);
    if (Number.isFinite(takeoffSpeed) && takeoffSpeed > 0) return takeoffSpeed;

    return 5;
});

const updateTakeoffSpeed = (value) => {
    const currentValue = resolvedTakeoffSpeed.value;
    const numericValue = Number(value);
    const next = Math.max(1, Math.min(15, Number.isFinite(numericValue) ? numericValue : currentValue));
    emit('update:modelValue', {
        ...props.modelValue,
        takeoffSpeed: next,
        globalTransitionalSpeed: next
    });
};

const adjustHeight = (delta) => {
    const currentHeight = props.modelValue.globalHeight || 60;
    const newHeight = Math.max(20, Math.min(500, currentHeight + delta));
    updateConfig('globalHeight', newHeight);
};

const adjustSafetyHeight = (delta) => {
    const currentHeight = props.modelValue.takeOffSecurityHeight || 20;
    const newHeight = Math.max(10, Math.min(200, currentHeight + delta));
    updateConfig('takeOffSecurityHeight', newHeight);
};

const adjustSpeed = (delta) => {
    const current = resolvedTakeoffSpeed.value;
    const next = Math.max(1, Math.min(15, current + delta));
    emit('update:modelValue', {
        ...props.modelValue,
        globalTransitionalSpeed: next,
        takeoffSpeed: next
    });
};
</script>

<style scoped>
.dji-radio-group :deep(.ant-radio-button-wrapper) {
    height: 28px !important;
    line-height: 26px !important;
    font-size: 11px !important;
    border-color: #f0f0f0 !important;
    background: #fafafa !important;
    color: #999 !important;
    font-weight: 600 !important;
}

.dji-radio-group :deep(.ant-radio-button-wrapper-checked) {
    background: #1890ff !important;
    color: white !important;
    border-color: #1890ff !important;
}

.dji-collapse :deep(.ant-collapse-header) {
    padding: 12px 0 !important;
    background: white !important;
}

.dji-collapse :deep(.ant-collapse-content-box) {
    padding: 0 !important;
}

:deep(.ant-form-item-label > label) {
    font-size: 11px;
    color: #666;
    font-weight: 600;
}
</style>
