<template>
    <div ref="editorRootRef" tabindex="0" @pointerdown="onEditorPointerDown"
        class="flex h-full w-full bg-transparent text-gray-800 outline-none">
        <!-- 左侧面板：双模式切换 (列表/配置) -->
        <div
            class="h-full w-[350px] shrink-0 border-r border-gray-200 bg-white z-10 flex flex-col min-h-0 shadow-lg overflow-hidden pointer-events-auto">
            <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div class="flex items-center gap-2">
                    <span class="text-blue-600 font-bold">🛠️</span>
                    <span class="font-bold tracking-tight text-gray-700">航线编辑器</span>
                </div>
                <div class="flex gap-2">
                    <a-button size="small" @click="$emit('back')">返回</a-button>
                    <a-dropdown :trigger="['click']">
                        <a-button size="small">下载⌄</a-button>
                        <template #overlay>
                            <a-menu>
                                <a-menu-item key="kmz" @click="downloadKMZ">下载 KMZ</a-menu-item>
                                <a-menu-item key="json" @click="downloadJSON">下载 JSON</a-menu-item>
                            </a-menu>
                        </template>
                    </a-dropdown>
                    <a-button size="small" type="primary" @click="saveMission">保存</a-button>
                </div>
            </div>

            <div class="flex-1 min-h-0 overflow-hidden">
                <a-tabs v-model:activeKey="leftTabActiveKey" class="h-full min-h-0 dji-tabs">
                <a-tab-pane key="list" tab="航点列表" class="h-full min-h-0 overflow-hidden">
                    <div class="h-full min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-3">
                        <WaypointList :waypoints="waypoints" :selected-wp-index="selectedWpIndex"
                            :selected-action-index="selectedActionIndex" @update:waypoints="waypoints = $event"
                            @remove="removeWaypoint" @clear="clearWaypoints" @reverse="reverseWaypoints"
                            @record-pose="handleRecordPose" @select="handleSelectWaypoint"
                            @select-action="handleSelectAction" @add-action="handleAddAction"
                            @remove-action="handleRemoveAction" />
                    </div>
                </a-tab-pane>
                <a-tab-pane key="config" tab="任务配置" class="h-full min-h-0 overflow-hidden">
                    <div class="h-full min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-0 bg-white text-gray-900">
                        <MissionConfig v-model="missionConfig" @reset-takeoff="isSettingTakeoffPoint = true" />
                    </div>
                </a-tab-pane>
                </a-tabs>
            </div>
        </div>

        <!-- 主视觉区域：改为透明占位，显示 index.vue 层的地图 -->
        <div class="flex-1 h-full relative min-w-0 bg-transparent flex flex-col overflow-hidden">
            <!-- 占位层：用于接收 Teleport 但现在我们直接让背景穿透 -->
            <div id="main-view-host" class="absolute inset-0 z-0"></div>

            <!-- 底部任务总览 (仅在地图渲染到主屏时显示) -->
            <div v-if="!isPreviewSwapped"
                class="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-white/95 backdrop-blur rounded-full border border-gray-100 shadow-xl z-20 pointer-events-none">
                <div class="flex items-center gap-2">
                    <span class="text-gray-400 text-[10px] uppercase font-bold">航点</span>
                    <span class="text-blue-500 font-black text-sm">{{ waypoints.length }}</span>
                </div>
                <div v-if="stats" class="flex items-center gap-4 text-[10px]">
                    <div class="w-px h-3 bg-gray-200"></div>
                    <div class="flex items-center gap-2">
                        <span class="text-gray-400 uppercase font-bold">总长度</span>
                        <span class="text-gray-800 font-mono font-bold">{{ stats.distance.toFixed(0) }}m</span>
                    </div>
                </div>
            </div>

            <div v-if="virtualFlightEnabled"
                class="absolute bottom-4 left-4 z-20 max-w-[520px] rounded-lg border border-gray-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur pointer-events-auto">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black uppercase tracking-widest"
                        :class="activePreviewMode === 'virtual' ? 'text-emerald-600' : 'text-orange-500'">
                        {{ activePreviewMode === 'virtual' ? '虚拟飞行接管中' : '虚拟飞行运行中' }}
                    </span>
                    <span class="text-[10px] text-gray-400 font-mono">{{ virtualFlightKeyHint }}</span>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-600 font-mono">
                    <span>位置 {{ virtualFlightPoseLabel }}</span>
                    <span>按键 {{ activeVirtualKeyText }}</span>
                    <span>朝向 {{ (activePreviewAircraftYaw || 0).toFixed(0) }}°</span>
                    <span>俯仰 {{ (activePreviewGimbalPitch || 0).toFixed(0) }}°</span>
                    <span>变焦 {{ activePreviewZoomFactor.toFixed(1) }}X</span>
                </div>
                <div class="mt-3 flex justify-end">
                    <a-button size="small" type="primary" @click="handleAddWaypointFromVirtualFlight">
                        在此位置添加航点
                    </a-button>
                </div>
            </div>
        </div>

        <!-- 右侧面板：航点详细属性 (选中时显示) -->
        <div v-if="selectedWpIndex !== -1 || virtualFlightEnabled"
            class="h-full w-[350px] shrink-0 border-l border-gray-200 bg-white z-10 flex flex-col shadow-lg animate-in slide-in-from-right duration-300 overflow-hidden pointer-events-auto">
            <template v-if="selectedWpIndex !== -1">
                <WaypointPropertyPanel v-if="waypoints[selectedWpIndex]" :index="selectedWpIndex"
                    :waypoint="waypoints[selectedWpIndex]" :selected-action-index="selectedActionIndex"
                    @update:waypoint="val => updateWaypoint(selectedWpIndex, val)" @close="selectedWpIndex = -1"
                    @select-action="selectedActionIndex = $event" @remove-action="handleRemoveAction"
                    @preview-action="handlePreviewActionRaw" class="flex-1 overflow-y-auto" />
            </template>

            <template v-else>
                <div class="flex-1 flex flex-col bg-white">
                    <div class="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                        <div class="flex items-center gap-2">
                            <span class="text-emerald-500 text-[8px] animate-pulse">●</span>
                            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">虚拟飞行</span>
                        </div>
                        <div class="mt-2 text-xs font-semibold text-gray-700">{{ virtualFlightStatusText }}</div>
                        <div class="mt-1 text-[10px] text-gray-400 font-mono">{{ virtualFlightKeyHint }}</div>
                    </div>
                    <div class="flex-1 overflow-y-auto custom-scrollbar p-4 text-[11px] text-gray-500">
                        <div class="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 font-mono">
                            <div>位置 {{ virtualFlightPoseLabel }}</div>
                            <div class="mt-1">按键 {{ activeVirtualKeyText }}</div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- 3D监控面板集成 (仅针对选中点) -->
            <div class="h-[280px] bg-gray-50 border-t border-gray-200 flex flex-col relative overflow-hidden shrink-0">
                <div class="px-3 py-2 bg-white border-b border-gray-100 flex justify-between items-center z-10">
                    <div class="flex items-center gap-2">
                        <span class="text-green-500 text-[8px] animate-pulse">●</span>
                        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">{{ previewPanelTitle }}</span>
                    </div>
                    <div class="flex gap-2">
                        <span
                            class="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold border border-blue-100">
                            {{ zoomRatio }}X
                        </span>
                        <span
                            class="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-mono border border-gray-200">
                            {{ (activePreviewGimbalPitch || 0).toFixed(0) }}°
                        </span>
                    </div>
                </div>

                <div class="flex-1 bg-white flex flex-col p-2 overflow-hidden relative">
                    <!-- 侧窗锚点：现在仅作为透明容器显示侧窗内容 -->
                    <div id="side-view-host"
                        class="w-full h-[260px] bg-transparent border border-white/10 rounded flex items-center justify-center relative overflow-hidden transition-all duration-300">
                        <!-- 当小窗未被投射任何内容时的提示 (仅在未选中航点或视图已交换至大屏时显示) -->
                        <div v-if="activePreviewMode === 'idle' || (selectedWpIndex !== -1 && isPreviewSwapped)"
                            class="flex flex-col items-center pointer-events-none">
                            <div
                                class="text-gray-600 text-[10px] font-black uppercase tracking-widest mb-1 font-mono italic">
                                {{ fpvStatusText }}</div>
                            <div class="text-[9px] text-gray-700 font-mono tracking-tighter">{{ fpvModeSubText }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div v-else
            class="h-full w-[350px] shrink-0 border-l border-gray-200 bg-gray-50 flex items-center justify-center pointer-events-auto">
            <div class="text-center p-8 opacity-40">
                <div class="text-4xl mb-4">👆</div>
                <div class="text-[10px] font-black uppercase tracking-widest text-gray-400">请选择航点进行编辑</div>
            </div>
        </div>


        <!-- DJI Style Map Controls (Right Side) -->
        <div class="absolute right-4 top-24 flex flex-col gap-2 z-30 pointer-events-auto">
            <div @click="isSettingTakeoffPoint = !isSettingTakeoffPoint"
                :class="['w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-md border-2',
                    isSettingTakeoffPoint ? 'bg-blue-500 border-white scale-110' : 'bg-white/90 border-transparent hover:bg-white']">
                <svg viewBox="0 0 100 100" class="w-4 h-4 transition-colors"
                    :class="isSettingTakeoffPoint ? 'text-white' : 'text-blue-500'">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="6" />
                    <path d="M50 25 L38 42 H62 Z" fill="currentColor" />
                    <text x="50" y="78" font-family="Arial" font-size="32" font-weight="bold" text-anchor="middle"
                        fill="currentColor">H</text>
                </svg>
                <!-- Simple Tooltip -->
                <div v-if="isSettingTakeoffPoint"
                    class="absolute right-12 px-3 py-1.5 bg-blue-500 text-white text-[11px] font-bold rounded shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-right-2">
                    请在地图上点击设置起飞点
                    <div class="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-blue-500 rotate-45">
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. FPV 云台预览 Teleport (根据状态决定显示) -->
        <Teleport :to="cameraTarget" v-if="activePreviewMode !== 'idle' && cameraTarget">
        <div class="w-full h-full relative group bg-black overflow-hidden pointer-events-auto">
            <CameraPreview v-if="activePreviewDronePos" :dronePos="activePreviewDronePos"
                :takeoffHeight="missionConfig.takeOffPointHeight || 0" :gimbalPitch="activePreviewGimbalPitch"
                :aircraftYaw="activePreviewAircraftYaw" :zoomFactor="activePreviewZoomFactor"
                @update:distance="d => groundDistance = d" />

            <!-- 通用 HUD 覆盖层 -->
            <div class="absolute inset-0 pointer-events-none z-20">
                <!-- 情况 A: 当前是在主显示区 (大屏 FPV) -->
                <template v-if="isPreviewSwapped">
                    <!-- 中心大准星 -->
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                        <div class="flex items-center gap-3 mb-2">
                            <span
                                class="text-white text-xs font-black font-mono drop-shadow-xl bg-black/40 px-2 py-0.5 rounded border border-white/10">测距:
                                {{ (groundDistance || 0).toFixed(1) }} m</span>
                            <div class="w-12 h-12 border-2 border-white/80 relative flex items-center justify-center">
                                <div class="w-full h-[1px] bg-white"></div>
                                <div class="w-[1px] h-full bg-white absolute"></div>
                            </div>
                        </div>
                    </div>
                    <!-- 垂直变焦标尺 (带刻度标签) -->
                    <div class="absolute right-6 top-1/4 bottom-1/4 w-12 flex flex-col items-center justify-between py-4 bg-black/30 backdrop-blur-md rounded-xl border border-white/10 pointer-events-auto"
                        @mousedown="isDraggingZoom = true" @click="handleZoomClick">
                        <span class="text-[10px] text-white font-bold opacity-80">112X</span>
                        <div class="flex-1 w-[3px] bg-white/10 relative my-3 pointer-events-none">
                            <div v-for="z in [112, 56, 14, 7, 3, 1]" :key="z"
                                class="absolute w-5 h-[1.5px] bg-white -left-[8px]"
                                :style="{ bottom: `${(Math.log2(z) / 6.807) * 100}%` }">
                                <span v-if="z !== 112 && z !== 1"
                                    class="absolute left-full ml-2 -top-2 text-[9px] text-white font-mono font-bold">{{
                                        z }}X</span>
                            </div>
                            <div class="absolute left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full border-2 border-orange-500 shadow-xl flex items-center justify-center transition-all duration-200 z-10"
                                :style="{ bottom: `${(Math.log2(activePreviewZoomFactor) / 6.807) * 100}%` }">
                                <div class="w-2.5 h-2.5 bg-orange-500 rounded-full scale-90"></div>
                            </div>
                        </div>
                        <span class="text-[10px] text-white font-bold opacity-80">1X</span>
                    </div>
                    <!-- 状态信息条 -->
                    <div
                        class="absolute bottom-8 left-8 flex items-center gap-6 bg-black/50 px-5 py-2 rounded-lg border border-white/10 pointer-events-auto backdrop-blur-md">
                        <div class="flex flex-col"><span
                                class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">变焦模式</span><span
                                class="text-xs text-white font-black">自动 / 广角 + 变焦</span></div>
                        <template v-for="(metric, mIdx) in hudHeightMetrics" :key="'hud-m-' + mIdx">
                            <div v-if="mIdx > 0" class="w-px h-6 bg-white/20"></div>
                            <div class="flex flex-col">
                                <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                                    {{ metric.label }}
                                </span>
                                <span class="text-xs font-black font-mono" :class="metric.color">
                                    {{ metric.value }}m
                                </span>
                            </div>
                        </template>
                        <div class="w-px h-6 bg-white/20"></div>
                        <div class="flex flex-col"><span class="text-[10px] text-red-500 font-bold animate-pulse">●
                                REC</span><span class="text-xs text-white font-black font-mono">4K 60FPS</span></div>
                    </div>

                    <!-- 顶部模式选择 (全屏 FPV) -->
                    <div
                        class="absolute top-10 left-1/2 -translate-x-1/2 flex items-stretch z-30 scale-110 shadow-2xl border border-white/20 rounded-md overflow-hidden bg-[#1a1a1acc] pointer-events-auto">
                        <div @click="setPreviewZoomFactor(1.0)"
                            class="px-8 py-2.5 text-sm font-bold transition-all cursor-pointer flex items-center justify-center min-w-[120px]"
                            :class="activePreviewZoomFactor < 3 ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'">
                            广角 1X</div>
                        <div @click="setPreviewZoomFactor(Math.max(3.0, activePreviewZoomFactor))"
                            class="px-8 py-2.5 text-sm font-bold border-l border-white/10 transition-all cursor-pointer flex items-center justify-center min-w-[140px] gap-2"
                            :class="activePreviewZoomFactor >= 3 ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'">
                            <span class="text-orange-400">变焦</span> {{ zoomRatio }}X
                        </div>
                    </div>
                    <!-- 退出交换按钮 -->
                    <div @click="toggleViewSwap"
                        class="absolute top-10 left-10 p-3 bg-blue-600 border border-blue-400 rounded-full shadow-2xl cursor-pointer z-40 hover:bg-blue-500 text-white flex items-center justify-center group pointer-events-auto active:scale-95 transition-all">
                        <svg viewBox="0 0 1024 1024" class="w-7 h-7 fill-current">
                            <path
                                d="M847.1 230.1L692.6 75.6c-4.7-4.7-12.3-4.7-17 0s-4.7 12.3 0 17l134 134H189.6c-6.6 0-12 5.4-12 12v24c0 6.6 5.4 12 12 12h632.4l-134 134c-4.7 4.7-4.7 12.3 0 17 4.7 4.7 12.3 4.7 17 0l154.5-154.5c4.7-4.7 4.7-12.3-0.4-17.4zM176.9 793.9l154.5 154.5c4.7 4.7 12.3 4.7 17 0s4.7-12.3 0-17l-134-134h630c6.6 0 12-5.4 12-12v-24c0-6.6-5.4-12-12-12h-630l134-134c4.7-4.7 4.7-12.3 0-17-4.7-4.7-12.3-4.7-17 0l-154.5 154.5c-4.7 4.7-4.7 12.3 0.4 17.4z" />
                        </svg>
                    </div>
                </template>

                <!-- 情况 B: 当前是在侧边栏 (小窗预览) -->
                <template v-else>
                    <!-- 简易准星 -->
                    <div
                        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
                        <span
                            class="text-white text-[9px] font-black font-mono bg-black/40 px-1.5 py-0.5 rounded border border-white/5 mb-1 backdrop-blur-sm">
                            {{ (groundDistance || 0).toFixed(0) }}m
                        </span>
                        <div class="w-6 h-6 border-2 border-white/60 opacity-50 flex items-center justify-center">
                            <div class="w-full h-[1px] bg-white"></div>
                            <div class="w-[1px] h-full bg-white absolute"></div>
                        </div>
                    </div>
                    <!-- 交换按钮 -->
                    <div @click.stop="toggleViewSwap"
                        class="absolute top-2 left-2 w-8 h-8 bg-blue-600/90 border border-white/20 rounded-sm flex items-center justify-center z-40 cursor-pointer hover:bg-blue-500 shadow-lg text-white group pointer-events-auto">
                        <svg viewBox="0 0 1024 1024"
                            class="w-5 h-5 fill-current group-hover:scale-110 transition-transform">
                            <path
                                d="M847.1 230.1L692.6 75.6c-4.7-4.7-12.3-4.7-17 0s-4.7 12.3 0 17l134 134H189.6c-6.6 0-12 5.4-12 12v24c0 6.6 5.4 12 12 12h632.4l-134 134c-4.7 4.7-4.7 12.3 0 17 4.7 4.7 12.3 4.7 17 0l154.5-154.5c4.7-4.7 4.7-12.3-0.4-17.4zM176.9 793.9l154.5 154.5c4.7 4.7 12.3 4.7 17 0s4.7-12.3 0-17l-134-134h630c6.6 0 12-5.4 12-12v-24c0-6.6-5.4-12-12-12h-630l134-134c4.7-4.7 4.7-12.3 0-17-4.7-4.7-12.3-4.7-17 0l-154.5 154.5c-4.7 4.7-4.7 12.3 0.4 17.4z" />
                        </svg>
                    </div>
                    <!-- 小窗顶部变焦按钮 -->
                    <div
                        class="absolute top-2 left-1/2 -translate-x-1/2 flex items-stretch z-30 scale-[0.75] origin-top shadow-xl border border-white/20 rounded-sm overflow-hidden bg-[#1a1a1acc] pointer-events-auto">
                        <div @click="setPreviewZoomFactor(1.0)"
                            class="px-3 py-1 text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center"
                            :class="activePreviewZoomFactor < 3 ? 'bg-blue-600 text-white' : 'text-gray-400'">广角</div>
                        <div @click="setPreviewZoomFactor(Math.max(3.0, activePreviewZoomFactor))"
                            class="px-3 py-1 text-[11px] font-bold border-l border-white/10 transition-all cursor-pointer flex items-center justify-center gap-1"
                            :class="activePreviewZoomFactor >= 3 ? 'bg-blue-600 text-white' : 'text-gray-400'">
                            <span class="text-orange-400">变焦</span> {{ zoomRatio }}X
                        </div>
                    </div>
                    <!-- 迷你变焦标尺 -->
                    <div class="absolute right-1 top-10 bottom-10 w-6 flex flex-col items-center justify-between py-2 bg-black/40 backdrop-blur-sm rounded-md border border-white/5 pointer-events-auto cursor-ns-resize"
                        @mousedown="isDraggingZoom = true" @click="handleZoomClick">
                        <span class="text-[6px] text-white/60 font-black">112</span>
                        <div class="flex-1 w-[1px] bg-white/10 relative my-1 marker-line">
                            <div class="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full border border-orange-500 shadow-sm"
                                :style="{ bottom: `${(Math.log2(activePreviewZoomFactor) / 6.807) * 100}%` }"></div>
                        </div>
                        <span class="text-[6px] text-white/60 font-black">1</span>
                    </div>
                    <!-- 底部航高/红外标识 -->
                    <div class="absolute bottom-2 left-2 flex items-center gap-1.5 z-30">
                        <span class="text-[9px] font-black text-red-500 italic drop-shadow-sm">IR</span>
                        <span class="text-[8px] text-white/80 font-mono font-black tracking-tight">
                            {{hudHeightMetrics.map(m => `${m.label.split('(')[1].replace(')', '')}:
                            ${m.value}m`).join(' | ')}}
                        </span>
                    </div>
                </template>
            </div>
        </div>
        </Teleport>
    </div>
