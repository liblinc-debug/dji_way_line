<template>
    <div class="mapping-config py-2">
        <a-divider orientation="left" class="!mt-0 !mb-4 !text-gray-900 !font-semibold">面状航线任务配置</a-divider>

        <a-form layout="vertical">
            <a-row :gutter="12">
                <a-col :span="12">
                    <a-form-item label="飞向首航点模式">
                        <a-select :value="modelValue.flyToWaylineMode"
                            @update:value="updateFlyToWaylineMode" size="small">
                            <a-select-option value="safely">安全模式</a-select-option>
                            <a-select-option value="pointToPoint">点对点</a-select-option>
                        </a-select>
                    </a-form-item>
                </a-col>
                <a-col :span="12">
                    <a-form-item label="完成动作">
                        <a-select :value="modelValue.finishAction"
                            @update:value="val => updateConfig('finishAction', val)" size="small">
                            <a-select-option value="goHome">自动返航</a-select-option>
                            <a-select-option value="autoLand">自动降落</a-select-option>
                            <a-select-option value="hover">原地悬停</a-select-option>
                            <a-select-option value="backToStart">返回首航点</a-select-option>
                        </a-select>
                    </a-form-item>
                </a-col>
                <a-col :span="12">
                    <a-form-item label="失控动作">
                        <a-select :value="modelValue.executeRCLostAction"
                            @update:value="val => updateConfig('executeRCLostAction', val)" size="small">
                            <a-select-option value="goBack">自动返航</a-select-option>
                            <a-select-option value="hover">原地悬停</a-select-option>
                            <a-select-option value="landing">自动降落</a-select-option>
                        </a-select>
                    </a-form-item>
                </a-col>
                <a-col :span="12">
                    <a-form-item label="标定飞行">
                        <a-switch :checked="modelValue.caliFlightEnable"
                            @update:checked="val => updateConfig('caliFlightEnable', val)" size="small" />
                    </a-form-item>
                </a-col>
            </a-row>

            <a-form-item label="航点高度参考模式">
                <a-radio-group :value="modelValue.executeHeightMode" button-style="solid" class="w-full flex"
                    @update:value="val => updateConfig('executeHeightMode', val)">
                    <a-radio-button value="WGS84" class="flex-1 text-center text-xs">海拔高度</a-radio-button>
                    <a-radio-button value="relativeToStartPoint"
                        class="flex-1 text-center text-xs">相对起飞点</a-radio-button>
                </a-radio-group>

                <div class="mt-4 flex gap-4 items-center">
                    <div
                        class="bg-gray-50 rounded-md p-2 flex-1 min-h-[100px] flex items-center justify-center border border-gray-100">
                        <svg v-if="modelValue.executeHeightMode === 'WGS84'" viewBox="0 0 320 150"
                            class="w-full h-full block opacity-70">
                            <line x1="10" y1="135" x2="310" y2="135" stroke="#4a90e2" stroke-width="2" />
                            <text x="10" y="148" fill="#4a90e2" font-size="6">海平面 (WGS84)</text>
                            <path
                                d="M 10 120 L 50 115 L 90 110 L 130 105 L 170 100 L 210 108 L 250 112 L 290 118 L 310 120"
                                fill="none" stroke="#8b7355" stroke-width="2" />
                            <circle cx="60" cy="120" r="4" fill="#4a90e2" />
                            <line x1="170" y1="58" x2="170" y2="135" stroke="#9b59b6" stroke-width="2" />
                            <text x="175" y="80" fill="#9b59b6" font-size="6" font-weight="bold">绝对高度</text>
                        </svg>
                        <svg v-else viewBox="0 0 320 150" class="w-full h-full block opacity-70">
                            <line x1="10" y1="135" x2="310" y2="135" stroke="#4a90e2" stroke-width="1"
                                stroke-dasharray="2,2" />
                            <circle cx="70" cy="115" r="4" fill="#4a90e2" />
                            <line x1="215" y1="65" x2="215" y2="115" stroke="#e74c3c" stroke-width="2" />
                            <text x="185" y="45" fill="#e74c3c" font-size="6" font-weight="bold">相对点高度</text>
                        </svg>
                    </div>
                    <div class="flex flex-col gap-1 min-w-[70px]">
                        <a-button size="small" @click="adjustHeight(10)" class="!text-[10px]">+10</a-button>
                        <div class="bg-white p-1 rounded border border-blue-200 text-center">
                            <span class="text-blue-600 font-bold text-xs">{{ modelValue.globalHeight || 50 }}m</span>
                        </div>
                        <a-button size="small" @click="adjustHeight(-10)" class="!text-[10px]">-10</a-button>
                    </div>
                </div>
            </a-form-item>

            <a-card title="扫描参数设置" size="small" class="mt-4 bg-gray-50/50"
                :headStyle="{ fontSize: '12px', fontWeight: 'bold' }">
                <a-row :gutter="12">
                    <a-col :span="12">
                        <a-form-item label="扫描间距 (m)" class="mb-2">
                            <a-input-number :value="modelValue.scanSetting?.scanSpacing || 20"
                                @update:value="val => updateScanSetting('scanSpacing', val)" :min="5" :max="200"
                                class="w-full" size="small" />
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="航线角度 (°)" class="mb-2">
                            <a-input-number :value="modelValue.scanSetting?.direction || 0"
                                @update:value="val => updateScanSetting('direction', val)" :min="0" :max="359"
                                class="w-full" size="small" />
                        </a-form-item>
                    </a-col>
                </a-row>
            </a-card>

            <a-form-item label="全局飞行速度 (m/s)" class="mt-4">
                <a-input-number :value="modelValue.globalTransitionalSpeed || 5"
                    @update:value="val => updateConfig('globalTransitionalSpeed', val)" :min="1" :max="15"
                    class="w-full" size="small" />
            </a-form-item>
        </a-form>
    </div>
</template>

<script setup>
const props = defineProps({
    modelValue: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['update:modelValue']);

const getClimbModeByFlyToWaylineMode = (mode) => mode === 'pointToPoint' ? 'oblique' : 'vertical';

const updateConfig = (key, value) => {
    emit('update:modelValue', { ...props.modelValue, [key]: value });
};

const updateFlyToWaylineMode = (mode) => {
    const nextMode = mode === 'pointToPoint' ? 'pointToPoint' : 'safely';
    emit('update:modelValue', {
        ...props.modelValue,
        flyToWaylineMode: nextMode,
        climbMode: getClimbModeByFlyToWaylineMode(nextMode)
    });
};

const updateScanSetting = (key, value) => {
    const currentScanSetting = props.modelValue.scanSetting || {};
    const newScanSetting = { ...currentScanSetting, [key]: value };
    updateConfig('scanSetting', newScanSetting);
};

const adjustHeight = (delta) => {
    const currentHeight = props.modelValue.globalHeight || 50;
    const newHeight = Math.max(20, Math.min(500, currentHeight + delta));
    updateConfig('globalHeight', newHeight);
};
</script>
