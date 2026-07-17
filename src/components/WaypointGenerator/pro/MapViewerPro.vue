<template>
  <div class="relative w-full h-full">
    <vc-viewer @ready="onViewerReadyInternal" :camera="camera" @left-click="onMapClick" :animation="false"
      :timeline="false" :base-layer-picker="false" :fullscreen-button="false" :scene-mode-picker="false"
      :info-box="false" :selection-indicator="false" class="absolute inset-0">
      <vc-navigation></vc-navigation>
      <vc-compass-sm :auto-hidden="false" position="bottom" :offset="[200, 20]"></vc-compass-sm>
      <vc-zoom-control-sm position="bottom" :offset="[0, 50]"></vc-zoom-control-sm>

      <template v-if="cesiumInstance">
        <!-- Enhanced 3D Waypoints with Measurement HUD -->
        <template v-if="waypoints.length > 0">
          <template v-for="(wp, index) in enhancedWaypoints" :key="'wp-group-' + index">
            <!-- 1. Vertical Dash Line -->
            <vc-entity>
              <vc-graphics-polyline :positions="[wp.cartesian, wp.groundCartesian]" :material="measurementLineMaterial"
                :width="1.0" />
            </vc-entity>

            <!-- 2. Dual-Height HUD Label (Dynamic Mode) -->
            <vc-entity :position="wp.cartesian">
              <vc-graphics-label :text="getWpLabelText(wp)" :font="'bold 11px monospace'" :fillColor="'white'"
                :outlineColor="'black'" :outlineWidth="1" :showBackground="true" :backgroundColor="'rgba(0,0,0,0.75)'"
                :pixelOffset="[15, 20]" :horizontalOrigin="0" :verticalOrigin="0" :backgroundPadding="[5, 3]" />
            </vc-entity>

            <!-- 3. Waypoint Icon/Aircraft -->
            <vc-entity :position="wp.cartesian">
              <vc-graphics-point v-if="selectedWpIndex !== index" :pixelSize="routeType === 'waypoint' ? 10 : 8"
                :color="routeType === 'waypoint' ? 'rgba(0, 242, 255, 0.9)' : 'rgba(52, 152, 219, 0.8)'"
                :outlineColor="'white'" :outlineWidth="2"></vc-graphics-point>
              <vc-graphics-billboard v-else :image="PLANE_SVG" :scale="0.6" :rotation="selectedWpYawRad"
                :alignedAxis="cesiumInstance.Cartesian3.UNIT_Z" :color="'#00f2ff'"></vc-graphics-billboard>
              <vc-graphics-label v-if="routeType === 'waypoint'" :text="(index + 1).toString()"
                :font="'bold 14px sans-serif'" :pixelOffset="[0, -25]" :fillColor="'white'" :outlineColor="'black'"
                :outlineWidth="2" :showBackground="true" :backgroundColor="'rgba(0, 242, 255, 0.8)'"
                :backgroundPadding="[4, 4]"></vc-graphics-label>
            </vc-entity>

            <!-- 4. Ground Intersection Point -->
            <vc-entity :position="wp.groundCartesian">
              <vc-graphics-point :pixelSize="4" :color="'rgba(241, 196, 15, 0.6)'" />
            </vc-entity>
          </template>
        </template>

        <!-- Path / Coverage rendering -->
        <vc-entity v-if="routeType === 'waypoint' && waypointPositions.length > 1">
          <vc-graphics-polyline :positions="waypointPositions" :material="'#00f2ff'" :width="3"
            :clampToGround="false"></vc-graphics-polyline>
        </vc-entity>
        <vc-entity v-if="scanPathPositions.length > 1">
          <vc-graphics-polyline :positions="scanPathPositions" :material="routeType === 'strip' ? '#2ecc71' : '#f1c40f'"
            :width="routeType === 'strip' ? 4 : 5" :clampToGround="true"></vc-graphics-polyline>
        </vc-entity>
        <vc-entity v-if="coverageAreaPositions.length > 2">
          <vc-graphics-polygon :hierarchy="coverageAreaPositions" :material="'rgba(46, 204, 113, 0.25)'" :outline="true"
            :outlineColor="'#27ae60'"></vc-graphics-polygon>
        </vc-entity>

        <!-- Pro FOV Volumes (Wide - Yellow) -->
        <template v-if="wideFovData.frustum && fovDronePosition">
          <!-- 1. Geometric Side Walls -->
          <template v-for="(p, i) in wideFovData.rawPoints" :key="'wide-side-' + i">
            <vc-entity :disableDepthTestDistance="Number.POSITIVE_INFINITY">
              <vc-graphics-polygon
                :hierarchy="[fovDronePosition, p, wideFovData.rawPoints[(i + 1) % wideFovData.rawPoints.length]]"
                :material="'rgba(255, 255, 0, 0.08)'" :perPositionHeight="true" />
              <!-- Connector Ribs -->
              <vc-graphics-polyline :positions="[fovDronePosition, p]" :material="'rgba(255, 255, 0, 0.4)'"
                :width="1.0" />
            </vc-entity>
          </template>
          <!-- 2. Ground Border (Entity-based for stability) -->
          <vc-entity v-if="wideFovData.points.length > 0">
            <vc-graphics-polyline :positions="wideFovData.points" :clampToGround="true"
              :material="wideFovData.lineAttributes.color.value" :width="1.5" />
          </vc-entity>

          <!-- 3. Ground Fill (Entity-based for stability) -->
          <vc-entity v-if="wideFovData.points.length > 0">
            <vc-graphics-polygon :hierarchy="wideFovData.points"
              :material="wideFovData.appearance.material.uniforms.color" :heightReference="1" />
          </vc-entity>
        </template>

        <!-- Pro FOV Volumes (Zoom - Green) -->
        <template v-if="zoomFovData.frustum && fovDronePosition">
          <!-- 1. Geometric Side Walls -->
          <template v-for="(p, i) in zoomFovData.rawPoints" :key="'zoom-side-' + i">
            <vc-entity :disableDepthTestDistance="Number.POSITIVE_INFINITY">
              <vc-graphics-polygon
                :hierarchy="[fovDronePosition, p, zoomFovData.rawPoints[(i + 1) % zoomFovData.rawPoints.length]]"
                :material="'rgba(0, 255, 0, 0.15)'" :perPositionHeight="true" />
              <!-- Connector Ribs -->
              <vc-graphics-polyline :positions="[fovDronePosition, p]" :material="'rgba(0, 255, 0, 0.8)'"
                :width="1.5" />
            </vc-entity>
          </template>
          <!-- 2. Ground Border (Entity-based) -->
          <vc-entity v-if="zoomFovData.points.length > 0">
            <vc-graphics-polyline :positions="zoomFovData.points" :clampToGround="true"
              :material="zoomFovData.lineAttributes.color.value" :width="2.5" />
          </vc-entity>

          <!-- 3. Ground Fill (Entity-based) -->
          <vc-entity v-if="zoomFovData.points.length > 0">
            <vc-graphics-polygon :hierarchy="zoomFovData.points"
              :material="zoomFovData.appearance.material.uniforms.color" :heightReference="1" />
          </vc-entity>
        </template>

        <!-- Viewshed -->
        <vc-analyses>
          <vc-analysis-viewshed v-if="zoomFovData.params" :viewPosition="zoomFovData.params.position"
            :horizontalAngle="zoomFovData.params.hfov" :verticalAngle="zoomFovData.params.vfov"
            :distance="zoomFovData.params.distance" :heading="zoomFovData.params.heading"
            :pitch="zoomFovData.params.pitch" visibleAreaColor="rgba(0, 255, 0, 0.4)"
            hiddenAreaColor="rgba(0, 0, 0, 0)" />
        </vc-analyses>

        <!-- Center Metrics (Active FOV Only) -->
        <template v-if="selectedWpIndex !== -1 && fovCenterPoint && fovDronePosition">
          <vc-entity>
            <vc-graphics-polyline :positions="[fovDronePosition, fovCenterPoint]" :material="centerLineMaterial"
              :width="1.8" :zIndex="10" />
          </vc-entity>
        </template>

        <!-- Takeoff Reference Point Marker -->
        <vc-entity v-if="takeoffPoint && takeoffPoint.lat && takeoffPoint.lng"
          :position="[takeoffPoint.lng, takeoffPoint.lat, (takeoffPoint.height || 0)]">
          <vc-graphics-billboard :image="HOME_SVG" :scale="0.32" :horizontalOrigin="0" :verticalOrigin="1"
            :disableDepthTestDistance="Number.POSITIVE_INFINITY" />
          <vc-graphics-label text="起飞点" :font="'bold 10px sans-serif'" :pixelOffset="[0, -32]" :fillColor="'white'"
            :outlineColor="'#1890ff'" :outlineWidth="2" :showBackground="true"
            :backgroundColor="'rgba(24, 144, 255, 0.8)'" :backgroundPadding="[3, 2]" />
        </vc-entity>
      </template>
    </vc-viewer>

    <!-- Status Bar -->
    <div @mousemove.stop
      class="absolute bottom-0 left-0 right-0 h-7 bg-[#0a0a0ae6] backdrop-blur-md flex items-center justify-between px-6 text-[10px] text-gray-400 font-mono z-20 select-none border-t border-white/5">
      <div class="flex gap-6 items-center">
        <div class="flex gap-2 items-center"><span
            class="text-gray-600 font-bold uppercase scale-75 origin-left">纬度</span><span>{{ hoverPos.lat.toFixed(8)
            }}°</span></div>
        <div class="flex gap-2 items-center border-l border-gray-800 pl-6"><span
            class="text-gray-600 font-bold uppercase scale-75 origin-left">经度</span><span>{{ hoverPos.lng.toFixed(8)
            }}°</span></div>
      </div>
      <div class="flex gap-6 items-center">
        <div class="flex gap-2 items-center"><span class="text-gray-600 scale-75 origin-right font-bold">海拔</span><span
            class="text-green-400 font-black">{{ hoverPos.asl.toFixed(1) }}m</span></div>
        <div class="flex gap-2 items-center border-l border-gray-800 pl-6"><span
            class="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span><span
            class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">WGS84</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, markRaw, onBeforeUnmount, onMounted, ref } from 'vue';