</template>

<script setup>
import * as turf from '@turf/turf';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ACTION_TYPE, DEFAULT_ACTION_PARAMS } from '../../../types/waypointRoute.js';
import { OBSTACLE_AVOIDANCE_DEFAULT } from '../../../types/missionConfig.js';
import { generateKMZ } from '../../../utils/kmzGenerator';
import { buildLocalWaylineResult, downloadWaylineBlob, downloadWaylineJson } from '../../../utils/localWaylineFile';
import CameraPreview from '../pro/CameraPreview.vue';
import MissionConfig from '../pro/MissionConfigPro.vue';
import WaypointList from '../pro/WaypointListPro.vue';
import WaypointPropertyPanel from './WaypointPropertyPanel.vue';

const groundDistance = ref(0);

const props = defineProps({
    initialMission: {
        type: Object,
        required: true
    },
    getMapPose: {
        type: Function,
        default: null
    }
});

const emit = defineEmits(['back', 'save', 'update:mission-data', 'record-pose', 'fov-update', 'virtual-flight-update', 'generate-result', 'generate-error', 'focus-waypoint']);

// 状态管理
const missionConfig = ref({
    photoType: ['visible'],
    lowLightMode: false,
    climbMode: 'vertical',
    executeHeightMode: 'WGS84',
    globalHeight: 60,
    globalTransitionalSpeed: 10,
    takeOffSecurityHeight: 20,
    takeoffSpeed: 10,
    waypointType: 'linear',
    yawMode: 'alongPath',
    gimbalPitchMode: 'manual',
    finishAction: 'goHome',
    useObstacleAvoidance: true,
    ...props.initialMission.config,
    obstacleAvoidance: {
        ...OBSTACLE_AVOIDANCE_DEFAULT,
        ...(props.initialMission.config?.obstacleAvoidance || {})
    }
});
const waypoints = ref([...(props.initialMission.waypoints || [])]);
const mapViewerRef = ref(null);
const leftTabActiveKey = ref('list');
const selectedWpIndex = ref(-1);
const selectedActionIndex = ref(-1);
const isMounted = ref(false);
const editorRootRef = ref(null);

