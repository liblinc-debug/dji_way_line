<template>
  <section v-if="cameraState" class="mission-camera-preview pointer-events-auto">
    <header>
      <div>
        <small>航线相机预览<span v-if="hasLivePreview"> · 实时</span></small>
        <strong v-if="hasLivePreview">模拟飞行 · {{ liveProgressLabel }}</strong>
        <strong v-else>航点 {{ waypointIndex + 1 }} / {{ waypoints.length }}</strong>
      </div>
      <div class="waypoint-switcher">
        <button type="button" title="上一个航点" :disabled="hasLivePreview || waypointIndex <= 0" @click="selectWaypoint(waypointIndex - 1)">‹</button>
        <button type="button" title="下一个航点" :disabled="hasLivePreview || waypointIndex >= waypoints.length - 1" @click="selectWaypoint(waypointIndex + 1)">›</button>
      </div>
    </header>

    <div class="camera-stage">
      <CameraPreview
        :drone-pos="cameraState.dronePos"
        :takeoff-height="Number(mission?.config?.takeOffPointHeight || 0)"
        :gimbal-pitch="cameraState.pitch"
        :aircraft-yaw="cameraState.yaw"
        :zoom-factor="activeZoom"
        @update:distance="groundDistance = $event"
      />

      <div class="lens-switcher">
        <button type="button" :class="{ active: lensMode === 'wide' }" @click="lensMode = 'wide'">广角 1X</button>
        <button type="button" :class="{ active: lensMode === 'zoom' }" @click="lensMode = 'zoom'">
          <span>变焦</span> {{ zoomLabel }}X
        </button>
      </div>

      <div class="camera-crosshair" aria-hidden="true"><i></i><b></b></div>
      <div class="camera-metrics">
        <span v-if="hasLivePreview">进度 {{ liveProgressLabel }}</span>
        <span>俯仰 {{ cameraState.pitch.toFixed(0) }}°</span>
        <span>航向 {{ cameraState.yaw.toFixed(0) }}°</span>
        <span>测距 {{ Number(groundDistance || 0).toFixed(0) }}m</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ACTION_TYPE } from '../../types/waypointRoute.js'
import CameraPreview from './pro/CameraPreview.vue'

const props = defineProps({
  mission: { type: Object, required: true },
  liveState: { type: Object, default: null }
})

const emit = defineEmits(['fov-update', 'focus-waypoint'])
const waypointIndex = ref(0)
const lensMode = ref('wide')
const groundDistance = ref(0)

const waypoints = computed(() => (props.mission?.waypoints || []).filter((point) => (
  Number.isFinite(Number(point?.lng)) && Number.isFinite(Number(point?.lat))
)))

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const hasLivePreview = computed(() => Boolean(props.liveState?.active && props.liveState?.dronePos))
const liveProgressLabel = computed(() => `${clamp(Number(props.liveState?.progress || 0), 0, 100).toFixed(1)}%`)

const cameraState = computed(() => {
  if (hasLivePreview.value) {
    const live = props.liveState
    const pitch = Number(live.gimbalAtt?.pitch ?? -45)
    const yaw = Number(live.gimbalAtt?.yaw ?? 0)
    const zoom = Number(live.zoomFactor ?? (Number(live.focalLength || 24) / 24))
    return {
      dronePos: { ...live.dronePos },
      pitch: clamp(Number.isFinite(pitch) ? pitch : -45, -90, 30),
      yaw: ((Number.isFinite(yaw) ? yaw : 0) % 360 + 360) % 360,
      zoom: clamp(Number.isFinite(zoom) ? zoom : 1, 1, 112)
    }
  }

  const waypoint = waypoints.value[waypointIndex.value]
  if (!waypoint) return null

  let pitch = Number(props.mission?.config?.gimbalPitch ?? -45)
  let yaw = 0
  let zoom = 1
  for (let index = 0; index <= waypointIndex.value; index += 1) {
    for (const action of waypoints.value[index]?.actions || []) {
      const params = action?.params || {}
      if (action.type === ACTION_TYPE.GIMBAL_PITCH) pitch = Number(params.gimbalPitchRotateAngle ?? pitch)
      if (action.type === ACTION_TYPE.AIRCRAFT_YAW) yaw = Number(params.aircraftYawAngle ?? yaw)
      if (action.type === ACTION_TYPE.ZOOM) zoom = Number(params.zoomFactor ?? zoom)
    }
  }

  return {
    dronePos: {
      lng: Number(waypoint.lng),
      lat: Number(waypoint.lat),
      alt: Number(waypoint.height ?? waypoint.alt ?? props.mission?.config?.globalHeight ?? 0),
      terrainHeight: Number(waypoint.terrainHeight || 0),
      isRelative: props.mission?.config?.executeHeightMode !== 'WGS84',
      executeHeightMode: props.mission?.config?.executeHeightMode || 'relativeToStartPoint'
    },
    pitch: clamp(Number.isFinite(pitch) ? pitch : -45, -90, 30),
    yaw: ((Number.isFinite(yaw) ? yaw : 0) % 360 + 360) % 360,
    zoom: clamp(Number.isFinite(zoom) ? zoom : 1, 1, 112)
  }
})

