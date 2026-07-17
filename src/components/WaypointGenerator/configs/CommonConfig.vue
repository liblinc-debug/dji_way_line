<template>
    <div class="common-config py-2">
        <a-divider orientation="left" class="!mt-0 !mb-4 !text-gray-900 !font-semibold">通用任务配置</a-divider>

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
                    <a-form-item label="失联行为">
                        <a-select :value="modelValue.exitOnRCLost"
                            @update:value="val => updateConfig('exitOnRCLost', val)" size="small">
                            <a-select-option value="executeLostAction">执行失联动作</a-select-option>
                            <a-select-option value="goContinue">继续执行航线</a-select-option>
                        </a-select>
                    </a-form-item>
                </a-col>
                <a-col :span="12">
                    <a-form-item label="安全起飞高度 (m)">
                        <a-input-number :value="modelValue.takeOffSecurityHeight || 20"
                            @update:value="val => updateConfig('takeOffSecurityHeight', val)" :min="10" :max="200"
                            class="w-full" size="small" />
                    </a-form-item>
                </a-col>
                <a-col :span="12">
                    <a-form-item label="全局飞行速度 (m/s)">
                        <a-input-number :value="modelValue.globalTransitionalSpeed || 5"
                            @update:value="val => updateConfig('globalTransitionalSpeed', val)" :min="1" :max="15"
                            class="w-full" size="small" />
                    </a-form-item>
                </a-col>
            </a-row>

            <a-divider class="!my-2" />

            <a-form-item label="航点高度参考模式">
                <a-radio-group :value="modelValue.executeHeightMode" button-style="solid" class="w-full flex"
                    @update:value="val => updateConfig('executeHeightMode', val)">
                    <a-radio-button value="WGS84" class="flex-1 text-center text-xs">海拔高度</a-radio-button>
                    <a-radio-button value="relativeToStartPoint"
                        class="flex-1 text-center text-xs">相对起飞点</a-radio-button>
                    <a-radio-button value="realTimeFollowSurface"
                        class="flex-1 text-center text-xs">相对地形</a-radio-button>
                </a-radio-group>

                <div class="mt-4 flex items-center gap-3">
                    <div class="flex-1 h-16 bg-gray-50 rounded border border-gray-100 flex items-center justify-center">
                        <span class="text-[10px] text-gray-400 font-bold uppercase">高度可视化预览区</span>
                    </div>
                    <div class="w-20">
                        <a-input-number :value="modelValue.flightHeight || 60"
                            @update:value="val => updateConfig('flightHeight', val)" :min="20" :max="500"
                            class="w-full text-center" size="small" addon-after="m" />
                    </div>
                </div>
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
</script>