const virtualFlightEnabled = ref(false);
const virtualFlightInitialized = ref(false);
const virtualFlightRafId = ref(0);
const virtualFlightLastTs = ref(0);
const virtualDronePos = ref(null);
const virtualGimbalPitch = ref(-45);
const virtualAircraftYaw = ref(0);
const virtualZoomFactor = ref(2.0);
const activeVirtualKeys = ref([]);
const lastVirtualKey = ref('');
const previewFocusMode = ref('waypoint');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeDegrees = (value) => ((value % 360) + 360) % 360;
const virtualKeyLabels = {
    KeyW: 'W',
    KeyA: 'A',
    KeyS: 'S',
    KeyD: 'D',
    KeyQ: 'Q',
    KeyE: 'E',
    KeyC: 'C',
    KeyZ: 'Z'
};
const virtualKeyHint = computed(() => 'W/A/S/D 前后左右 · Q/E 转向 · C/Z 升降');
const activeVirtualKeyText = computed(() => {
    if (!activeVirtualKeys.value.length) return '等待按键';
    return activeVirtualKeys.value.map(code => virtualKeyLabels[code] || code).join(' · ');
});
const virtualFlightStatusText = computed(() => (
    !virtualFlightEnabled.value
        ? '虚拟飞行未开启'
        : (activePreviewMode.value === 'virtual'
            ? '当前预览正在跟随虚拟飞行状态'
            : '虚拟飞行已开启，当前预览被航点接管')
));
const virtualFlightPoseLabel = computed(() => {
    const pose = virtualDronePos.value;
    if (!pose) return '未初始化';
    return `${Number(pose.lng ?? 0).toFixed(6)}, ${Number(pose.lat ?? 0).toFixed(6)}, ${Number(pose.alt ?? 0).toFixed(1)}m`;
});
const virtualFlightKeyHint = computed(() => {
    const last = lastVirtualKey.value ? ` · 最近 ${virtualKeyLabels[lastVirtualKey.value] || lastVirtualKey.value}` : '';
    return `${virtualKeyHint.value}${last}`;
});
const previewPanelTitle = computed(() => (activePreviewMode.value === 'virtual' ? '虚拟飞行预览' : '云台/姿态预览'));

