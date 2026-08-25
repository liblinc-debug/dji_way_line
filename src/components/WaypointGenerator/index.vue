<template>
  <div class="w-full h-full overflow-hidden font-sans relative" :class="{ 'ai-map-picking': aiMapSelectionMode }">
    <!-- 统一地图背景层：真正实现单例持久化，消除闪烁 -->
    <div class="absolute inset-0 z-[1] bg-gray-100" :class="mapLayoutClass">
      <MapViewer ref="mapRef" :waypoints="activeMapData.waypoints" :route-type="activeMapData.routeType"
        :execute-height-mode="activeMapData.executeHeightMode"
        :obstacle-avoidance="activeMapData.obstacleAvoidance"
        :is-patrol-mode="false"
        :scan-path="activeMapData.scanPath" :coverage-area="activeMapData.coverageArea"
        :cutting-segments="activeMapData.cuttingSegments" :is-closed-loop="activeMapData.isClosedLoop"
        :selected-wp-index="activeMapData.selectedWpIndex" :takeoff-point="activeMapData.takeoffPoint"
        :active-region-id="activeMapData.activeRegionId"
        :strip-route-mode="activeMapData.stripRouteMode"
        :geometry-config="activeMapData.geometryConfig"
        :slope-config="activeMapData.slopeConfig"
        :left-overlay-offset="activeMapData.leftOverlayOffset"
        :right-overlay-offset="currentView === 'editor' && editingMission ? 360 : 0"
        @update:takeoffHeight="handleTakeoffHeightUpdate" @map-click="onMapClick" @insert-waypoint="onInsertWaypoint"
        @waypoint-move="onWaypointMove"
        @preview-camera-update="handleRoutePreviewCameraUpdate"
        @preview-fov-visibility-update="handleRoutePreviewFovVisibilityUpdate"
        class="h-full w-full" />
    </div>

    <div class="relative z-[10] w-full h-full pointer-events-none">
      <!-- 视图 1: 任务库 (Mission Library) -->
      <div v-if="currentView === 'library'" class="flex h-full w-full">
        <div class="h-full w-[330px] shrink-0 border-r border-gray-200 bg-white shadow-lg pointer-events-auto">
          <MissionLibrary :missions="missions" :selected-id="previewMission?.id" @create="showCreateModal = true"
            @select="handlePreviewMission" @edit="selectMission" @delete="deleteMission" @download="downloadMission"
            @rename="renameMission" @import="importMission"
            class="h-full" />
        </div>
        <!-- 右侧区域透明，显示地图 -->
        <div class="flex-1 h-full"></div>
      </div>

      <!-- 视图 2: 编辑器路由 (Mission Editor Router) -->
      <div v-else class="h-full w-full">
        <!-- 路由到独立的航点编辑器 (3栏布局) -->
        <WaypointEditor v-if="editingMission" ref="editorRef"
          class="pointer-events-none" :key="'wp-editor-' + editingMission.id" :initial-mission="editingMission"
          :get-map-pose="getMapPose"
          @back="handleBackToLibrary" @save="updateAndSaveMission" @update:mission-data="handleMissionUpdate"
          @focus-waypoint="handleFocusWaypoint"
          @record-pose="handleRecordPoseFromEditor" @fov-update="handleFovUpdateFromEditor"
          @virtual-flight-update="handleVirtualFlightUpdateFromEditor"
          @generate-result="handleWaylineGenerated" @generate-error="handleWaylineGenerateError" />

        <!-- 路由到通用的业务编辑器 (2栏布局: 测绘/带状/巡逻) -->
      </div>
    </div>

    <!-- 创建航线模态框 -->
    <CreateMissionModal :visible="showCreateModal" :initial-values="embeddedContext" @cancel="showCreateModal = false"
      @confirm="onMissionCreated" />

    <AIMissionPanel ref="aiPanelRef" :mission="editingMission || previewMission" :map-context="aiMapContext"
      :get-map-center="getMapCenter"
      :drone-context="aiDroneContext" @apply="handleApplyAIPlan"
      @request-map-selection="startAIMapSelection" />

    <MissionCameraPreview v-if="currentView === 'library' && routePreviewFovVisible && previewMission?.waypoints?.length"
      :mission="previewMission" :live-state="routePreviewCameraState" @fov-update="handleFovUpdateFromEditor"
      @focus-waypoint="handleLibraryPreviewWaypoint" />

    <div v-if="aiMapSelectionMode" class="ai-map-pick-banner pointer-events-auto">
      <div>
        <strong>AI 地图选点模式</strong>
        <span>请在地图上单击目标位置，按 Esc 可取消</span>
      </div>
      <button type="button" @click="cancelAIMapSelection">取消选点</button>
    </div>

    <a-modal v-model:open="aiPointDialogVisible" title="地图选点信息" ok-text="使用此位置"
      cancel-text="暂不使用" :confirm-loading="reverseGeocodeLoading" :z-index="13050"
      @ok="confirmAIMapPoint">
      <div class="ai-point-dialog">
        <div class="ai-point-name-row">
          <span class="ai-point-marker">⌖</span>
          <div>
            <small>地点名称</small>
            <strong>{{ reverseGeocodeLoading ? '正在识别地点…' : selectedMapPoint?.name || '地点名称暂不可用' }}</strong>
            <p v-if="selectedMapPoint?.displayName && selectedMapPoint.displayName !== selectedMapPoint.name">
              {{ selectedMapPoint.displayName }}
            </p>
          </div>
        </div>
        <dl>
          <div><dt>经度</dt><dd>{{ formatCoordinate(selectedMapPoint?.lng) }}</dd></div>
          <div><dt>纬度</dt><dd>{{ formatCoordinate(selectedMapPoint?.lat) }}</dd></div>
          <div><dt>地面高程</dt><dd>{{ Number(selectedMapPoint?.alt || 0).toFixed(0) }} m</dd></div>
        </dl>
        <p v-if="reverseGeocodeError" class="ai-point-error">{{ reverseGeocodeError }}；坐标仍可正常用于任务规划。</p>
      </div>
    </a-modal>

  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { generateKMZ } from '../../utils/kmzGenerator';
