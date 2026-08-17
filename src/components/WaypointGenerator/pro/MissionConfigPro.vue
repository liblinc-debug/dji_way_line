<template>
    <div class="waypoint-config-panel space-y-6 select-none p-1">
        <div class="flex items-center gap-2 mb-2 border-b border-gray-100 pb-3">
            <div class="w-1 h-4 bg-blue-500 rounded-full"></div>
            <h3 class="m-0 text-[14px] font-bold text-gray-800 tracking-tight">任务配置</h3>
        </div>

        <a-form layout="vertical" class="space-y-6">
            <!-- Section: Takeoff Reference (Clean Style) -->
            <a-form-item class="!mb-0">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">起飞点参考</span></template>

                <div v-if="modelValue.takeOffPointLat"
                    class="group flex flex-col p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-400 transition-all duration-300">
                    <div class="flex justify-between items-center mb-3">
                        <div class="flex items-center gap-2.5">
                            <div class="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center">
                                <svg viewBox="0 0 100 100" class="w-4 h-4 text-blue-500 fill-current">
                                    <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="8" />
                                    <path d="M50 25 L38 42 H62 Z" />
                                    <text x="50" y="78" font-family="Arial" font-size="32" font-weight="bold"
                                        text-anchor="middle">H</text>
                                </svg>
                            </div>
                            <span class="text-xs font-bold text-gray-700">自定义起飞参考点</span>
                        </div>
                        <a-button type="link" size="small" class="!text-blue-500 !font-bold !p-0 h-auto"
                            @click="$emit('reset-takeoff')">重置</a-button>
                    </div>

                    <div class="grid grid-cols-2 gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                        <div class="flex flex-col gap-0.5">
                            <span class="text-[9px] uppercase font-black text-gray-400">纬度</span>
                            <span class="text-[12px] text-gray-700 font-mono">{{ modelValue.takeOffPointLat.toFixed(7)
                                }}°</span>
                        </div>
                        <div class="flex flex-col gap-0.5">
                            <span class="text-[9px] uppercase font-black text-gray-400">经度</span>
                            <span class="text-[12px] text-gray-700 font-mono">{{ modelValue.takeOffPointLng.toFixed(7)
                                }}°</span>
                        </div>
                        <div class="col-span-2 pt-2 mt-1 border-t border-gray-100 flex justify-between items-center">
                            <span class="text-[9px] uppercase font-black text-gray-400">参考海拔 (ASL)</span>
                            <span class="text-[13px] text-blue-600 font-black font-mono">{{
                                modelValue.takeOffPointHeight.toFixed(1) }}
                                <span class="text-[10px]">m</span></span>
                        </div>
                    </div>
                </div>

                <div v-else
                    class="group flex items-center justify-between p-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl hover:bg-blue-50/50 hover:border-blue-300 transition-all duration-300 cursor-pointer"
                    @click="$emit('reset-takeoff')">
                    <div class="flex items-center gap-3 text-gray-400">
                        <span class="text-lg">📍</span>
                        <div class="flex flex-col">
                            <span class="text-[11px] font-bold text-gray-500">点击地图设置起飞点</span>
                            <span class="text-[9px] italic">若未设置，将自动采用首个航点</span>
                        </div>
                    </div>
                    <svg viewBox="0 0 24 24" class="w-4 h-4 text-gray-300 fill-none stroke-current stroke-2">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </div>
            </a-form-item>

            <!-- Section: Payload -->
            <a-form-item class="!mb-0">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">任务载荷</span></template>
                <div class="space-y-3">
                    <div class="flex gap-1 bg-gray-50/50 p-1 rounded-lg border border-gray-100">
                        <div v-for="opt in [{ label: '可见光', value: 'visible' }, { label: '红外', value: 'infrared' }]"
                            :key="opt.value" @click="togglePhotoType(opt.value)" :class="[
                                'flex-1 py-1.5 text-center text-[11px] font-bold rounded-md cursor-pointer transition-all',
                                isPhotoTypeSelected(opt.value)
                                    ? 'bg-blue-500 text-white shadow-sm'
                                    : 'text-gray-400 hover:bg-gray-100'
                            ]">
                            {{ opt.label }}
                        </div>
                    </div>
                    <div
                        class="flex justify-between items-center bg-gray-50/30 p-2.5 rounded-lg border border-gray-100">
                        <span class="text-[11px] text-gray-600 font-bold">智能低光增强</span>
                        <a-switch :checked="modelValue.lowLightMode"
                            @update:checked="val => updateConfig('lowLightMode', val)" size="small" />
                    </div>
                </div>
            </a-form-item>

            <!-- Section: Climb Trajectory -->
            <a-form-item class="!mb-0">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">飞向首航点模式</span></template>
                <div class="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <a-radio-group :value="resolvedClimbMode" button-style="solid"
                        class="w-full flex dji-radio-unified border-b border-gray-100"
                        @update:value="updateClimbMode">
                        <a-radio-button value="vertical" class="flex-1 text-center font-bold">垂直爬升</a-radio-button>
                        <a-radio-button value="oblique" class="flex-1 text-center font-bold">倾斜爬升</a-radio-button>
                    </a-radio-group>

                    <div class="p-4 flex gap-4 bg-white items-center">
                        <div
                            class="flex-1 h-20 bg-gray-50/50 rounded-lg flex items-center justify-center p-2 border border-gray-50 relative">
                            <svg viewBox="0 0 200 80" class="w-full h-full text-gray-300">
                                <line x1="0" y1="70" x2="200" y2="70" stroke="currentColor" stroke-width="0.5"
                                    stroke-dasharray="2,2" />
                                <circle cx="20" cy="70" r="2.5" fill="#1890ff" />
                                <g v-if="resolvedClimbMode === 'vertical'">
                                    <path fill="none" stroke="#faad14" stroke-width="1.5" d="M20 70 V30 H170" />
                                </g>
                                <g v-else>
                                    <path fill="none" stroke="#52c41a" stroke-width="1.5" d="M20 70 L170 30" />
                                </g>
                                <path d="M170 30 l-4 2 l4 -2 l2 4" stroke="#ff4d4f" stroke-width="1.5" fill="none" />
                            </svg>
                        </div>
                        <div class="flex flex-col gap-1 w-14">
                            <button @click="adjustSafetyHeight(10)"
                                class="h-6 rounded bg-white border border-gray-200 text-[10px] text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-all shadow-sm">+10</button>
                            <div class="py-1 rounded border-2 border-blue-500 bg-blue-50/30 flex flex-col items-center">
                                <span class="text-xs font-black text-blue-600 leading-none">{{
                                    modelValue.takeOffSecurityHeight
                                    }}</span>
                                <span class="text-[7px] text-gray-400 font-bold uppercase">m</span>
                            </div>
                            <button @click="adjustSafetyHeight(-10)"
                                class="h-6 rounded bg-white border border-gray-200 text-[10px] text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-all shadow-sm">-10</button>
                        </div>
                    </div>
                </div>
            </a-form-item>

            <!-- Section: Altitude Reference -->
            <a-form-item class="!mb-0">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">高度模式</span></template>
                <div class="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <a-radio-group :value="modelValue.executeHeightMode" button-style="solid"
                        class="w-full flex dji-radio-unified border-b border-gray-100"
                        @update:value="val => updateConfig('executeHeightMode', val)">
                        <a-radio-button value="WGS84"
                            class="flex-1 text-center text-[10px] font-bold">海拔</a-radio-button>
                        <a-radio-button value="relativeToStartPoint"
                            class="flex-1 text-center text-[10px] font-bold">相对</a-radio-button>
                        <a-radio-button value="realTimeFollowSurface"
                            class="flex-1 text-center text-[10px] font-bold">跟随</a-radio-button>
                    </a-radio-group>
                    <div class="p-4 flex gap-4 bg-white items-center">
                        <div
                            class="flex-1 h-20 bg-gray-50/50 rounded-lg flex items-center justify-center p-2 border border-gray-50">
                            <svg v-if="modelValue.executeHeightMode === 'WGS84'" viewBox="0 0 200 80"
                                class="w-full h-full text-gray-300">
                                <line x1="0" y1="75" x2="200" y2="75" stroke="currentColor" stroke-width="0.5"
                                    stroke-dasharray="2,2" />
                                <path d="M 20 65 Q 60 60 100 65 T 180 60" fill="none" stroke="#8b7355"
                                    stroke-width="2" />
                                <line x1="120" y1="20" x2="120" y2="75" stroke="#1890ff" stroke-width="1.5" />
                            </svg>
                            <svg v-if="modelValue.executeHeightMode === 'relativeToStartPoint'" viewBox="0 0 200 80"
                                class="w-full h-full text-gray-300">
                                <line x1="0" y1="70" x2="200" y2="70" stroke="currentColor" stroke-width="0.5"
                                    stroke-dasharray="2,2" />
                                <circle cx="40" cy="70" r="3" fill="#1890ff" />
                                <line x1="150" y1="20" x2="150" y2="70" stroke="#1890ff" stroke-width="1.5" />
                            </svg>
                            <svg v-if="modelValue.executeHeightMode === 'realTimeFollowSurface'" viewBox="0 0 200 80"
                                class="w-full h-full text-gray-300">
                                <path d="M 20 65 Q 60 25 100 65 T 180 45" fill="none" stroke="#8b7355"
                                    stroke-width="2" />
                                <path d="M 20 40 Q 60 0 100 40 T 180 20" fill="none" stroke="#52c41a" stroke-width="1.5"
                                    stroke-dasharray="3,2" />
                                <line x1="100" y1="35" x2="100" y2="60" stroke="#52c41a" stroke-width="1.5" />
                            </svg>
                        </div>
                        <div class="flex flex-col gap-1 w-14">
                            <button @click="adjustHeight(10)"
                                class="h-6 rounded bg-white border border-gray-200 text-[10px] text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-all shadow-sm">+10</button>
                            <div class="py-1 rounded border-2 border-blue-500 bg-blue-50/30 flex flex-col items-center">
                                <span class="text-xs font-black text-blue-600 leading-none">{{ modelValue.globalHeight
                                    }}</span>
                                <span class="text-[7px] text-gray-400 font-bold uppercase">m</span>
                            </div>
                            <button @click="adjustHeight(-10)"
                                class="h-6 rounded bg-white border border-gray-200 text-[10px] text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-all shadow-sm">-10</button>
                        </div>
                    </div>
                </div>
            </a-form-item>

            <!-- Global Speed -->
            <a-form-item class="!mb-4">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">全局飞行速度</span></template>
                <div class="flex items-center gap-4 bg-gray-50/50 p-2.5 rounded-lg border border-gray-100">
                    <button @click="adjustSpeed(-1)"
                        class="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-all active:scale-95 shadow-sm">-</button>
                    <div class="flex-1 flex items-baseline justify-center gap-1">
                        <span class="text-lg font-black text-gray-800 font-mono italic">{{
                            modelValue.globalTransitionalSpeed || 5
                            }}</span>
                        <span class="text-[9px] text-gray-400 font-black uppercase">m/s</span>
                    </div>
                    <button @click="adjustSpeed(1)"
                        class="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-all active:scale-95 shadow-sm">+</button>
                </div>
            </a-form-item>

            <!-- Section: Obstacle Avoidance Policy -->
            <a-form-item class="!mb-4">
                <template #label><span
                        class="text-[11px] font-black text-gray-400 uppercase tracking-widest">避障规则</span></template>
                <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div class="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-3 py-3">
                        <div>
                            <div class="text-[11px] font-bold text-gray-700">启用任务避障</div>
                            <div class="mt-0.5 text-[9px] text-gray-400">实际执行依赖飞机传感器、飞控及当前飞行模式</div>
                        </div>
                        <a-switch :checked="obstacleConfig.enabled" size="small"
                            @update:checked="updateObstacleEnabled" />
                    </div>

                    <div v-if="obstacleConfig.enabled" class="space-y-3 p-3">
                        <div>
                            <div class="mb-1 text-[10px] font-bold text-gray-500">避障策略</div>
                            <a-select :value="obstacleConfig.strategy" size="small" class="w-full"
                                @update:value="val => updateObstacleConfig('strategy', val)">
                                <a-select-option v-for="strategy in obstacleStrategies" :key="strategy.value"
                                    :value="strategy.value">
                                    {{ strategy.label }} · {{ strategy.algorithm }}
                                </a-select-option>
                            </a-select>
                        </div>

                        <div class="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                            <div class="text-[10px] font-bold text-blue-700">{{ selectedObstacleStrategy.label }}</div>
                            <div class="mt-1 text-[9px] leading-4 text-blue-600/80">
                                {{ selectedObstacleStrategy.description }}
                            </div>
                        </div>

                        <template v-if="obstacleConfig.strategy === 'vertical-overfly'">
                            <div>
                                <div class="mb-1 text-[10px] font-bold text-gray-500">垂直升高方式</div>
                                <a-radio-group :value="obstacleConfig.altitudeMode" button-style="solid"
                                    class="flex w-full dji-radio-unified"
                                    @update:value="val => updateObstacleConfig('altitudeMode', val)">
                                    <a-radio-button value="fixed" class="flex-1 text-center text-[10px]">固定升高</a-radio-button>
                                    <a-radio-button value="auto" class="flex-1 text-center text-[10px]">自动越障</a-radio-button>
                                </a-radio-group>
                            </div>

                            <div v-if="obstacleConfig.altitudeMode === 'fixed'"
                                class="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
                                <div>
                                    <div class="text-[10px] font-bold text-gray-600">垂直升高高度</div>
                                    <div class="text-[8px] text-gray-400">原地直上，安全飞越后原地直下</div>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <a-input-number :value="obstacleConfig.fixedClimbHeight" size="small" :min="5"
                                        :max="200" :step="5"
                                        @update:value="val => updateObstacleNumber('fixedClimbHeight', val, 5, 200)"
                                        class="!w-20" />
                                    <span class="text-[9px] text-gray-400">m</span>
                                </div>
                            </div>

                            <div v-else
                                class="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
                                <div>
                                    <div class="text-[10px] font-bold text-gray-600">障碍顶部安全余量</div>
                                    <div class="text-[8px] text-gray-400">依据建筑/传感器高度自动爬升</div>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <a-input-number :value="obstacleConfig.verticalClearance" size="small" :min="2"
                                        :max="50" :step="1"
                                        @update:value="val => updateObstacleNumber('verticalClearance', val, 2, 50)"
                                        class="!w-20" />
                                    <span class="text-[9px] text-gray-400">m</span>
                                </div>
                            </div>
                        </template>

                        <div v-if="['horizontal-bypass', 'global-local-replan'].includes(obstacleConfig.strategy)"
                            class="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
                            <div>
                                <div class="text-[10px] font-bold text-gray-600">水平安全间距</div>
                                <div class="text-[8px] text-gray-400">规划路径与障碍物的最小距离</div>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <a-input-number :value="obstacleConfig.horizontalClearance" size="small" :min="1"
                                    :max="30" :step="1"
                                    @update:value="val => updateObstacleNumber('horizontalClearance', val, 1, 30)"
                                    class="!w-20" />
                                <span class="text-[9px] text-gray-400">m</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <div class="rounded-lg border border-gray-100 bg-gray-50/50 p-2">
                                <div class="mb-1 text-[9px] font-bold text-gray-500">前视探测距离</div>
                                <div class="flex items-center gap-1">
                                    <a-input-number :value="obstacleConfig.lookaheadDistance" size="small" :min="1"
                                        :max="100" :step="1"
                                        @update:value="val => updateObstacleNumber('lookaheadDistance', val, 1, 100)"
                                        class="!w-full" />
                                    <span class="text-[9px] text-gray-400">m</span>
                                </div>
                            </div>
                            <div class="rounded-lg border border-gray-100 bg-gray-50/50 p-2">
                                <div class="mb-1 text-[9px] font-bold text-gray-500">等待超时</div>
                                <div class="flex items-center gap-1">
                                    <a-input-number :value="obstacleConfig.maxWaitSeconds" size="small" :min="5"
                                        :max="300" :step="5"
                                        @update:value="val => updateObstacleNumber('maxWaitSeconds', val, 5, 300)"
                                        class="!w-full" />
                                    <span class="text-[9px] text-gray-400">s</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div class="mb-1 text-[10px] font-bold text-gray-500">避障失败动作</div>
                            <a-select :value="obstacleConfig.fallbackAction" size="small" class="w-full"
                                @update:value="val => updateObstacleConfig('fallbackAction', val)">
                                <a-select-option value="hover">悬停等待人工处理</a-select-option>
                                <a-select-option value="goHome">返航</a-select-option>
                                <a-select-option value="abort">终止任务并保持当前位置</a-select-option>
                            </a-select>
                        </div>

                        <div class="rounded-lg bg-amber-50 px-2.5 py-2 text-[9px] leading-4 text-amber-700">
                            首次使用或更换传感器后，应先在仿真和低速空旷环境验证。缺少全向感知时，不应假定未覆盖方向不存在障碍。
                        </div>
                    </div>
                </div>
            </a-form-item>

            <a-collapse v-model:activeKey="activeCollapse" :bordered="false" class="dji-collapse-unified bg-white">
                <a-collapse-panel key="1">
                    <template #header><span
                            class="text-[10px] font-black text-gray-400 uppercase tracking-widest">高级配置项</span></template>
                    <div class="space-y-4 pt-3">
                        <div
                            class="flex justify-between items-center bg-gray-50/30 p-2.5 rounded-lg border border-gray-100">
                            <span class="text-[11px] text-gray-500 font-bold">起飞速度</span>
                            <div class="flex items-center gap-2">
                                <a-input-number :value="resolvedTakeoffSpeed" size="small" :min="1" :max="15"
                                    @update:value="updateTakeoffSpeed" class="!w-16" />
                                <span class="text-[10px] text-gray-400 font-bold">m/s</span>
                            </div>
                        </div>
                    </div>
                </a-collapse-panel>
            </a-collapse>
        </a-form>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
    OBSTACLE_AVOIDANCE_DEFAULT,
    OBSTACLE_AVOIDANCE_STRATEGIES
} from '../../../types/missionConfig.js';