onMounted(() => {
    isMounted.value = true;
    focusEditorRoot();
    attachVirtualFlightListeners();
});

const onEditorPointerDown = (event) => {
    const target = event?.target;
    if (!(target instanceof Element)) return;
    if (target.closest('input, textarea, select, [contenteditable="true"], .ant-input, .ant-input-number-input, .ant-select-selection-search-input, .ant-picker-input input')) {
        return;
    }
    focusEditorRoot();
};

const focusEditorRoot = () => {
    editorRootRef.value?.focus?.();
};

const attachVirtualFlightListeners = () => {
    window.addEventListener('keydown', handleVirtualKeyDown, { passive: false });
    window.addEventListener('keyup', handleVirtualKeyUp, { passive: false });
    window.addEventListener('blur', clearVirtualKeyState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
};

const detachVirtualFlightListeners = () => {
    window.removeEventListener('keydown', handleVirtualKeyDown);
    window.removeEventListener('keyup', handleVirtualKeyUp);
    window.removeEventListener('blur', clearVirtualKeyState);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
};

// 传送门动态目标
const mapTarget = computed(() => isPreviewSwapped.value ? '#side-view-host' : '#main-view-host');
const cameraTarget = computed(() => isPreviewSwapped.value ? '#main-view-host' : '#side-view-host');

// 云台监控状态
const currentGimbalPitch = ref(-45);
const currentAircraftYaw = ref(0);
const currentZoomFactor = ref(2.0);
const zoomRatio = computed(() => (activePreviewZoomFactor.value).toFixed(1));
const setPreviewZoomFactor = (value) => {
    const next = clamp(Number(value ?? 1), 1, 112);
    if (activePreviewMode.value === 'virtual') {
        virtualZoomFactor.value = next;
    } else {
        currentZoomFactor.value = next;
    }
};

// 视图切换 (大小窗互换) 逻辑
const isPreviewSwapped = ref(false);
const isSettingTakeoffPoint = ref(false);
const toggleViewSwap = () => {
    isPreviewSwapped.value = !isPreviewSwapped.value;
};

// 视图状态文案 (用于解决模板内换行导致的字符串解析错误)
const fpvStatusText = computed(() => isPreviewSwapped.value ? '视图已切换至主屏' : '准备就绪');
const fpvModeSubText = computed(() => isPreviewSwapped.value ? 'FPV MODE ACTIVE' : 'WAITING FOR DATA');

// 高度标注计算属性 (对齐司空标准)
const hudHeightMetrics = computed(() => {
    if (selectedWpIndex.value === -1) return [];
    const wp = waypoints.value[selectedWpIndex.value];
    if (!wp) return [];

    const mode = missionConfig.value.executeHeightMode;
    const h = wp.height || 0;
    const takeoffHeight = missionConfig.value.takeOffPointHeight || 0;
    const pick = (val) => val.toFixed(1);

    if (mode === 'WGS84') {
        const asl = h;
        return [
            { label: '海拔高度 (ASL)', value: pick(asl), color: 'text-green-400' },
            { label: '海拔高度 (HAE)', value: pick(asl), color: 'text-blue-400' }
        ];
    } else if (mode === 'realTimeFollowSurface') {
        const agl = h;
        const asl = h + takeoffHeight;
        return [
            { label: '海拔高度 (ASL)', value: pick(asl), color: 'text-green-400' },
            { label: '离地高度 (AGL)', value: pick(agl), color: 'text-blue-400' }
        ];
    } else {
        // relativeToStartPoint
        const alt = h;
        return [
            { label: '相对高度 (ALT)', value: pick(alt), color: 'text-blue-400' }
        ];
    }
});

// 监听选点变化，若关闭详情则重置交换状态
watch(selectedWpIndex, (newIdx) => {
    if (newIdx === -1) {
        isPreviewSwapped.value = false;
    }
});

// 变焦标尺交互逻辑
const isDraggingZoom = ref(false);
const handleZoomInteraction = (e) => {
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    // 标尺区域在中心，需要排除文字边距的影响，这里近似计算
    const padding = 20; // 这里的上下边距
    const innerHeight = rect.height - padding * 2;
    let y = e.clientY - (rect.top + padding);

    let percent = 1 - (y / innerHeight);
    percent = Math.max(0, Math.min(1, percent));

    const maxLog = Math.log2(112);
    const zoom = Math.pow(2, percent * maxLog);
    setPreviewZoomFactor(parseFloat(zoom.toFixed(1)));
};

const handleZoomClick = (e) => {
    handleZoomInteraction(e);
};

const handleZoomDrag = (e) => {
    if (isDraggingZoom.value) {
        handleZoomInteraction(e);
    }
};

const currentDronePos = computed(() => {
    if (selectedWpIndex.value === -1) return null;
    const wp = waypoints.value[selectedWpIndex.value];
    if (!wp) return null;
    return {
        lng: wp.lng,
        lat: wp.lat,
        alt: wp.height,
        terrainHeight: wp.terrainHeight,
        isRelative: missionConfig.value.executeHeightMode !== 'WGS84',
        executeHeightMode: missionConfig.value.executeHeightMode
    };
});

const activePreviewMode = computed(() => (
    virtualFlightEnabled.value && previewFocusMode.value === 'virtual'
        ? 'virtual'
        : (selectedWpIndex.value !== -1
            ? 'waypoint'
            : (virtualFlightEnabled.value ? 'virtual' : 'idle'))
));
const activePreviewDronePos = computed(() => (
    activePreviewMode.value === 'virtual'
        ? virtualDronePos.value
        : currentDronePos.value
));
const activePreviewGimbalPitch = computed(() => (
    activePreviewMode.value === 'virtual'
        ? virtualGimbalPitch.value
        : currentGimbalPitch.value
));
const activePreviewAircraftYaw = computed(() => (
    activePreviewMode.value === 'virtual'
        ? virtualAircraftYaw.value
        : currentAircraftYaw.value
));
const activePreviewZoomFactor = computed(() => (
    activePreviewMode.value === 'virtual'
        ? virtualZoomFactor.value
        : currentZoomFactor.value
));

const getVirtualFlightFallbackPose = () => {
    const lastWp = waypoints.value[waypoints.value.length - 1];
    const takeoffLng = missionConfig.value.takeOffPointLng ?? lastWp?.lng ?? 0;
    const takeoffLat = missionConfig.value.takeOffPointLat ?? lastWp?.lat ?? 0;
    const takeoffHeight = missionConfig.value.takeOffPointHeight ?? lastWp?.height ?? missionConfig.value.globalHeight ?? 0;
    return {
        lng: takeoffLng,
        lat: takeoffLat,
        alt: takeoffHeight,
        terrainHeight: missionConfig.value.takeOffPointHeight ?? 0,
        heading: 0,
        pitch: -45,
        zoomFactor: 2.0
    };
};

const getLastWaypointSeed = () => {
    if (!waypoints.value.length) return null;
    const wp = waypoints.value[waypoints.value.length - 1];
    if (!wp) return null;
    return {
        lng: wp.lng,
        lat: wp.lat,
        alt: wp.height,
        terrainHeight: wp.terrainHeight ?? 0,
        heading: currentAircraftYaw.value,
        pitch: currentGimbalPitch.value,
        zoomFactor: currentZoomFactor.value
    };
};

const getMapSeed = () => {
    try {
        const pose = props.getMapPose?.();
        if (!pose) return null;
        const position = pose.position || pose;
        const groundHeight = Number(pose.groundHeight ?? position.terrainHeight ?? 0);
        const defaultFlightHeight = Number(missionConfig.value.takeOffPointHeight || missionConfig.value.globalHeight || 70);
        return {
            lng: position.lng ?? position.lon ?? 0,
            lat: position.lat ?? 0,
            alt: groundHeight + defaultFlightHeight,
            terrainHeight: groundHeight,
            heading: pose.heading ?? 0,
            pitch: pose.pitch ?? -45,
            zoomFactor: pose.zoomFactor ?? 2.0
        };
    } catch (error) {
        console.warn('Failed to read map pose for virtual flight seed.', error);
        return null;
    }
};

const syncVirtualFlightState = (seed) => {
    const pose = seed || getLastWaypointSeed() || getMapSeed() || getVirtualFlightFallbackPose();
    virtualDronePos.value = {
        lng: Number(pose.lng ?? 0),
        lat: Number(pose.lat ?? 0),
        alt: Number(pose.alt ?? 0),
        terrainHeight: Number(pose.terrainHeight ?? 0),
        isRelative: missionConfig.value.executeHeightMode !== 'WGS84',
        executeHeightMode: missionConfig.value.executeHeightMode
    };
    virtualAircraftYaw.value = normalizeDegrees(Number(pose.heading ?? 0));
    virtualGimbalPitch.value = clamp(Number(pose.pitch ?? -45), -90, 30);
    virtualZoomFactor.value = clamp(Number(pose.zoomFactor ?? 2.0), 1, 112);
};

const emitVirtualFlightState = (forceClear = false) => {
    if (forceClear || !virtualFlightEnabled.value || !virtualDronePos.value) {
        emit('virtual-flight-update', null);
        if (previewFocusMode.value === 'virtual') {
            emit('fov-update', null);
        }
        return;
    }

    const payload = {
        active: true,
        dronePos: virtualDronePos.value,
        gimbalAtt: { pitch: virtualGimbalPitch.value, yaw: virtualAircraftYaw.value },
        focalLength: virtualZoomFactor.value * 24
    };

    emit('virtual-flight-update', payload);
};

const ensureVirtualFlightSeeded = (force = false) => {
    if (force) {
        syncVirtualFlightState();
        virtualFlightInitialized.value = true;
        return;
    }

    if (!virtualFlightInitialized.value) {
        syncVirtualFlightState();
        virtualFlightInitialized.value = true;
    }
};

const isEditableTarget = (target) => {
    if (!(target instanceof Element)) return false;
    if (target.isContentEditable) return true;
    return Boolean(target.closest(
        'input, textarea, select, [contenteditable="true"], .ant-input, .ant-input-number-input, .ant-select-selection-search-input, .ant-picker-input input'
    ));
};

const isVirtualFlightKey = (code) => Boolean(virtualKeyLabels[code]);

const addVirtualKey = (code) => {
    if (activeVirtualKeys.value.includes(code)) return;
    activeVirtualKeys.value = [...activeVirtualKeys.value, code];
};

const removeVirtualKey = (code) => {
    if (!activeVirtualKeys.value.includes(code)) return;
    activeVirtualKeys.value = activeVirtualKeys.value.filter(item => item !== code);
};

const stopVirtualFlightLoop = () => {
    if (virtualFlightRafId.value) {
        cancelAnimationFrame(virtualFlightRafId.value);
    }
    virtualFlightRafId.value = 0;
    virtualFlightLastTs.value = 0;
};

const applyVirtualFlightDelta = (deltaSeconds) => {
    if (!virtualDronePos.value) {
        syncVirtualFlightState();
    }
    if (!virtualDronePos.value) return;

    const hasW = activeVirtualKeys.value.includes('KeyW');
    const hasA = activeVirtualKeys.value.includes('KeyA');
    const hasS = activeVirtualKeys.value.includes('KeyS');
    const hasD = activeVirtualKeys.value.includes('KeyD');
    const hasQ = activeVirtualKeys.value.includes('KeyQ');
    const hasE = activeVirtualKeys.value.includes('KeyE');
    const hasC = activeVirtualKeys.value.includes('KeyC');
    const hasZ = activeVirtualKeys.value.includes('KeyZ');

    const yawDelta = ((hasE ? 1 : 0) - (hasQ ? 1 : 0)) * 120 * deltaSeconds;
    if (yawDelta) {
        virtualAircraftYaw.value = normalizeDegrees(virtualAircraftYaw.value + yawDelta);
    }

    const climbDelta = ((hasC ? 1 : 0) - (hasZ ? 1 : 0)) * 8 * deltaSeconds;
    let positionChanged = false;
    if (climbDelta) {
        virtualDronePos.value = {
            ...virtualDronePos.value,
            alt: Math.max(0, Number(virtualDronePos.value.alt ?? 0) + climbDelta)
        };
        positionChanged = true;
    }

    const forward = (hasW ? 1 : 0) - (hasS ? 1 : 0);
    const right = (hasD ? 1 : 0) - (hasA ? 1 : 0);
    if (!forward && !right) {
        emitVirtualFlightState();
        return;
    }

    const headingRad = (virtualAircraftYaw.value * Math.PI) / 180;
    const north = (forward * Math.cos(headingRad)) - (right * Math.sin(headingRad));
    const east = (forward * Math.sin(headingRad)) + (right * Math.cos(headingRad));
    const distanceMeters = Math.hypot(north, east) * 18 * deltaSeconds;
    if (!distanceMeters) {
        emitVirtualFlightState();
        return;
    }

    const bearing = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
    const nextPoint = turf.destination(
        turf.point([Number(virtualDronePos.value.lng ?? 0), Number(virtualDronePos.value.lat ?? 0)]),
        distanceMeters / 1000,
        bearing,
        { units: 'kilometers' }
    );
    const [nextLng, nextLat] = nextPoint.geometry.coordinates;
    virtualDronePos.value = {
        ...virtualDronePos.value,
        lng: nextLng,
        lat: nextLat
    };
    positionChanged = true;
    if (positionChanged) {
        emitVirtualFlightState();
    }
};

const ensureVirtualFlightLoop = () => {
    if (virtualFlightRafId.value) return;
    const tick = (ts) => {
        if (!virtualFlightEnabled.value || !activeVirtualKeys.value.length) {
            stopVirtualFlightLoop();
            return;
        }
        const lastTs = virtualFlightLastTs.value || ts;
        const deltaSeconds = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
        virtualFlightLastTs.value = ts;
        if (deltaSeconds > 0) {
            applyVirtualFlightDelta(deltaSeconds);
        }
        virtualFlightRafId.value = requestAnimationFrame(tick);
    };
    virtualFlightRafId.value = requestAnimationFrame(tick);
};

const clearVirtualKeyState = () => {
    activeVirtualKeys.value = [];
    stopVirtualFlightLoop();
};

const handleVisibilityChange = () => {
    if (document.hidden) {
        clearVirtualKeyState();
    }
};

const handleVirtualKeyDown = (event) => {
    if (!isVirtualFlightKey(event.code) || isEditableTarget(event.target)) return;
    event.preventDefault();
    lastVirtualKey.value = event.code;
    if (!virtualFlightEnabled.value) {
        virtualFlightEnabled.value = true;
        ensureVirtualFlightSeeded(true);
        previewFocusMode.value = 'virtual';
    } else {
        ensureVirtualFlightSeeded();
    }
    addVirtualKey(event.code);
    applyVirtualFlightDelta(1 / 60);
    ensureVirtualFlightLoop();
};

const handleVirtualKeyUp = (event) => {
    if (!isVirtualFlightKey(event.code)) return;
    event.preventDefault();
    removeVirtualKey(event.code);
    if (!activeVirtualKeys.value.length) {
        stopVirtualFlightLoop();
    }
};

const toggleVirtualFlight = () => {
    virtualFlightEnabled.value = !virtualFlightEnabled.value;
    if (virtualFlightEnabled.value) {
        ensureVirtualFlightSeeded(true);
        previewFocusMode.value = 'virtual';
        ensureVirtualFlightLoop();
        focusEditorRoot();
        emitVirtualFlightState();
        return;
    }
    clearVirtualKeyState();
    emitVirtualFlightState(true);
};

watch(activePreviewMode, (mode, prevMode) => {
    if (mode === 'virtual') {
        if (prevMode !== 'virtual') {
            emit('fov-update', null);
            emitVirtualFlightState();
        }
        return;
    }

    if (prevMode === 'virtual') {
        emit('virtual-flight-update', null);
    }
}, { immediate: true });

// 核心同步逻辑：将编辑器内部所有状态变更同步到 index.vue 的单例地图 (防抖处理，降低高频交互开销)
let updateTimer = null;
watch([waypoints, missionConfig, selectedWpIndex, activePreviewDronePos, activePreviewGimbalPitch, activePreviewAircraftYaw, activePreviewZoomFactor, isPreviewSwapped], () => {
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
        emit('update:mission-data', {
            waypoints: waypoints.value,
            config: missionConfig.value,
            selectedWpIndex: selectedWpIndex.value,
            mapLayout: isPreviewSwapped.value ? 'inset' : 'fullscreen',
            previewMode: activePreviewMode.value,
            fovData: activePreviewMode.value !== 'idle' ? {
                dronePos: activePreviewDronePos.value,
                gimbalAtt: { pitch: activePreviewGimbalPitch.value, yaw: activePreviewAircraftYaw.value },
                focalLength: activePreviewZoomFactor.value * 24,
                previewMode: activePreviewMode.value
            } : null
        });
    }, 50); // 50ms 延迟足以过滤滑动过程中的冗余更新，同时保持操作跟手
}, { deep: true, immediate: true });