import { buildLocalWaylineResult, downloadWaylineBlob, downloadWaylineJson, importWaylineFile } from '../../utils/localWaylineFile';
import {
  getAircraftModelMeta,
  getV2CompatibleWaypointExportMeta
} from '../../constants/aircraftModels.js';
import { mergeDerivedRequirements, normalizeRouteLinking } from '../../utils/routeLinking.js';
import { gcj02ToWgs84 } from '../../utils/coordTransform.js';
import { OBSTACLE_AVOIDANCE_DEFAULT } from '../../types/missionConfig.js';
import { getTaskApiBase } from '../../utils/taskApi.js';
import { convertAIPlanToMission } from '../../missionPlanner/adapter.js';
import { reverseGeocodePoint } from '../../services/aiMissionService.js';
import AIMissionPanel from '../aiMission/AIMissionPanel.vue';
import CreateMissionModal from './CreateMissionModal.vue';
import MissionCameraPreview from './MissionCameraPreview.vue';
import WaypointEditor from './editors/WaypointEditor.vue';
import MapViewer from './MapViewer.vue';
import MissionLibrary from './MissionLibrary.vue';

const MISSIONS_STORAGE_KEY = 'missions';
const MISSIONS_GCJ02_BACKUP_KEY = 'missions-gcj02-backup-v1';
const UI_STATE_STORAGE_KEY = 'waypoint-generator-ui-state';
const MISSION_COORDINATE_SYSTEM = 'WGS84';
const apiBase = ref(getTaskApiBase());

const missions = ref([]);
const currentView = ref('library');
const showCreateModal = ref(false);
const editingMission = ref(null);
const previewMission = ref(null);
const routePreviewCameraState = ref(null);
const routePreviewFovVisible = ref(false);
const mapRef = ref(null);
const editorRef = ref(null);
const aiPanelRef = ref(null);
const selectedMapPoint = ref(null);
const aiMapSelectionMode = ref(false);
const aiPointDialogVisible = ref(false);
const reverseGeocodeLoading = ref(false);
const reverseGeocodeError = ref('');
const aircraftInventory = ref([]);
const getMapPose = () => mapRef.value?.getCurrentPose?.() || null;
const getMapCenter = () => getMapPose()?.center || null;
const embeddedContext = ref({});
const BRIDGE_MESSAGE_SOURCE = 'wrj-wayline-bridge';

const isEmbedded = () => window.parent && window.parent !== window;

const postParentMessage = (type, payload = {}) => {
  if (!isEmbedded()) return;
  window.parent.postMessage({ type, payload }, '*');
};

const postBridgeMessage = (action, payload = {}) => {
  if (!isEmbedded()) return;
  window.parent.postMessage({
    source: BRIDGE_MESSAGE_SOURCE,
    action,
    payload
  }, '*');
};

