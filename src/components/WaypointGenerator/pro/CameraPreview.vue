<template>
    <div class="camera-preview-wrapper w-full h-full bg-black relative">
        <vc-viewer @ready="onViewerReady" :animation="false" :timeline="false" :base-layer-picker="false"
            :fullscreen-button="false" :scene-mode-picker="false" :info-box="false" :selection-indicator="false"
            :navigation-help-button="false" :scene3d-only="true" class="absolute inset-0">
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

    // 每帧渲染后更新测距
    viewer.scene.postRender.addEventListener(updateCenterDistance);

    setTimeout(() => {
        if (viewer && !viewer.isDestroyed()) {
            viewer.resize();
            updateCamera();
        }
    }, 200);
};

// 实时测距核心逻辑：射线探测
const updateCenterDistance = () => {
    if (!viewerInstance.value || !cesiumInstance.value) return;
    const viewer = viewerInstance.value;
    const Cesium = cesiumInstance.value;

    // 获取屏幕中心点在 3D 空间中的射线
    const center = new Cesium.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2);
    const ray = viewer.camera.getPickRay(center);

    // 探测与地形的交点
    const position = viewer.scene.globe.pick(ray, viewer.scene);

    if (Cesium.defined(position)) {
        // 计算相机当前位置到交点的距离
        const distance = Cesium.Cartesian3.distance(viewer.camera.position, position);
        groundDistance.value = distance;
        emit('update:distance', distance);
    } else {
        groundDistance.value = 0;
        emit('update:distance', 0);
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
    viewer.scene.requestRender();
};

// 深度监听属性变化
watch(() => [props.dronePos, props.gimbalPitch, props.aircraftYaw, props.zoomFactor], () => {
    updateCamera();
}, { deep: true, flush: 'sync' });

onBeforeUnmount(() => {
    if (viewerInstance.value && !viewerInstance.value.isDestroyed()) {
        viewerInstance.value.scene.postRender.removeEventListener(updateCenterDistance);
        viewerInstance.value.destroy();
    }
});
</script>

<style scoped>
.camera-preview-wrapper :deep(.cesium-viewer-bottom) {
    display: none !important;
}
</style>