const stats = computed(() => {
    if (waypoints.value.length < 2) return { distance: 0, time: 0 };
    try {
        const coords = waypoints.value.map(wp => [wp.lng, wp.lat]);
        const line = turf.lineString(coords);
        const distanceKm = turf.length(line, { units: 'kilometers' });
        const distanceM = distanceKm * 1000;
        return {
            distance: distanceM,
            time: distanceM / (missionConfig.value.globalSpeed || 5)
        };
    } catch (e) {
        console.error('Turf calculation error:', e);
        return { distance: 0, time: 0 };
    }
});

const onMapClick = (coords) => {
    if (isSettingTakeoffPoint.value) {
        missionConfig.value.takeOffPointLat = coords.lat;
        missionConfig.value.takeOffPointLng = coords.lng;
        missionConfig.value.takeOffPointHeight = coords.terrainHeight;
        isSettingTakeoffPoint.value = false;
        return;
    }
    const previousWaypoint = waypoints.value[waypoints.value.length - 1];
    waypoints.value = [...waypoints.value, buildWaypointAt(coords, previousWaypoint)];
    handleSelectWaypoint(waypoints.value.length - 1);
};

const buildWaypointAt = (coords, previousWaypoint = null) => {
    if (previousWaypoint) {
        return {
            ...JSON.parse(JSON.stringify(previousWaypoint)),
            lat: coords.lat,
            lng: coords.lng,
            terrainHeight: coords.terrainHeight || 0
        };
    }

    let defaultHeight = missionConfig.value.globalHeight || 50;
    if (missionConfig.value.executeHeightMode === 'WGS84') {
        defaultHeight += (coords.terrainHeight || 0);
    }
    return {
        lat: coords.lat,
        lng: coords.lng,
        height: Math.round(defaultHeight),
        speed: missionConfig.value.globalSpeed || 5,
        terrainHeight: coords.terrainHeight || 0,
        isForbiddenRth: false,
        actions: [
            { type: ACTION_TYPE.GIMBAL_PITCH, params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.GIMBAL_PITCH] } },
            { type: ACTION_TYPE.AIRCRAFT_YAW, params: { ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.AIRCRAFT_YAW] } }
        ]
    };
};