const request = async (path, options = {}) => {
  const response = await fetch(`${apiBase.value}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const responseText = await response.text();
  if (!response.ok) {
    let message = responseText || `HTTP ${response.status}`;
    try {
      const parsed = responseText ? JSON.parse(responseText) : null;
      if (parsed?.error) {
        message = parsed.error;
      }
    } catch (error) {
      // keep original text fallback
    }
    throw new Error(message);
  }

  if (!responseText) return null;
  try {
    return JSON.parse(responseText);
  } catch (error) {
    return responseText;
  }
};

const toBackendTaskRequest = (mission = {}) => {
  const taskId = String(mission.id || Date.now());
  const config = mission.config || {};
  const waypoints = Array.isArray(mission.waypoints) ? mission.waypoints.map((wp = {}, index) => ({
    index: Number.isFinite(Number(wp.index)) ? Number(wp.index) : index,
    lat: Number(wp.lat ?? 0),
    lng: Number(wp.lng ?? 0),
    alt: Number(wp.height ?? wp.alt ?? 0),
    speed: Number(wp.speed ?? 0) || undefined
  })) : [];

  const actions = [];
  for (let wpIndex = 0; wpIndex < (mission.waypoints || []).length; wpIndex += 1) {
    const waypoint = mission.waypoints[wpIndex] || {};
    if (!Array.isArray(waypoint.actions)) continue;
    waypoint.actions.forEach((action, actionIndex) => {
      if (!action) return;
      actions.push({
        id: String(action.id || `${taskId}-${wpIndex}-${actionIndex}`),
        domain: action.domain,
        deviceId: action.deviceId,
        trigger: String(action.trigger || 'waypoint_reached'),
        waypointIndex: Number.isFinite(Number(action.waypointIndex)) ? Number(action.waypointIndex) : wpIndex,
        type: String(action.type || 'unknown'),
        ttlMs: Number.isFinite(Number(action.ttlMs)) ? Number(action.ttlMs) : undefined,
        params: action.params || undefined
      });
    });
  }

  return {
    taskId,
    uavSn: String(config.aircraftModel || config.aircraftSeries || taskId),
    route: {
      coordSystem: 'WGS84',
      waypoints
    },
    actions,
    policies: {
      lostLink: String(config.exitOnRCLost || ''),
      lowBattery: '',
      geoFence: '',
      obstacleAvoidance: {
        ...OBSTACLE_AVOIDANCE_DEFAULT,
        ...(config.obstacleAvoidance || {}),
        enabled: config.useObstacleAvoidance !== false
          && config.obstacleAvoidance?.enabled !== false
      }
    }
  };
};

const syncMissionToBackend = async (mission) => {
  try {
    await request('/waylines', {
      method: 'POST',
      body: JSON.stringify(mission)
    });
  } catch (error) {
    console.warn('Failed to persist wayline definition', error);
    message.error(`航线保存到服务端失败：${error.message}`);
    return false;
  }

  try {
    await request('/tasks', {
      method: 'POST',
      body: JSON.stringify(toBackendTaskRequest(mission))
    });
    return true;
  } catch (error) {
    console.warn('Failed to sync mission to backend', error);
    message.warning(`航线定义已保存，执行任务同步失败：${error.message}`);
  }
  return true;
};

const loadMissionsFromBackend = async () => {
  try {
    const result = await request('/waylines');
    const remote = Array.isArray(result?.items) ? result.items.map(normalizeMission) : [];
    if (!remote.length) return;
    const merged = new Map(missions.value.map(mission => [String(mission.id), mission]));
    remote.forEach((mission) => merged.set(String(mission.id), mission));
    missions.value = [...merged.values()];
    saveMissionsToStorage();
  } catch (error) {
    console.warn('Failed to load waylines from backend', error);
    message.warning(`服务端航线库读取失败，当前显示本地缓存：${error.message}`);
  }
};

const getQueryContext = () => {
  const params = new URLSearchParams(window.location.search || '');
  return {
    mode: params.get('mode') || '',
    missionId: params.get('missionId') || '',
    missionName: params.get('lineName') || params.get('missionName') || '',
    aircraftModel: params.get('deviceModel') || params.get('aircraftModel') || '',
    routeType: params.get('routeType') || ''
  };
};

const applyEmbeddedContext = (payload = {}) => {
  const mode = payload.mode || embeddedContext.value.mode || '';
  const isCreateMode = mode === 'legacy-create';
  if (isEmbedded() && isCreateMode) {
    currentView.value = 'library';
    editingMission.value = null;
    previewMission.value = null;
    showCreateModal.value = false;
  }

  embeddedContext.value = {
    ...embeddedContext.value,
    mode: payload.mode || embeddedContext.value.mode,
    callbackId: payload.callbackId,
    missionId: payload.missionId || embeddedContext.value.missionId,
    missionName: payload.missionName || embeddedContext.value.missionName,
    aircraftModel: payload.aircraftModel || embeddedContext.value.aircraftModel,
    routeType: payload.routeType || embeddedContext.value.routeType
  };

  const patch = Object.fromEntries(
    Object.entries({
      aircraftModel: payload.aircraftModel,
      missionName: payload.missionName,
      routeType: payload.routeType
    }).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  if (editingMission.value && Object.keys(patch).length > 0) {
    const nextConfig = normalizeMissionConfig({
      ...editingMission.value.config,
      ...patch
    });
    editingMission.value = {
      ...editingMission.value,
      id: payload.missionId || editingMission.value.id,
      name: payload.missionName || editingMission.value.name,
      config: nextConfig,
      updatedAt: Date.now()
    };
  }

  if (isEmbedded() && embeddedContext.value.mode === 'legacy-create') {
    createEmbeddedMissionFromContext();
  }
};

const loadEmbeddedEditMission = (mission = null) => {
  if (!mission || typeof mission !== 'object') return;

  const normalizedMission = normalizeMission(JSON.parse(JSON.stringify(mission)));
  embeddedContext.value = {
    ...embeddedContext.value,
    missionId: normalizedMission.id || embeddedContext.value.missionId,
    missionName: normalizedMission.name || normalizedMission.config?.missionName || embeddedContext.value.missionName,
    aircraftModel: normalizedMission.config?.aircraftModel || embeddedContext.value.aircraftModel,
    routeType: normalizedMission.config?.routeType || embeddedContext.value.routeType
  };
  previewMission.value = null;
  editingMission.value = normalizedMission;
  currentView.value = 'editor';
};

const handleIframeMessage = (event) => {
  const data = event?.data;
  if (!data || typeof data !== 'object') return;

  if (data.source === BRIDGE_MESSAGE_SOURCE) {
    if (data.action === 'load-edit-mission') {
      loadEmbeddedEditMission(data.payload?.mission);
    }
    return;
  }

  if (data.type !== 'wayline:init') return;
  applyEmbeddedContext(data.payload || {});
};

const clearUiStateStorage = () => {
  try {
    sessionStorage.removeItem(UI_STATE_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear waypoint editor UI state', error);
  }
};

const saveUiStateToStorage = () => {
  if (isEmbedded()) {
    clearUiStateStorage();
    return;
  }

  try {
    if (currentView.value === 'editor' && editingMission.value) {
      sessionStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify({
        currentView: 'editor',
        editingMission: editingMission.value
      }));
      return;
    }

    sessionStorage.removeItem(UI_STATE_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to save waypoint editor UI state', error);
  }
};

const restoreUiStateFromStorage = () => {
  if (isEmbedded()) {
    clearUiStateStorage();
    return;
  }

  try {
    const saved = sessionStorage.getItem(UI_STATE_STORAGE_KEY);
    if (!saved) return;

    const parsed = JSON.parse(saved);
    if (parsed?.currentView === 'editor' && parsed?.editingMission) {
      editingMission.value = normalizeMission(parsed.editingMission);
      currentView.value = 'editor';
    }
  } catch (error) {
    console.warn('Failed to restore waypoint editor UI state', error);
    sessionStorage.removeItem(UI_STATE_STORAGE_KEY);
  }
};

const usesReferenceWaypointExport = (routeType) => {
  return true;
};

const normalizeMissionConfig = (config = {}) => {
  const normalizedConfig = {
    ...config,
    useObstacleAvoidance: config.useObstacleAvoidance !== false,
    obstacleAvoidance: {
      ...OBSTACLE_AVOIDANCE_DEFAULT,
      ...(config.obstacleAvoidance || {}),
      enabled: config.useObstacleAvoidance !== false
        && config.obstacleAvoidance?.enabled !== false
    }
  };
  const modelMeta = getAircraftModelMeta(normalizedConfig.aircraftModel);
  if (!modelMeta) {
    return {
      ...normalizedConfig,
      routeType: 'waypoint',
      routeLinking: mergeDerivedRequirements({
        ...normalizedConfig,
        routeLinking: normalizeRouteLinking(normalizedConfig)
      })
    };
  }

  const exportMeta = getV2CompatibleWaypointExportMeta(normalizedConfig.aircraftModel);

  return {
    ...normalizedConfig,
    routeType: 'waypoint',
    aircraftSeries: normalizedConfig.aircraftSeries || modelMeta.aircraftSeries,
    routeLinking: mergeDerivedRequirements({
      ...normalizedConfig,
      routeLinking: normalizeRouteLinking(normalizedConfig)
    }),
    ...exportMeta
  };
};

const migratePointToWgs84 = (point) => {
  if (!point || !Number.isFinite(Number(point.lng)) || !Number.isFinite(Number(point.lat))) return point;
  const converted = gcj02ToWgs84(Number(point.lng), Number(point.lat));
  return { ...point, lng: converted.lng, lat: converted.lat };
};

const migratePointCollectionToWgs84 = (items) => {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (Array.isArray(item)) return item.map(migratePointToWgs84);
    if (Array.isArray(item?.points)) return { ...item, points: item.points.map(migratePointToWgs84) };
    return migratePointToWgs84(item);
  });
};

const migrateMissionToWgs84 = (mission = {}) => {
  const sourceConfig = mission.config || {};
  if (sourceConfig.coordinateSystem === MISSION_COORDINATE_SYSTEM) return mission;

  const takeoffLng = Number(sourceConfig.takeOffPointLng);
  const takeoffLat = Number(sourceConfig.takeOffPointLat);
  const convertedTakeoff = Number.isFinite(takeoffLng) && Number.isFinite(takeoffLat)
    ? gcj02ToWgs84(takeoffLng, takeoffLat)
    : null;
  const convertedTakeoffPoint = sourceConfig.takeoffPoint
    ? migratePointToWgs84(sourceConfig.takeoffPoint)
    : sourceConfig.takeoffPoint;

  return {
    ...mission,
    config: {
      ...sourceConfig,
      coordinateSystem: MISSION_COORDINATE_SYSTEM,
      ...(convertedTakeoff ? {
        takeOffPointLng: convertedTakeoff.lng,
        takeOffPointLat: convertedTakeoff.lat
      } : {}),
      ...(convertedTakeoffPoint ? { takeoffPoint: convertedTakeoffPoint } : {})
    },
    waypoints: migratePointCollectionToWgs84(mission.waypoints) || [],
    scanPath: migratePointCollectionToWgs84(mission.scanPath) || [],
    coverageArea: migratePointCollectionToWgs84(mission.coverageArea) || [],
    cuttingSegments: migratePointCollectionToWgs84(mission.cuttingSegments) || []
  };
};

const normalizeMission = (mission = {}) => {
  const migratedMission = migrateMissionToWgs84(mission);
  return {
    ...migratedMission,
    config: normalizeMissionConfig(migratedMission.config || {})
  };
};

// 统一地图数据源：优先使用编辑器数据，兜底使用任务库预览数据
// 使用缓存机制防止每次计算都返回新对象，避免触发 MapViewer 重新初始化
const activeMapDataCache = ref(null);
const activeMapData = computed(() => {
  const m = currentView.value === 'editor' ? editingMission.value : previewMission.value;

  // 默认数据结构
  const defaultData = {
    waypoints: [],
    config: {},
    scanPath: [],
    coverageArea: [],
    cuttingSegments: [],
    routeType: 'waypoint',
    isClosedLoop: false,
    selectedWpIndex: -1,
    executeHeightMode: 'relativeToStartPoint',
    obstacleAvoidance: { ...OBSTACLE_AVOIDANCE_DEFAULT },
    takeoffPoint: { lat: 0, lng: 0, height: 0 },
    activeRegionId: 1,
    leftOverlayOffset: currentView.value === 'editor' ? 420 : 330
  };

  if (!m) {
    // 如果缓存的也是空数据，直接复用，避免创建新对象
    if (activeMapDataCache.value && activeMapDataCache.value.waypoints.length === 0) {
      return activeMapDataCache.value;
    }
    activeMapDataCache.value = defaultData;
    return defaultData;
  }

  const newData = {
    waypoints: m.waypoints || [],
    routeType: m.config?.routeType || 'waypoint',
    scanPath: m.scanPath || [],
    coverageArea: m.coverageArea || [],
    cuttingSegments: m.cuttingSegments || [],
    isClosedLoop: m.config?.isClosedLoop || false,
    selectedWpIndex: m._selectedWpIndex ?? -1,
    executeHeightMode: m.config?.executeHeightMode || 'relativeToStartPoint',
    obstacleAvoidance: {
      ...OBSTACLE_AVOIDANCE_DEFAULT,
      ...(m.config?.obstacleAvoidance || {}),
      enabled: m.config?.useObstacleAvoidance !== false
        && m.config?.obstacleAvoidance?.enabled !== false
    },
    takeoffPoint: m.config?.takeoffPoint || { lat: m.config?.takeOffPointLat, lng: m.config?.takeOffPointLng, height: m.config?.takeOffPointHeight || 0 },
    activeRegionId: 1,
    leftOverlayOffset: currentView.value === 'editor' ? 420 : 330
  };

  // 浅对比：如果关键字段没变，复用旧对象引用
  if (activeMapDataCache.value) {
    const cached = activeMapDataCache.value;
    const sameWaypoints = cached.waypoints === newData.waypoints;
    const sameRouteType = cached.routeType === newData.routeType;
    const sameScanPath = cached.scanPath === newData.scanPath;
    const sameCoverageArea = cached.coverageArea === newData.coverageArea;
    const sameCuttingSegments = cached.cuttingSegments === newData.cuttingSegments;
    const sameClosedLoop = cached.isClosedLoop === newData.isClosedLoop;
    const sameSelectedIndex = cached.selectedWpIndex === newData.selectedWpIndex;
    const sameExecuteHeightMode = cached.executeHeightMode === newData.executeHeightMode;
    const sameObstacleAvoidance = Object.keys(OBSTACLE_AVOIDANCE_DEFAULT).every(
      key => cached.obstacleAvoidance?.[key] === newData.obstacleAvoidance?.[key]
    );
    const sameActiveRegionId = cached.activeRegionId === newData.activeRegionId;
    const sameLeftOverlayOffset = cached.leftOverlayOffset === newData.leftOverlayOffset;
    const sameTakeoffPoint = cached.takeoffPoint?.lat === newData.takeoffPoint?.lat
      && cached.takeoffPoint?.lng === newData.takeoffPoint?.lng
      && cached.takeoffPoint?.height === newData.takeoffPoint?.height;

    if (
      sameWaypoints
      && sameRouteType
      && sameScanPath
      && sameCoverageArea
      && sameCuttingSegments
      && sameClosedLoop
      && sameSelectedIndex
      && sameExecuteHeightMode
      && sameObstacleAvoidance
      && sameActiveRegionId
      && sameLeftOverlayOffset
      && sameTakeoffPoint
    ) {
      return cached;
    }
  }

  activeMapDataCache.value = newData;
  return newData;
});

// 处理布局自适应：在 FPV 预览模式下将地图缩小至挂载位
const mapLayoutClass = computed(() => {
  if (currentView.value === 'editor' && editingMission.value?._mapLayout === 'inset') {
    return 'map-layout-inset';
  }
  return 'map-layout-fullscreen';
});

const handleTakeoffHeightUpdate = (h) => {
  const m = currentView.value === 'editor' ? editingMission.value : previewMission.value;
  if (!m || !m.config) return;

  if (!m.config.takeoffPoint) {
    m.config.takeoffPoint = { lat: null, lng: null, height: 0 };
  }
  m.config.takeoffPoint.height = h;
};

const handleMissionUpdate = (data) => {
  if (editingMission.value) {
    // 使用对象展开确保响应式系统能检测到深层变化
    editingMission.value = {
      ...editingMission.value,
      waypoints: [...data.waypoints],
      config: normalizeMissionConfig({ ...data.config, routeType: 'waypoint' }),
      scanPath: [],
      coverageArea: [],
      cuttingSegments: [],
      _selectedWpIndex: data.selectedWpIndex,
      _mapLayout: data.mapLayout !== undefined ? data.mapLayout : editingMission.value._mapLayout,
      _fovData: data.fovData !== undefined ? data.fovData : editingMission.value._fovData
    };
  }
};

const handleFocusWaypoint = ({ waypoint } = {}) => {
  if (!waypoint || !mapRef.value?.flyTo) return;
  mapRef.value.flyTo(waypoint);
};

const handleLibraryPreviewWaypoint = (waypoint) => {
  if (!waypoint || !mapRef.value?.flyTo) return;
  mapRef.value.flyTo(waypoint);
};

// 监听 FOV 数据变更并转发给 MapViewer 组件
watch(() => editingMission.value?._fovData, (fov) => {
  if (mapRef.value) {
    if (fov) {
      if (mapRef.value.updateFov) mapRef.value.updateFov(fov.dronePos, fov.gimbalAtt, fov.focalLength, fov.previewMode);
    } else {
      if (mapRef.value.clearFov) mapRef.value.clearFov();
    }
  }
}, { deep: true });

// 处理地图点击与事件转发
const formatCoordinate = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(7) : '--';

const startAIMapSelection = () => {
  aiMapSelectionMode.value = true;
  aiPointDialogVisible.value = false;
  message.info('已进入 AI 地图选点模式，请在地图上单击目标位置');
};

const cancelAIMapSelection = () => {
  aiMapSelectionMode.value = false;
  message.info('已取消 AI 地图选点');
};

const resolveSelectedPlace = async (point) => {
  reverseGeocodeLoading.value = true;
  reverseGeocodeError.value = '';
  try {
    const result = await reverseGeocodePoint(point.lat, point.lng);
    selectedMapPoint.value = {
      ...point,
      name: result.name || result.displayName || '',
      displayName: result.displayName || result.name || ''
    };
  } catch (error) {
    reverseGeocodeError.value = `地点名称识别失败：${error.message}`;
    selectedMapPoint.value = { ...point, name: '', displayName: '' };
  } finally {
    reverseGeocodeLoading.value = false;
  }
};

const openAIMapPointDialog = async (e) => {
  const point = { lat: Number(e.lat), lng: Number(e.lng), alt: Number(e.terrainHeight || 0) };
  selectedMapPoint.value = point;
  aiMapSelectionMode.value = false;
  aiPointDialogVisible.value = true;
  await resolveSelectedPlace(point);
};

const confirmAIMapPoint = async () => {
  if (!selectedMapPoint.value || reverseGeocodeLoading.value) return;
  aiPointDialogVisible.value = false;
  await nextTick();
  await aiPanelRef.value?.useSelectedMapPoint?.(selectedMapPoint.value);
};

const handleSelectionKeydown = (event) => {
  if (event.key === 'Escape' && aiMapSelectionMode.value) cancelAIMapSelection();
};

const onMapClick = async (e) => {
  if (aiMapSelectionMode.value) {
    await openAIMapPointDialog(e);
    return;
  }

  selectedMapPoint.value = { lat: e.lat, lng: e.lng, alt: e.terrainHeight || 0 };
  if (currentView.value === 'editor' && editorRef.value) {
    const m = editingMission.value;
    // 自动捕获起飞点逻辑：在任何模式下，如果没有设置起飞点且航点数少于 1，则首个点击点自动作为起飞基准点
    if (m && (!m.waypoints || m.waypoints.length === 0) && !m.config.takeOffPointLat) {
      m.config.takeOffPointLat = e.lat;
      m.config.takeOffPointLng = e.lng;
      m.config.takeOffPointHeight = e.terrainHeight || 0;
      m.config.takeoffPoint = { lat: e.lat, lng: e.lng, height: e.terrainHeight || 0 };
    }

    if (editorRef.value.onMapClick) {
      editorRef.value.onMapClick(e);
    }
    return;
  }

  // In library/preview mode a map click has no editing meaning, so expose the
  // selected coordinate instead of silently swallowing it.
  await openAIMapPointDialog(e);
};

const aiMapContext = computed(() => {
  const mission = editingMission.value || previewMission.value;
  const points = (mission?.waypoints || [])
    .filter(point => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng)))
    .map(point => ({ lat: Number(point.lat), lng: Number(point.lng), alt: Number(point.height || 0) }));
  return {
    ...(selectedMapPoint.value ? { selectedPoint: selectedMapPoint.value } : {}),
    ...(points.length >= 3 ? { polygon: points } : {}),
    ...(points.length >= 2 ? { lineString: points } : {}),
    noFlyZones: mission?.config?.noFlyZones || [],
    pois: mission?.config?.pois || []
  };
});

const aiDroneContext = computed(() => {
  const mission = editingMission.value || previewMission.value;
  const configuredAircraftIds = mission?.config?.aircraftIds || [];
  const aircraft = aircraftInventory.value.find(item => configuredAircraftIds.includes(item.aircraftId))
    || aircraftInventory.value.find(item => item.status === 'online')
    || aircraftInventory.value[0];
  return aircraft ? {
    id: aircraft.aircraftId,
    status: String(aircraft.status || '').toUpperCase(),
    ...(aircraft.location ? { location: aircraft.location } : {}),
    ...(Number.isFinite(Number(aircraft.battery)) ? { battery: Number(aircraft.battery) } : {}),
    ...(aircraft.gpsFix ? { gpsFix: aircraft.gpsFix } : {}),
    ...(aircraft.rtk ? { rtk: aircraft.rtk } : {}),
    ...(Number.isFinite(Number(aircraft.satellites)) ? { satellites: Number(aircraft.satellites) } : {}),
    ...(Number.isFinite(Number(aircraft.signalQuality)) ? { signalQuality: Number(aircraft.signalQuality) } : {}),
    ...(Number.isFinite(Number(aircraft.latencyMs)) ? { latencyMs: Number(aircraft.latencyMs) } : {})
  } : {};
});

const loadAircraftInventory = async () => {
  try {
    const result = await request('/aircrafts');
    aircraftInventory.value = Array.isArray(result?.items) ? result.items : [];
  } catch (error) {
    aircraftInventory.value = [];
  }
};

const handleApplyAIPlan = async (plan) => {
  const sourceMission = editingMission.value || previewMission.value || {
    id: Date.now(),
    name: plan.missionName,
    config: { ...defaultMissionConfig, missionName: plan.missionName },
    waypoints: []
  };
  const converted = normalizeMission(convertAIPlanToMission(plan, JSON.parse(JSON.stringify(sourceMission))));
  previewMission.value = null;
  editingMission.value = converted;
  currentView.value = 'editor';
  await nextTick();
  editorRef.value?.applyMission?.(converted);
};

const onInsertWaypoint = (data) => {
  if (currentView.value === 'editor' && editorRef.value?.handleInsertWaypoint) {
    editorRef.value.handleInsertWaypoint(data);
  }
};

const onWaypointMove = (data) => {
  if (currentView.value === 'editor' && editorRef.value?.handleWaypointMove) {
    editorRef.value.handleWaypointMove(data);
  }
};

const handleRecordPoseFromEditor = (index) => {
  if (mapRef.value && editorRef.value) {
    const pose = mapRef.value.getCurrentPose();
    if (pose) editorRef.value.applyPose(index, pose);
  }
};

const handleFovUpdateFromEditor = (fov) => {
  if (mapRef.value) {
    if (fov) {
      if (mapRef.value.updateFov) mapRef.value.updateFov(fov.dronePos, fov.gimbalAtt, fov.focalLength, fov.previewMode);
    } else {
      if (mapRef.value.clearFov) mapRef.value.clearFov();
    }
  }
};

const handleVirtualFlightUpdateFromEditor = (state) => {
  if (!mapRef.value) return;
  if (state) {
    if (mapRef.value.updateVirtualFlight) {
      mapRef.value.updateVirtualFlight(state.dronePos, state.gimbalAtt, state.focalLength);
    }
  } else if (mapRef.value.clearVirtualFlight) {
    mapRef.value.clearVirtualFlight();
  }
};

// 监听航点变化：自动追踪相机 (兼容旧版直接更新逻辑)
watch(() => activeMapData.value.waypoints, (newWps) => {
  if (currentView.value === 'editor' && newWps?.length > 0) {
    // 编辑器模式下的逻辑：通常由编辑器主动触发 flyTo，这里作为兜底
  }
}, { deep: false });

const handlePreviewMission = (id) => {
  const mission = missions.value.find(m => m.id === id);
  if (mission) {
    routePreviewCameraState.value = null;
    routePreviewFovVisible.value = false;
    previewMission.value = mission;
  }
};

const handleRoutePreviewCameraUpdate = (state) => {
  routePreviewCameraState.value = state?.active ? state : null;
};

const handleRoutePreviewFovVisibilityUpdate = (visible) => {
  routePreviewFovVisible.value = Boolean(visible);
};
const defaultMissionConfig = {
  missionName: '未命名航线',
  coordinateSystem: MISSION_COORDINATE_SYSTEM,
  routeType: 'waypoint',
  aircraftSeries: 'm30',
  aircraftModel: 'm30t',
  droneEnumValue: 67,
  droneSubEnumValue: 0,
  payloadEnumValue: 52,
  payloadSubEnumValue: 0,
  flyToWaylineMode: 'safely',
  finishAction: 'goHome',
  exitOnRCLost: 'executeLostAction',
  executeRCLostAction: 'goBack',
  takeOffSecurityHeight: 70,
  globalSpeed: 5,
  globalHeight: 70,
  globalTransitionalSpeed: 5,
  takeoffSpeed: 5,
  globalYawMode: 'path',
  isClosedLoop: false,
  isReverse: false,
  globalAction: 'none',
  gimbalPitch: -90,
  hoverTime: 0,
  photoInterval: 2,
  shootPhoto: false,
  recordVideo: false,
  executeHeightMode: 'relativeToStartPoint',
  gimbalPitchMode: 'manual',
  climbMode: 'vertical',
  caliFlightEnable: false,
  takeOffPoint: null,
  takeOffPointLat: null,
  takeOffPointLng: null,
  takeOffPointHeight: 0,
  aiPatrol: {
    scanSpacing: 20,
    direction: 0,
    margin: 0,
    enabled: false,
    confidence: 80,
    cameraMode: 'visible',
    gimbalPitchAngle: -45,
    recordEnable: true,
    customTitle: '',
    customText: '检测到异常目标',
    targets: {
      people: true,
      vehicle: false,
      boat: false
    },
    targetRules: {
      people: { operator: '>', value: 1 },
      vehicle: { operator: '>', value: 1 },
      boat: { operator: '>', value: 1 }
    },
    alarmActions: {
      snapshot: true,
      record: true,
      waitControl: false,
      speaker: false,
      searchlight: false
    }
  },
  scanSetting: {
    aiEnabled: false,
    confidence: 80,
    cameraMode: 'visible',
    overlap: 20,
    angle: 0,
    margin: 0
  },
  polygonRoute: {
    collectionType: 'ortho',
    smartOblique: false,
    gsd: 2.0,
    spacingMode: 'auto',
    spacing: 30,
    cameraPreset: 'm4t',
    overlapLateral: 0.7,
    overlapLongitudinal: 0.8,
    angle: 0,
    margin: 0,
    optimizePath: true
  },
  stripRoute: {
    leftExtension: 50,
    rightExtension: 50,
    cuttingDistance: 1000,
    routeMode: 'zigzag',
    overlap: 70,
    overlapLongitudinal: 80,
    angle: 0,
    routeDirection: 'parallel',
    cameraTypes: ['visible'],
    gsdVisible: 5,
    gsdInfrared: 14.06,
    elevationOptimization: true,
    edgeImageOptimization: false,
    includeCenterLine: false,
    photoMode: 'time',
    photoInterval: 2,
    photoDistanceInterval: 10,
    executeHeightMode: 'realTimeFollowSurface',
    realTimeFollowSurface: false,
    regionIds: [1],
    activeRegionId: 1,
    waitingTakeoffReference: false
  },
  slopeRoute: {
    editStage: 'CreateArea',
    inputMode: 'edge',
    surfaceHeight: 40,
    minFlightHeight: 5,
    shootDistance: 30,
    gsdVisible: 1.07,
    gsdInfrared: 3,
    speed: 5.1,
    overlapW: 70,
    overlapH: 80,
    direction: 0,
    flightSide: 'right',
    shootMode: 'time',
    gimbalPitchAngle: 2,
    safeTakeoffHeight: 20,
    takeoffSpeed: 15,
    areaAdjust: {
      surfaceDistance: 0,
      rotateYawDegree: 0,
      rotatePitchDegree: 0
    }
  },
  geometryRoute: {
    createType: 'polygon',
    shootDistance: 50,
    includeTopSurface: true,
    sideFaceFlightSpeed: 5.1,
    topFaceFlightSpeed: 4.1,
    overlapW: 70,
    overlapH: 80,
    overlapRate: 100,
    overlapRotationAngle: 0,
    shootMode: 'time',
    missionStartAt: 'bottom',
    waylineDirection: 'horiz',
    bottomHeight: 30,
    topHeight: 75,
    radius: 30
  },
  routeLinking: {
    autoMatch: true,
    modelCodes: ['m30t'],
    aircraftIds: [],
    requirements: [
      { key: 'supports_gimbal', op: 'eq', value: true }
    ]
  }
};

onMounted(() => {
  applyEmbeddedContext(getQueryContext());

  const saved = localStorage.getItem(MISSIONS_STORAGE_KEY);
  if (saved) {
    try {
      const savedMissions = JSON.parse(saved);
      const needsCoordinateMigration = savedMissions.some(
        mission => mission?.config?.coordinateSystem !== MISSION_COORDINATE_SYSTEM
      );
      if (needsCoordinateMigration && !localStorage.getItem(MISSIONS_GCJ02_BACKUP_KEY)) {
        localStorage.setItem(MISSIONS_GCJ02_BACKUP_KEY, saved);
      }
      missions.value = savedMissions.map(normalizeMission);
      localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(missions.value));
    } catch (e) {
      console.error('Failed to load missions', e);
    }
  }

  restoreUiStateFromStorage();
  window.addEventListener('message', handleIframeMessage);
  window.addEventListener('keydown', handleSelectionKeydown);
  postParentMessage('wayline:ready', { version: '1.0.0' });
  loadMissionsFromBackend();
  loadAircraftInventory();
});

onBeforeUnmount(() => {
  window.removeEventListener('message', handleIframeMessage);
  window.removeEventListener('keydown', handleSelectionKeydown);
});

const saveMissionsToStorage = () => {
  localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(missions.value));
};

watch([currentView, editingMission], () => {
  saveUiStateToStorage();
}, { deep: true });

const handleBackToLibrary = () => {
  if (isEmbedded()) {
    postBridgeMessage('back');
    return;
  }
  mapRef.value?.resetMissionContext?.();
  currentView.value = 'library';
  editingMission.value = null;
  previewMission.value = null;
  routePreviewCameraState.value = null;
  routePreviewFovVisible.value = false;
};

const onMissionCreated = (config) => {
  // 清空预览数据
  previewMission.value = null;

  // 直接创建新任务（不要先清空 editingMission，避免地图闪烁）
  const embeddedPatch = {
    ...(embeddedContext.value.aircraftModel ? { aircraftModel: embeddedContext.value.aircraftModel } : {}),
    ...(embeddedContext.value.missionName ? { missionName: embeddedContext.value.missionName } : {})
  };
  const mergedConfig = {
    ...config,
    ...embeddedPatch,
    routeType: 'waypoint'
  };
  const newMission = {
    id: embeddedContext.value.missionId || Date.now(),
    name: mergedConfig.missionName || '未命名航线',
    config: normalizeMissionConfig({
      ...defaultMissionConfig,
      ...mergedConfig
    }),
    waypoints: [],
    scanPath: [],           // 扫描路径（巡逻/测绘/带状）
    coverageArea: [],       // 覆盖区域（带状）
    cuttingSegments: [],    // 切割段（带状）
    routeStats: null,       // 路径统计
    updatedAt: Date.now()
  };
  editingMission.value = newMission;
  showCreateModal.value = false;
  currentView.value = 'editor';
};

const createEmbeddedMissionFromContext = () => {
  const missionName = embeddedContext.value.missionName || defaultMissionConfig.missionName;
  const aircraftModel = embeddedContext.value.aircraftModel || defaultMissionConfig.aircraftModel;
  const modelMeta = getAircraftModelMeta(aircraftModel);

  onMissionCreated({
    routeType: 'waypoint',
    missionName,
    aircraftModel,
    aircraftSeries: modelMeta?.aircraftSeries || defaultMissionConfig.aircraftSeries
  });
};

const selectMission = (id) => {
  const mission = missions.value.find(m => m.id === id);
  if (mission) {
    mapRef.value?.resetMissionContext?.();
    routePreviewCameraState.value = null;
    routePreviewFovVisible.value = false;
    editingMission.value = normalizeMission(JSON.parse(JSON.stringify(mission))); // 深拷贝防止直接污染列表
    currentView.value = 'editor';
  }
};

const updateAndSaveMission = async (updatedData) => {
  const index = missions.value.findIndex(m => m.id === editingMission.value.id);
  const finalMission = {
    ...editingMission.value,
    config: normalizeMissionConfig(updatedData.config),
    waypoints: updatedData.waypoints,
    routeStats: updatedData.routeStats,
    scanPath: updatedData.scanPath,
    coverageArea: updatedData.coverageArea,
    cuttingSegments: updatedData.cuttingSegments,
    updatedAt: Date.now(),
    name: updatedData.config.missionName || editingMission.value.name
  };

  if (index > -1) {
    missions.value[index] = finalMission;
  } else {
    missions.value.push(finalMission);
  }

  saveMissionsToStorage();
  await syncMissionToBackend(finalMission);
  if (isEmbedded()) {
    postBridgeMessage('save', { mission: finalMission });
    return;
  }
  currentView.value = 'library';
  editingMission.value = null;
};

const handleWaylineGenerated = (result = {}) => {
  const payload = {
    callbackId: embeddedContext.value.callbackId,
    missionId: result.missionId || embeddedContext.value.missionId || editingMission.value?.id,
    missionName: result.missionName || embeddedContext.value.missionName || editingMission.value?.name,
    updatedAt: result.updatedAt || Date.now(),
    storage: 'local'
  };

  postParentMessage('wayline:generated', payload);
};

const handleWaylineGenerateError = (error = {}) => {
  postParentMessage('wayline:error', {
    callbackId: embeddedContext.value.callbackId,
    missionId: error.missionId || embeddedContext.value.missionId || editingMission.value?.id,
    missionName: error.missionName || embeddedContext.value.missionName || editingMission.value?.name,
    message: error.message || '生成 KMZ 失败'
  });
};

const deleteMission = async (id) => {
  if (confirm('确定要删除该航线吗？')) {
    missions.value = missions.value.filter(m => m.id !== id);
    saveMissionsToStorage();
    try {
      await request(`/waylines/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
    } catch (error) {
      console.warn('Failed to delete wayline from backend', error);
      message.warning(`本地航线已删除，但服务端删除失败：${error.message}`);
    }
  }
};