const zoomFactor = computed(() => Math.max(3, Number(cameraState.value?.zoom || 3)))
const activeZoom = computed(() => lensMode.value === 'wide' ? 1 : zoomFactor.value)
const zoomLabel = computed(() => activeZoom.value.toFixed(1))

const selectWaypoint = (index) => {
  waypointIndex.value = clamp(index, 0, Math.max(0, waypoints.value.length - 1))
  const waypoint = waypoints.value[waypointIndex.value]
  if (waypoint) emit('focus-waypoint', waypoint)
}

watch(() => props.mission, () => {
  waypointIndex.value = 0
  lensMode.value = 'wide'
}, { deep: false })

watch([cameraState, activeZoom], ([state]) => {
  if (!state) {
    emit('fov-update', null)
    return
  }
  emit('fov-update', {
    dronePos: state.dronePos,
    gimbalAtt: { pitch: state.pitch, yaw: state.yaw },
    focalLength: activeZoom.value * 24,
    previewMode: 'waypoint'
  })
}, { immediate: true })

onBeforeUnmount(() => emit('fov-update', null))
</script>

<style scoped>
.mission-camera-preview { position:absolute;right:18px;bottom:82px;z-index:11000;width:342px;overflow:hidden;border:1px solid rgba(148,163,184,.35);border-radius:13px;background:rgba(15,23,42,.96);box-shadow:0 20px 55px rgba(15,23,42,.38);color:#fff;backdrop-filter:blur(16px); }
header { height:47px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid rgba(255,255,255,.1); }
header>div:first-child { display:flex;flex-direction:column;gap:1px; }
header small { color:#94a3b8;font-size:9px;letter-spacing:.12em;text-transform:uppercase; }
header strong { font-size:11px; }
.waypoint-switcher { display:flex;gap:5px; }.waypoint-switcher button { width:26px;height:26px;border:1px solid rgba(255,255,255,.15);border-radius:6px;background:rgba(255,255,255,.08);color:#fff;font-size:18px;line-height:20px;cursor:pointer; }.waypoint-switcher button:disabled { opacity:.3;cursor:not-allowed; }
.camera-stage { position:relative;height:205px;overflow:hidden;background:#020617; }
.camera-stage :deep(canvas) { width:100%!important;height:100%!important; }
.lens-switcher { position:absolute;top:9px;left:50%;z-index:3;display:flex;transform:translateX(-50%);overflow:hidden;border:1px solid rgba(255,255,255,.18);border-radius:6px;background:rgba(15,23,42,.8);box-shadow:0 5px 18px rgba(0,0,0,.3); }.lens-switcher button { min-width:88px;border:0;background:transparent;color:#94a3b8;padding:6px 10px;font-size:10px;font-weight:800;cursor:pointer; }.lens-switcher button+button { border-left:1px solid rgba(255,255,255,.12); }.lens-switcher button.active { background:#2563eb;color:#fff; }.lens-switcher span { color:#fb923c; }
.camera-crosshair { position:absolute;left:50%;top:50%;width:28px;height:28px;transform:translate(-50%,-50%);border:1px solid rgba(255,255,255,.6);opacity:.7;pointer-events:none; }.camera-crosshair i,.camera-crosshair b { position:absolute;left:50%;top:50%;display:block;background:rgba(255,255,255,.8);transform:translate(-50%,-50%); }.camera-crosshair i { width:100%;height:1px; }.camera-crosshair b { width:1px;height:100%; }
.camera-metrics { position:absolute;left:9px;right:9px;bottom:8px;z-index:3;display:flex;justify-content:space-between;border:1px solid rgba(255,255,255,.1);border-radius:6px;background:rgba(2,6,23,.7);padding:5px 7px;color:#cbd5e1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8px; }
</style>