const updateWaypoint = (index, data) => {
    const newWps = [...waypoints.value];
    newWps[index] = data;
    waypoints.value = newWps;
};

const handleInsertWaypoint = (data) => {
    const { type, lat, lng } = data;
    const insertionIndex = type === 'add-before'
        ? selectedWpIndex.value
        : (type === 'add-after' ? selectedWpIndex.value + 1 : waypoints.value.length);
    const previousWaypoint = insertionIndex > 0 ? waypoints.value[insertionIndex - 1] : null;
    const newWp = buildWaypointAt({ lat, lng, terrainHeight: data.terrainHeight }, previousWaypoint);
    if (type === 'add-after' && selectedWpIndex.value !== -1) {
        waypoints.value.splice(selectedWpIndex.value + 1, 0, newWp);
        handleSelectWaypoint(selectedWpIndex.value + 1);
    } else if (type === 'add-before' && selectedWpIndex.value !== -1) {
        waypoints.value.splice(selectedWpIndex.value, 0, newWp);
        handleSelectWaypoint(selectedWpIndex.value);
    } else {
        waypoints.value.push(newWp);
        handleSelectWaypoint(waypoints.value.length - 1);
    }
};

const handleWaypointMove = ({ index, lat, lng, terrainHeight }) => {
    const waypoint = waypoints.value[index];
    if (!waypoint || index !== selectedWpIndex.value) return;
    updateWaypoint(index, {
        ...waypoint,
        lat,
        lng,
        terrainHeight: terrainHeight || 0
    });
};

