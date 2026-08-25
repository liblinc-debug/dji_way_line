<template>
    <div class="camera-preview-wrapper w-full h-full bg-black relative">
        <vc-viewer @ready="onViewerReady" :remove-cesium-script="false" :animation="false" :timeline="false" :base-layer-picker="false"
            :fullscreen-button="false" :scene-mode-picker="false" :info-box="false" :selection-indicator="false"
            :navigation-help-button="false" :scene3d-only="true" :context-options="viewerContextOptions"
            class="absolute inset-0">
        </vc-viewer>
    </div>
</template>

<script setup>
import { markRaw, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
    dronePos: { type: Object, required: true }, // {lng, lat, alt} - 绝对海拔 (ASL)
    gimbalPitch: { type: Number, default: -90 },
    aircraftYaw: { type: Number, default: 0 },
    zoomFactor: { type: Number, default: 1.0 }
});

const cesiumInstance = ref(null);
const viewerInstance = ref(null);
const groundDistance = ref(0);
const viewerContextOptions = markRaw({
    webgl: {
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false
    }
});
const CAMERA_UPDATE_INTERVAL_MS = 1000 / 30;
let cameraUpdateTimer = null;
let lastDistanceUpdateAt = 0;
let lastEmittedDistance = Number.NaN;
const emit = defineEmits(['update:distance']);

const onViewerReady = ({ Cesium, viewer }) => {
    cesiumInstance.value = markRaw(Cesium);
    viewerInstance.value = markRaw(viewer);

    // 极简图层配置
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: 'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        minimumLevel: 1,
        maximumLevel: 18
    }));

    // 地形加载
    Cesium.createWorldTerrainAsync().then(tp => {
        if (viewer.isDestroyed()) return;
        viewer.terrainProvider = tp;
    }).catch(() => {
        if (viewer.isDestroyed()) return;
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    });

    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.shadows = false;

    setTimeout(() => {
        if (viewer && !viewer.isDestroyed()) {
            viewer.resize();
            updateCamera();
        }
    }, 200);
};

// 测距只随相机变化更新，避免在每个 postRender 中触发 Vue 响应式更新。
const updateCenterDistance = (force = false) => {
    if (!viewerInstance.value || !cesiumInstance.value) return;
    const viewer = viewerInstance.value;
    const Cesium = cesiumInstance.value;

    // 获取屏幕中心点在 3D 空间中的射线
    const center = new Cesium.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2);
    const ray = viewer.camera.getPickRay(center);

    // 探测与地形的交点
    const position = viewer.scene.globe.pick(ray, viewer.scene);

    const now = performance.now();
    if (!force && now - lastDistanceUpdateAt < 100) return;
    lastDistanceUpdateAt = now;

    if (Cesium.defined(position)) {
        // 计算相机当前位置到交点的距离
        const distance = Cesium.Cartesian3.distance(viewer.camera.position, position);
        groundDistance.value = distance;
        if (force || !Number.isFinite(lastEmittedDistance) || Math.abs(distance - lastEmittedDistance) >= 0.5) {
            lastEmittedDistance = distance;
            emit('update:distance', distance);
        }
    } else {
        groundDistance.value = 0;
        if (lastEmittedDistance !== 0) {
            lastEmittedDistance = 0;
            emit('update:distance', 0);
        }
    }
};

const updateCamera = () => {
    if (!viewerInstance.value || !cesiumInstance.value) return;
    const Cesium = cesiumInstance.value;
    const viewer = viewerInstance.value;
    const { lng, lat, alt } = props.dronePos;

    const heading = Cesium.Math.toRadians(props.aircraftYaw);
    const pitch = Cesium.Math.toRadians(props.gimbalPitch);

    // 防御性检查：确保坐标是有效数字
    const safeLng = isNaN(lng) ? 0 : lng;
    const safeLat = isNaN(lat) ? 0 : lat;
    const safeAlt = isNaN(alt) ? 0 : alt;

    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(safeLng, safeLat, safeAlt),
        orientation: {
            heading: heading || 0,
            pitch: pitch || 0,
            roll: 0.0
        }
    });

    const hfov = 84 / props.zoomFactor;
    viewer.camera.frustum.fov = Cesium.Math.toRadians(hfov);
    updateCenterDistance();
    viewer.scene.requestRender();
};

const scheduleCameraUpdate = () => {
    if (cameraUpdateTimer) return;
    cameraUpdateTimer = window.setTimeout(() => {
        cameraUpdateTimer = null;
        updateCamera();
    }, CAMERA_UPDATE_INTERVAL_MS);
};

// 深度监听属性变化
watch(() => [props.dronePos, props.gimbalPitch, props.aircraftYaw, props.zoomFactor], () => {
    scheduleCameraUpdate();
}, { deep: true });

onBeforeUnmount(() => {
    if (cameraUpdateTimer) window.clearTimeout(cameraUpdateTimer);
    cameraUpdateTimer = null;
    // vc-viewer owns the Cesium Viewer lifecycle. Destroying it here causes
    // VueCesium to access an already-destroyed scene during its own unmount.
    viewerInstance.value = null;
    cesiumInstance.value = null;
});
</script>

<style scoped>
.camera-preview-wrapper :deep(.cesium-viewer-bottom) {
    display: none !important;
}
</style>