const importMission = async (file) => {
  try {
    const imported = await importWaylineFile(file);
    const importedAt = Date.now();
    const name = String(imported.name || imported.config?.missionName || file.name.replace(/\.(kmz|json)$/i, '') || '导入航线');
    const mission = normalizeMission({
      ...imported,
      id: `${importedAt}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      config: { ...defaultMissionConfig, ...(imported.config || {}), missionName: name },
      waypoints: imported.waypoints || [],
      scanPath: imported.scanPath || [],
      coverageArea: imported.coverageArea || [],
      cuttingSegments: imported.cuttingSegments || [],
      updatedAt: importedAt
    });
    missions.value = [...missions.value, mission];
    previewMission.value = mission;
    saveMissionsToStorage();
    const saved = await syncMissionToBackend(mission);
    if (saved) message.success(`已导入航线“${name}”，共 ${mission.waypoints.length} 个航点`);
  } catch (error) {
    console.error('Failed to import wayline', error);
    message.error(`导入失败：${error.message}`);
  }
};

const renameMission = async ({ id, name }) => {
  const normalizedName = String(name || '').trim();
  const index = missions.value.findIndex(mission => mission.id === id);
  if (index < 0 || !normalizedName) return;

  const current = missions.value[index];
  const updatedMission = {
    ...current,
    name: normalizedName,
    updatedAt: Date.now(),
    config: {
      ...(current.config || {}),
      missionName: normalizedName
    }
  };
  missions.value[index] = updatedMission;
  missions.value = [...missions.value];
  if (previewMission.value?.id === id) previewMission.value = updatedMission;
  saveMissionsToStorage();
  await syncMissionToBackend(updatedMission);
};

const downloadMission = async (payload) => {
  const id = typeof payload === 'object' ? payload?.id : payload;
  const format = typeof payload === 'object' ? payload?.format : 'kmz';
  const mission = missions.value.find(m => m.id === id);
  if (!mission) return;

  try {
    const normalizedMission = {
      ...mission,
      config: normalizeMissionConfig(mission.config),
      coordinateSystem: MISSION_COORDINATE_SYSTEM
    };
    if (format === 'json') {
      downloadWaylineJson(normalizedMission, mission.name);
      return;
    }
    const waypoints = mission.waypoints || [];
    const blob = await generateKMZ(normalizedMission.config, waypoints, null);
    downloadWaylineBlob(blob, mission.name);
  } catch (error) {
    console.error(`Failed to download ${format.toUpperCase()}`, error);
  }
};
</script>

<style>
/* 保持核心样式，删除组件内冗余样式 */
.map-layout-fullscreen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.map-layout-inset {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 335px;
  height: 245px;
  z-index: 50;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 2px;
}

.ai-map-picking canvas {
  cursor: crosshair !important;
}

.ai-map-pick-banner {
  position: fixed;
  top: 18px;
  left: 50%;
  z-index: 13000;
  display: flex;
  align-items: center;
  gap: 18px;
  transform: translateX(-50%);
  border: 1px solid rgba(147, 197, 253, 0.7);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.94);
  box-shadow: 0 16px 46px rgba(15, 23, 42, 0.34);
  padding: 10px 12px 10px 15px;
  color: #fff;
  backdrop-filter: blur(14px);
}

.ai-map-pick-banner div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-map-pick-banner strong {
  color: #93c5fd;
  font-size: 12px;
}

.ai-map-pick-banner span {
  color: #cbd5e1;
  font-size: 10px;
}

.ai-map-pick-banner button {
  border: 1px solid #475569;
  border-radius: 7px;
  background: #1e293b;
  color: #e2e8f0;
  padding: 6px 9px;
  font-size: 10px;
  cursor: pointer;
}

.ai-point-dialog {
  color: #334155;
}

.ai-point-name-row {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #eff6ff;
  padding: 12px;
}

.ai-point-marker {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 9px;
  background: #2563eb;
  color: #fff;
  font-size: 18px;
}

.ai-point-name-row div {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ai-point-name-row small,
.ai-point-dialog dt {
  color: #94a3b8;
  font-size: 10px;
}

.ai-point-name-row strong {
  margin-top: 2px;
  color: #0f172a;
  font-size: 14px;
}

.ai-point-name-row p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 10px;
  line-height: 15px;
}

.ai-point-dialog dl {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 12px 0 0;
}

.ai-point-dialog dl div {
  border-radius: 8px;
  background: #f8fafc;
  padding: 9px;
}

.ai-point-dialog dd {
  margin: 3px 0 0;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
}

.ai-point-error {
  margin: 9px 0 0;
  color: #b45309;
  font-size: 10px;
}
</style>