const buildWaypointFromVirtualFlight = () => {
    if (!virtualDronePos.value) return null;

    const yaw = normalizeDegrees(Number(virtualAircraftYaw.value ?? 0));
    const pitch = clamp(Number(virtualGimbalPitch.value ?? -45), -90, 30);
    const zoomFactor = clamp(Number(virtualZoomFactor.value ?? 1), 1, 112);
    const terrainHeight = Number(virtualDronePos.value.terrainHeight ?? 0);

    return {
        lat: Number(virtualDronePos.value.lat ?? 0),
        lng: Number(virtualDronePos.value.lng ?? 0),
        height: Math.round(Number(virtualDronePos.value.alt ?? 0)),
        speed: missionConfig.value.globalSpeed || 5,
        terrainHeight,
        isForbiddenRth: false,
        actions: [
            {
                type: ACTION_TYPE.GIMBAL_PITCH,
                params: {
                    ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.GIMBAL_PITCH],
                    gimbalPitchRotateAngle: Math.round(pitch)
                }
            },
            {
                type: ACTION_TYPE.AIRCRAFT_YAW,
                params: {
                    ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.AIRCRAFT_YAW],
                    aircraftYawAngle: Math.round(yaw)
                }
            },
            {
                type: ACTION_TYPE.ZOOM,
                params: {
                    ...DEFAULT_ACTION_PARAMS[ACTION_TYPE.ZOOM],
                    zoomFactor: Number(zoomFactor.toFixed(1))
                }
            }
        ]
    };
};

const handleAddWaypointFromVirtualFlight = () => {
    if (!virtualFlightEnabled.value || !virtualDronePos.value) return;

    const newWp = buildWaypointFromVirtualFlight();
    if (!newWp) return;

    waypoints.value = [...waypoints.value, newWp];
    handleSelectWaypoint(waypoints.value.length - 1);
};

const handleSelectWaypoint = (index) => {
    selectedWpIndex.value = index;
    selectedActionIndex.value = -1;
    previewFocusMode.value = 'waypoint';

    if (index !== -1 && waypoints.value[index]) {
        emit('focus-waypoint', { index, waypoint: waypoints.value[index] });
    }

    // 自动回显选中航点的姿态参数到预览窗口 (俯仰弧/偏航/变焦)
    if (index !== -1 && waypoints.value[index]) {
        const wp = waypoints.value[index];
        if (wp.actions && wp.actions.length > 0) {
            wp.actions.forEach(action => {
                if (action.type === ACTION_TYPE.GIMBAL_PITCH) {
                    currentGimbalPitch.value = action.params.gimbalPitchRotateAngle ?? -45;
                } else if (action.type === ACTION_TYPE.AIRCRAFT_YAW) {
                    currentAircraftYaw.value = action.params.aircraftYawAngle ?? 0;
                } else if (action.type === ACTION_TYPE.ZOOM) {
                    currentZoomFactor.value = action.params.zoomFactor ?? 1.0;
                }
            });
        }
    }
};

const handleSelectAction = (data) => {
    const { wpIndex, actionIndex } = data;
    selectedWpIndex.value = wpIndex;
    selectedActionIndex.value = actionIndex;
    previewFocusMode.value = 'waypoint';
    const action = waypoints.value[wpIndex].actions[actionIndex];
    handlePreviewActionRaw(action);
};