const props = defineProps({
    modelValue: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['update:modelValue', 'reset-takeoff']);
const activeCollapse = ref([]);
const obstacleStrategies = OBSTACLE_AVOIDANCE_STRATEGIES;

const obstacleConfig = computed(() => ({
    ...OBSTACLE_AVOIDANCE_DEFAULT,
    ...(props.modelValue?.obstacleAvoidance || {}),
    enabled: props.modelValue?.useObstacleAvoidance !== false
        && props.modelValue?.obstacleAvoidance?.enabled !== false
}));

const selectedObstacleStrategy = computed(() => (
    obstacleStrategies.find(item => item.value === obstacleConfig.value.strategy)
    || obstacleStrategies[0]
));

const getClimbModeByFlyToWaylineMode = (mode) => mode === 'pointToPoint' ? 'oblique' : 'vertical';
const getFlyToWaylineModeByClimbMode = (mode) => mode === 'oblique' ? 'pointToPoint' : 'safely';

const updateConfig = (key, value) => {
    emit('update:modelValue', { ...props.modelValue, [key]: value });
};

const updateObstacleConfig = (key, value) => {
    emit('update:modelValue', {
        ...props.modelValue,
        obstacleAvoidance: {
            ...obstacleConfig.value,
            [key]: value
        }
    });
};

const updateObstacleEnabled = (enabled) => {
    emit('update:modelValue', {
        ...props.modelValue,
        useObstacleAvoidance: enabled,
        obstacleAvoidance: {
            ...obstacleConfig.value,
            enabled
        }
    });
};

const updateObstacleNumber = (key, value, min, max) => {
    const numericValue = Number(value);
    const fallback = Number(obstacleConfig.value[key]) || min;
    updateObstacleConfig(key, Math.max(min, Math.min(max, Number.isFinite(numericValue) ? numericValue : fallback)));
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

const isPhotoTypeSelected = (type) => {
    const photoType = props.modelValue.photoType;
    if (Array.isArray(photoType)) {
        return photoType.includes(type);
    }
    return photoType === type;
};

const togglePhotoType = (type) => {
    let current = props.modelValue.photoType;
    if (!Array.isArray(current)) {
        current = [current];
    }

    let next;
    if (current.includes(type)) {
        // Attempt to remove
        if (current.length > 1) {
            next = current.filter(t => t !== type);
        } else {
            // Cannot remove last one
            return;
        }
    } else {
        // Add
        next = [...current, type];
    }
    updateConfig('photoType', next);
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
.waypoint-config-panel::-webkit-scrollbar {
    width: 4px;
}

.waypoint-config-panel::-webkit-scrollbar-thumb {
    background: #f1f1f1;
    border-radius: 2px;
}

.dji-radio-unified :deep(.ant-radio-button-wrapper) {
    height: 30px !important;
    line-height: 28px !important;
    font-size: 11px !important;
    border-color: #e5e7eb !important;
    background: #f9fafb !important;
    color: #6b7280 !important;
    transition: all 0.2s ease;
}

.dji-radio-unified :deep(.ant-radio-button-wrapper-checked) {
    background: #1890ff !important;
    color: white !important;
    border-color: #1890ff !important;
}

.dji-collapse-unified :deep(.ant-collapse-header) {
    padding: 12px 0 !important;
    background: white !important;
    border-top: 1px solid #f3f4f6 !important;
}

.dji-collapse-unified :deep(.ant-collapse-content-box) {
    padding: 0 0 12px 0 !important;
}

:deep(.ant-form-item-label > label) {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 800;
}
</style>