import { ACTION_TYPE } from '../../../types/waypointRoute.js';
import { calculateCenterPoint, calculateFOVProjection, calculateFovFromFocalLength } from '../../../utils/fovCalculator';

// 1. 授权前置：确保在任何 Cesium 组件初始化前 Token 已就绪
const ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyZWRkYjY5MC1kOTAwLTQwMmYtYmUyYi0yM2JlNjU5YjVkYTAiLCJpZCI6MTY1MzMxLCJpYXQiOjE2OTQxNzY5Nzh9.MGD5_U2P3_spf9VQlJTFm3elXcVRI0zzC-v9VKTA7c4';

const PLANE_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNjQiIGhlaWdodD0iNjQiPjxwYXRoIGZpbGw9IiNmZmZmZmYiIGQ9Ik00NDggMzM2di00MEwyODggMTkyVjcyYTQwIDQwIDAgMSAwLTY0IDB2MTIwTDY0IDI5NnY0MGwxNjAtNDh2MTEybC00OCAyNHY0MGw4OC0xNiA4OCAxNnYtNDBsLTQ4LTI0VjI4OGwxNjAgNDh6Ii8+PC9zdmc+';
const HOME_SVG = `data:image/svg+xml;base64,${btoa(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#1890ff" stroke="white" stroke-width="5" /><path d="M50 20 L35 40 H65 Z" fill="white" /><text x="50" y="80" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle">H</text></svg>`)}`;

const props = defineProps({
  waypoints: { type: Array, default: () => [] },
  isClosedLoop: Boolean,
  isPatrolMode: Boolean,
  scanPath: { type: Array, default: () => [] },
  coverageArea: { type: Array, default: () => [] },
  cuttingSegments: { type: Array, default: () => [] },
  routeType: { type: String, default: 'waypoint' },
  selectedWpIndex: { type: Number, default: -1 },
  takeoffPoint: { type: Object, default: null },
  executeHeightMode: { type: String, default: 'relativeToStartPoint' }
});

const emit = defineEmits(['map-click', 'fly-to', 'context-menu', 'insert-waypoint', 'update:takeoffHeight']);

const cesiumInstance = ref(null);
const viewerInstance = ref(null);
const eventHandler = ref(null);
const hoverPos = ref({ lat: 0, lng: 0, asl: 0 });

onMounted(() => {
  // Ensure Cesium Ion token is set before any Cesium components initialize
  if (window.Cesium) {
    window.Cesium.Ion.defaultAccessToken = ION_TOKEN;
  }
});

const selectedWpYawRad = computed(() => {
  if (props.selectedWpIndex === -1 || !props.waypoints[props.selectedWpIndex]) return 0;
  const yawAction = props.waypoints[props.selectedWpIndex].actions?.find(a => a.type === ACTION_TYPE.AIRCRAFT_YAW || a.type === 'aircraftYaw');
  return -((yawAction?.params?.aircraftYawAngle || 0) * Math.PI) / 180;
});

const enhancedWaypoints = computed(() => {
  if (!cesiumInstance.value || !viewerInstance.value || !viewerInstance.value.scene) return [];
  const Cesium = cesiumInstance.value;
  const viewer = viewerInstance.value;

  return props.waypoints.map((wp, index) => {
    const isRel = props.executeHeightMode === 'relativeToStartPoint';
    const isAGL = props.executeHeightMode === 'realTimeFollowSurface';

    const carto = Cesium.Cartographic.fromDegrees(wp.lng, wp.lat);
    const groundHeight = (wp.terrainHeight !== undefined && wp.terrainHeight !== null) ? Number(wp.terrainHeight) : (viewer.scene.globe?.getHeight(carto) || 0);
    const safeGroundHeight = isNaN(groundHeight) ? 0 : groundHeight;

    let takeoffGroundHeight = Number(props.takeoffPoint?.height || 0);
    if (isRel && takeoffGroundHeight === 0 && props.waypoints.length > 0) {
      const firstWp = props.waypoints[0];
      const firstCarto = Cesium.Cartographic.fromDegrees(Number(firstWp.lng), Number(firstWp.lat));
      takeoffGroundHeight = (firstWp.terrainHeight !== undefined && firstWp.terrainHeight !== null) ? Number(firstWp.terrainHeight) : (viewer.scene.globe?.getHeight(firstCarto) || safeGroundHeight);
    }

    // 计算绝对海拔 (ASL)
    let absAlt = Number(wp.height) || 0;
    if (isRel) {
      absAlt += takeoffGroundHeight;
    } else if (isAGL) {
      absAlt += safeGroundHeight;
    }

    // 防御性检查：确保 alt 是有效数字，防止 Cesium 内部 crash (Invalid array length)
    const safeAlt = isNaN(absAlt) ? 0 : absAlt;

    const cartesian = Cesium.Cartesian3.fromDegrees(wp.lng, wp.lat, safeAlt);
    const groundCartesian = Cesium.Cartesian3.fromDegrees(wp.lng, wp.lat, safeGroundHeight);

    return {
      ...wp,
      cartesian,
      groundCartesian,
      asl: Math.round(safeAlt),
      alt: Math.round(Number(wp.height) || 0),
      agl: Math.round(safeAlt - safeGroundHeight),
      hae: Math.round(safeAlt) // 司空参考中 海拔模式下 ASL 和 HAE 通常指向绝对高度
    };
  });
});

const getWpLabelText = (wp) => {
  if (props.executeHeightMode === 'WGS84') {
    return `ASL: ${wp.asl} m\nHAE: ${wp.hae} m`;
  } else if (props.executeHeightMode === 'realTimeFollowSurface') {
    return `AGL: ${wp.agl} m\nASL: ${wp.asl} m`;
  } else {
    return `ALT: ${wp.alt} m`;
  }
};

const waypointPositions = computed(() => {
  return enhancedWaypoints.value.map(wp => wp.cartesian);
});

const takeoffCartesian = computed(() => {
  if (!cesiumInstance.value || !props.takeoffPoint?.lat || !props.takeoffPoint?.lng) return null;
  return cesiumInstance.value.Cartesian3.fromDegrees(props.takeoffPoint.lng, props.takeoffPoint.lat, props.takeoffPoint.height || 0);
});

const scanPathPositions = computed(() => props.scanPath.map(wp => ({ lng: wp.lng, lat: wp.lat, height: 0 })));
const coverageAreaPositions = computed(() => props.coverageArea.map(p => ({ lng: p.lng, lat: p.lat, height: 0 })));

const onViewerReadyInternal = ({ Cesium, viewer }) => {
  cesiumInstance.value = markRaw(Cesium);
  viewerInstance.value = markRaw(viewer);
  Cesium.Ion.defaultAccessToken = ION_TOKEN;
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
    url: 'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    minimumLevel: 3, maximumLevel: 18
  }));
  viewer.scene.globe.depthTestAgainstTerrain = false;

  // 强化地形加载容错
  Cesium.createWorldTerrainAsync().then(tp => {
    viewer.terrainProvider = tp;
    // 地形加载后，如果已有起飞点，尝试更新一下地表高度
    if (props.takeoffPoint?.lng) {
      updateTakeoffGroundHeight();
    }
  }).catch(err => {
    console.warn('⚠️ Cesium Ion 地形加载失败 (502/401)，正在切换为全球椭球体地形...', err);
    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  });

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  eventHandler.value = markRaw(handler);
  handler.setInputAction((m) => {
    if (!viewerInstance.value || !viewerInstance.value.scene) return;
    const cartesian = viewerInstance.value.camera.pickEllipsoid(m.endPosition, viewerInstance.value.scene.globe.ellipsoid);
    if (!cartesian) return;
    const carto = viewerInstance.value.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
    hoverPos.value = {
      lat: Cesium.Math.toDegrees(carto.latitude),
      lng: Cesium.Math.toDegrees(carto.longitude),
      asl: viewerInstance.value.scene.globe.getHeight(carto) || 0
    };
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
};

onBeforeUnmount(() => {
  if (eventHandler.value) {
    eventHandler.value.destroy();
    eventHandler.value = null;
  }
  viewerInstance.value = null;
  cesiumInstance.value = null;
});

const onMapClick = (e) => {
  if (!viewerInstance.value || !viewerInstance.value.scene) return;
  const ray = viewerInstance.value.camera.getPickRay(e.position || e.windowPosition);
  const cartesian = viewerInstance.value.scene.globe?.pick(ray, viewerInstance.value.scene);
  if (!cartesian) return;
  const carto = cesiumInstance.value.Cartographic.fromCartesian(cartesian);
  const lat = cesiumInstance.value.Math.toDegrees(carto.latitude);
  const lng = cesiumInstance.value.Math.toDegrees(carto.longitude);

  cesiumInstance.value.sampleTerrainMostDetailed(viewerInstance.value.terrainProvider, [carto]).then(samples => {
    const terrainHeight = samples[0]?.height || 0;

    // 如果当前还没有起飞点，点击地图时除了发射坐标，还应该尝试采样地表高度作为起飞点基准
    if (!props.takeoffPoint || (props.takeoffPoint.lng === 0 && props.takeoffPoint.lat === 0)) {
      emit('update:takeoffHeight', Math.round(terrainHeight));
    }

    emit('map-click', { lat, lng, terrainHeight: Math.round(terrainHeight) });
  }).catch(() => {
    const terrainHeight = viewerInstance.value.scene.globe.getHeight(carto) || 0;
    if (!props.takeoffPoint || (props.takeoffPoint.lng === 0 && props.takeoffPoint.lat === 0)) {
      emit('update:takeoffHeight', Math.round(terrainHeight));
    }
    emit('map-click', { lat, lng, terrainHeight: Math.round(terrainHeight) });
  });
};

const updateTakeoffGroundHeight = () => {
  if (!viewerInstance.value || !viewerInstance.value.scene || !props.takeoffPoint?.lng) return;
  const carto = cesiumInstance.value.Cartographic.fromDegrees(props.takeoffPoint.lng, props.takeoffPoint.lat);
  // 异步采样更精确的高度
  cesiumInstance.value.sampleTerrainMostDetailed(viewerInstance.value.terrainProvider, [carto]).then(samples => {
    if (samples[0] && samples[0].height !== undefined) {
      emit('update:takeoffHeight', Math.round(samples[0].height));
    }
  }).catch(err => {
    console.warn('⚠️ 采样地面高度失败:', err);
  });
};

const camera = ref({ position: { lng: 104.39, lat: 31.09, height: 1000 }, heading: 0, pitch: -90, roll: 0 });
const wideFovData = ref({ points: [], rawPoints: [], frustum: null, orientation: null, modelMatrix: null, appearance: null, lineAppearance: null, lineAttributes: null, params: null, altitude: 0 });
const zoomFovData = ref({ points: [], rawPoints: [], frustum: null, orientation: null, modelMatrix: null, appearance: null, lineAppearance: null, lineAttributes: null, params: null, altitude: 0 });
const fovDronePosition = ref(null);
const centerLineMaterial = ref(null);
const measurementLineMaterial = ref(null);
const centerPointRaw = ref(null);

const groundAslValue = computed(() => {
  if (!centerPointRaw.value || !cesiumInstance.value || !viewerInstance.value || !viewerInstance.value.scene) return 0;
  return viewerInstance.value.scene.globe?.getHeight(cesiumInstance.value.Cartographic.fromDegrees(centerPointRaw.value.lng, centerPointRaw.value.lat)) || 0;
});
const relHeightValue = computed(() => {
  if (!zoomFovData.value.params) return 0;
  return Math.round(zoomFovData.value.params.position.height - groundAslValue.value);
});
const relHeightLabelPosition = computed(() => {
  if (!fovDronePosition.value || !fovCenterPoint.value || !cesiumInstance.value) return null;
  return cesiumInstance.value.Cartesian3.lerp(fovDronePosition.value, fovCenterPoint.value, 0.5, new cesiumInstance.value.Cartesian3());
});
const fovCenterPoint = computed(() => {
  if (!centerPointRaw.value || !cesiumInstance.value || !viewerInstance.value) return null;
  const cp = centerPointRaw.value;
  return cesiumInstance.value.Cartesian3.fromDegrees(cp.lng, cp.lat, groundAslValue.value);
});

const updateFov = async (dronePos, gimbalAtt, focalLength) => {
  if (!dronePos || !viewerInstance.value || !viewerInstance.value.scene) return;
  const Cesium = cesiumInstance.value;
  const viewer = viewerInstance.value;

    let absAlt = Number(dronePos.alt);
    const executeHeightMode = dronePos.executeHeightMode || props.executeHeightMode;
    const isRel = executeHeightMode === 'relativeToStartPoint';
    const isAGL = executeHeightMode === 'realTimeFollowSurface';

    let groundHeight = 0;
    if (dronePos.terrainHeight !== undefined && dronePos.terrainHeight !== null) {
      groundHeight = Number(dronePos.terrainHeight);
    } else if (dronePos.lng && dronePos.lat) {
      const carto = Cesium.Cartographic.fromDegrees(dronePos.lng, dronePos.lat);
      groundHeight = viewer.scene.globe.getHeight(carto) || 0;
    }

    if (isRel || (dronePos.isRelative && !isAGL)) {
      let takeoffH = Number(props.takeoffPoint?.asl || props.takeoffPoint?.height || 0);

      // Fallback: If takeoff height is missing, use ground height of first point
      if (takeoffH === 0 && props.waypoints && props.waypoints.length > 0) {
        const firstWp = props.waypoints[0];
        const firstCarto = Cesium.Cartographic.fromDegrees(Number(firstWp.lng), Number(firstWp.lat));
        takeoffH = (firstWp.terrainHeight !== undefined && firstWp.terrainHeight !== null) ? Number(firstWp.terrainHeight) : (viewer.scene.globe?.getHeight(firstCarto) || groundHeight);
      }

      // Final fallback to the drone's current ground height to prevent sinking
      if (!takeoffH) {
        takeoffH = groundHeight || 0;
      }

      absAlt += takeoffH;
    } else if (isAGL) {
      absAlt += groundHeight;
    }

  const createFrustum = (focal, color) => {
    const specs = calculateFovFromFocalLength(focal);
    const frustum = new Cesium.PerspectiveFrustum({ fov: Cesium.Math.toRadians(specs.hfov), aspectRatio: specs.hfov / specs.vfov, near: 0.1, far: 1500 });
    const orientation = Cesium.Quaternion.fromHeadingPitchRoll(new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(gimbalAtt.yaw), Cesium.Math.toRadians(gimbalAtt.pitch), 0));
    const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(dronePos.lng, dronePos.lat, absAlt));
    const raw = calculateFOVProjection(dronePos, gimbalAtt, specs);
    return {
      frustum, orientation, modelMatrix,
      points: raw.map(p => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, (viewer.scene.globe?.getHeight(Cesium.Cartographic.fromDegrees(p.lng, p.lat)) || 0) + 0.5)),
      rawPoints: markRaw(raw.map(p => ({ lng: p.lng, lat: p.lat, height: (viewer.scene.globe?.getHeight(Cesium.Cartographic.fromDegrees(p.lng, p.lat)) || 0) + 0.5 }))),
      appearance: markRaw(new Cesium.MaterialAppearance({ material: Cesium.Material.fromType('Color', { color: Cesium.Color.fromCssColorString(color).withAlpha(0.12) }), flat: true, translucent: true })),
      lineAppearance: markRaw(new Cesium.PolylineColorAppearance({ translucent: true })),
      lineAttributes: markRaw({ color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString(color).withAlpha(0.8)) }),
      params: { position: { lng: dronePos.lng, lat: dronePos.lat, height: absAlt }, hfov: specs.hfov, vfov: specs.vfov, heading: gimbalAtt.yaw, pitch: gimbalAtt.pitch, distance: 1200 },
      altitude: dronePos.alt
    };
  };

  wideFovData.value = createFrustum(24, 'yellow');
  zoomFovData.value = createFrustum(focalLength || 24, 'lime');

  fovDronePosition.value = markRaw(Cesium.Cartesian3.fromDegrees(dronePos.lng, dronePos.lat, absAlt));
  centerPointRaw.value = calculateCenterPoint(dronePos, gimbalAtt, 0);
  centerLineMaterial.value = markRaw(new Cesium.PolylineDashMaterialProperty({
    color: Cesium.Color.fromCssColorString('rgba(0, 255, 0, 0.6)'),
    dashLength: 8
  }));
  measurementLineMaterial.value = markRaw(new Cesium.PolylineDashMaterialProperty({
    color: Cesium.Color.fromCssColorString('rgba(241, 196, 15, 0.8)'),
    dashLength: 12
  }));
};

defineExpose({ updateFov });
</script>
