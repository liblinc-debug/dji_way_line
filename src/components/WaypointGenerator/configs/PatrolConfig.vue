<template>
    <div class="patrol-config py-2">
        <a-divider orientation="left" class="!mt-0 !mb-4 !text-gray-900 !font-semibold">巡逻航线任务配置</a-divider>

        <a-form layout="vertical">
            <a-row :gutter="12">
                <a-col :span="12">
                    <a-form-item label="巡逻模式">
                        <a-select :value="modelValue.isClosedLoop"
                            @update:value="val => updateConfig('isClosedLoop', val)" size="small">
                            <a-select-option :value="true">闭合循环</a-select-option>
                            <a-select-option :value="false">单次巡逻</a-select-option>
                        </a-select>
                    </a-form-item>
                </a-col>
                <a-col :span="12">
                    <a-form-item label="失控行为">
                        <a-select :value="modelValue.exitOnRCLost"
                            @update:value="val => updateConfig('exitOnRCLost', val)" size="small">
                            <a-select-option value="executeLostAction">执行失联动作</a-select-option>
                            <a-select-option value="goContinue">继续执行航线</a-select-option>
                        </a-select>
                    </a-form-item>
                </a-col>
            </a-row>

            <a-form-item label="相对高度与参考深度">
                <a-radio-group :value="modelValue.executeHeightMode" button-style="solid" class="w-full flex mb-3"
                    @update:value="val => updateConfig('executeHeightMode', val)">
                    <a-radio-button value="WGS84" class="flex-1 text-center text-xs">海拔</a-radio-button>
                    <a-radio-button value="relativeToStartPoint"
                        class="flex-1 text-center text-xs">相对起飞点</a-radio-button>
                    <a-radio-button value="realTimeFollowSurface"
                        class="flex-1 text-center text-xs">相对地形</a-radio-button>
                </a-radio-group>

                <div class="flex items-center gap-2">
                    <a-input-number :value="modelValue.globalHeight || 50"
                        @update:value="val => updateConfig('globalHeight', val)" :min="20" :max="500" class="flex-1"
                        size="small" addon-after="m" />
                </div>
            </a-form-item>

            <a-card size="small" class="mt-4 border-purple-200 bg-purple-50/30 overflow-hidden">
                <template #title>
                    <div class="flex justify-between items-center w-full pr-1">
                        <span class="text-xs font-bold text-purple-700">🎨 智能识别告警</span>
                        <a-switch :checked="modelValue.scanSetting?.aiEnabled"
                            @update:checked="val => updateScanSetting('aiEnabled', val)" size="small" />
                    </div>
                </template>

                <div v-if="modelValue.scanSetting?.aiEnabled" class="space-y-4 pt-2">
                    <div class="grid grid-cols-2 gap-3">
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] text-gray-400 font-bold uppercase">置信度 (%)</span>
                            <a-input-number :value="modelValue.scanSetting?.confidence || 80"
                                @update:value="val => updateScanSetting('confidence', val)" size="small"
                                class="w-full" />
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] text-gray-400 font-bold uppercase">镜头模式</span>
                            <a-select :value="modelValue.scanSetting?.cameraMode || 'visible'"
                                @update:value="val => updateScanSetting('cameraMode', val)" size="small" class="w-full">
                                <a-select-option value="visible">可见光</a-select-option>
                                <a-select-option value="infrared">红外</a-select-option>
                            </a-select>
                        </div>
                    </div>

                    <div class="p-2 bg-white rounded border border-purple-100">
                        <div class="text-[10px] text-gray-400 font-bold uppercase mb-2">识别目标</div>
                        <div class="flex flex-wrap gap-2">
                            <a-checkbox :checked="true">人 (🚶)</a-checkbox>
                            <a-checkbox :checked="false">车 (🚗)</a-checkbox>
                            <a-checkbox :checked="false">船 (🚢)</a-checkbox>
                        </div>
                    </div>
                </div>
                <div v-else class="text-[10px] text-gray-400 text-center py-4 italic">
                    开启后将自动识别目标并触发联动告警
                </div>
            </a-card>

            <a-form-item label="飞行速度控制 (m/s)" class="mt-4">
                <a-slider :value="modelValue.globalTransitionalSpeed || 5"
                    @update:value="val => updateConfig('globalTransitionalSpeed', val)" :min="1" :max="15" />
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

const updateConfig = (key, value) => {
    emit('update:modelValue', { ...props.modelValue, [key]: value });
};

const updateScanSetting = (key, value) => {
    const currentScanSetting = props.modelValue.scanSetting || {};
    const newScanSetting = { ...currentScanSetting, [key]: value };
    updateConfig('scanSetting', newScanSetting);
};
</script>