const handleAddAction = (data) => {
    const { wpIndex, type } = data;
    const wp = waypoints.value[wpIndex];
    if (!wp) return;
    previewFocusMode.value = 'waypoint';
    const newAction = {
        type,
        params: { ...DEFAULT_ACTION_PARAMS[type] }
    };
    wp.actions.push(newAction);
    updateWaypoint(wpIndex, wp);
    selectedActionIndex.value = wp.actions.length - 1;
};

const handleRemoveAction = (data) => {
    const { wpIndex, actionIndex } = data;
    const wp = waypoints.value[wpIndex];
    if (!wp) return;
    wp.actions.splice(actionIndex, 1);
    updateWaypoint(wpIndex, wp);
    selectedActionIndex.value = -1;
};

const handlePreviewActionRaw = (action) => {
    if (!action || !action.params) return;
    if (action.type === 'gimbalPitch') {
        currentGimbalPitch.value = action.params.gimbalPitchRotateAngle ?? -90;
    } else if (action.type === 'aircraftYaw') {
        currentAircraftYaw.value = action.params.aircraftYawAngle ?? 0;
    } else if (action.type === 'zoom') {
        currentZoomFactor.value = action.params.zoomFactor ?? 2.0;
    }
};

const handleFlyTo = (coords) => {
    if (mapViewerRef.value) mapViewerRef.value.flyTo(coords);
};

const removeWaypoint = (index) => {
    waypoints.value.splice(index, 1);
    if (selectedWpIndex.value === index) selectedWpIndex.value = -1;
    else if (selectedWpIndex.value > index) selectedWpIndex.value--;
};

const clearWaypoints = () => { waypoints.value = []; selectedWpIndex.value = -1; };
const reverseWaypoints = () => { waypoints.value.reverse(); selectedWpIndex.value = -1; };

const saveMission = () => {
    emit('save', {
        config: { ...missionConfig.value },
        waypoints: [...waypoints.value]
    });
};

const downloadKMZ = async () => {
    try {
        const updatedAt = Date.now();
        const blob = await generateKMZ({
            ...missionConfig.value,
            routeType: 'waypoint'
        }, waypoints.value, null);
        downloadWaylineBlob(blob, missionConfig.value.missionName);

        emit('generate-result', {
            ...buildLocalWaylineResult({
                missionName: missionConfig.value.missionName,
                missionId: props.initialMission?.id,
                updatedAt
            })
        });
    } catch (error) {
        console.error('Failed to generate KMZ', error);
        emit('generate-error', {
            missionName: missionConfig.value.missionName,
            missionId: props.initialMission?.id,
            message: error?.message || '生成 KMZ 失败'
        });
    }
};

const downloadJSON = () => {
    const missionName = missionConfig.value.missionName || props.initialMission?.name || 'wayline';
    downloadWaylineJson({
        ...(props.initialMission || {}),
        id: props.initialMission?.id,
        name: missionName,
        coordinateSystem: 'WGS84',
        config: {
            ...missionConfig.value,
            missionName,
            routeType: 'waypoint'
        },
        waypoints: waypoints.value,
        updatedAt: Date.now()
    }, missionName);
};

defineExpose({
    onMapClick, handleInsertWaypoint, handleWaypointMove, applyPose: (index, pose) => {
        if (pose) handleRecordPoseInternal(index, pose);
    }
});

const handleRecordPoseInternal = (index, pose) => {
    const wp = JSON.parse(JSON.stringify(waypoints.value[index]));
    if (!wp) return;
    if (!wp.actions) wp.actions = [];

    const pitchAction = {
        type: 'gimbalPitch',
        params: { gimbalPitchRotateAngle: Math.round(pose.pitch), gimbalPitchRotateEnable: 1, payloadPositionIndex: 0 }
    };
    const yawAction = {
        type: 'aircraftYaw',
        params: { aircraftYawAngle: Math.round(pose.heading >= 360 ? pose.heading - 360 : pose.heading), aircraftRotateDirection: 0 }
    };

    const pIdx = wp.actions.findIndex(a => a.type === 'gimbalPitch');
    if (pIdx > -1) wp.actions[pIdx] = pitchAction; else wp.actions.push(pitchAction);

    const yIdx = wp.actions.findIndex(a => a.type === 'aircraftYaw');
    if (yIdx > -1) wp.actions[yIdx] = yawAction; else wp.actions.push(yawAction);

    updateWaypoint(index, wp);
};

const handleRecordPose = (index) => {
    emit('record-pose', index);
};

watch([activePreviewMode, activePreviewDronePos, activePreviewGimbalPitch, activePreviewAircraftYaw, activePreviewZoomFactor], () => {
    if (activePreviewMode.value === 'virtual') {
        return;
    }
    if (activePreviewMode.value !== 'idle' && activePreviewDronePos.value) {
        emit('fov-update', {
            dronePos: activePreviewDronePos.value,
            gimbalAtt: { pitch: activePreviewGimbalPitch.value, yaw: activePreviewAircraftYaw.value },
            focalLength: activePreviewZoomFactor.value * 24,
            previewMode: activePreviewMode.value
        });
    } else {
        emit('fov-update', null);
    }
}, { immediate: true });

onBeforeUnmount(() => {
    detachVirtualFlightListeners();
    clearVirtualKeyState();
    if (updateTimer) {
        clearTimeout(updateTimer);
        updateTimer = null;
    }
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #b8c2cf;
    border: 2px solid #f1f5f9;
    border-radius: 999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #8f9baa;
}

.custom-scrollbar {
    scrollbar-color: #b8c2cf #f1f5f9;
    scrollbar-width: thin;
}

.dji-tabs {
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.dji-tabs :deep(.ant-tabs-nav) {
    flex: none;
}

.dji-tabs :deep(.ant-tabs-content-holder) {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.dji-tabs :deep(.ant-tabs-content),
.dji-tabs :deep(.ant-tabs-tabpane) {
    height: 100%;
    min-height: 0;
}

.dji-tabs :deep(.ant-tabs-nav) {
    margin-bottom: 0;
    padding: 0 16px;
    background: #f8f9fa;
    border-bottom: 1px solid #eee;
}

.dji-tabs :deep(.ant-tabs-tab) {
    padding: 12px 0;
    font-size: 13px;
    font-weight: 600;
}

/* 自定义滑动条样式 */
:deep(.zoom-slider-custom) {
    padding: 4px 0;
}

:deep(.zoom-slider-custom .ant-slider-track) {
    background-color: #3b82f6 !important;
    height: 4px !important;
}

:deep(.zoom-slider-custom .ant-slider-rail) {
    height: 4px !important;
    background-color: #e5e7eb !important;
}

:deep(.zoom-slider-custom .ant-slider-handle) {
    width: 16px !important;
    height: 16px !important;
    margin-top: -6px !important;
    border: 2px solid #3b82f6 !important;
    background-color: #fff !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
}

:deep(.zoom-slider-custom .ant-slider-handle:hover),
:deep(.zoom-slider-custom .ant-slider-handle:focus) {
    border-color: #2563eb !important;
    transform: scale(1.1);
}
</style>
