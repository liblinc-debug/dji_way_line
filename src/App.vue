<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AdminConsole from './components/AdminConsole.vue'
import AircraftManagement from './components/AircraftManagement.vue'
import ModelManagement from './components/ModelManagement.vue'
import SystemManagement from './components/SystemManagement.vue'
import WaypointGenerator from './components/WaypointGenerator/index.vue'

const isEmbedded = window.parent && window.parent !== window
const currentView = ref(readViewFromUrl())
const sidebarCollapsed = ref(localStorage.getItem('uav-platform-sidebar-collapsed') === 'true')

const viewMetaMap = {
  admin: {
    eyebrow: 'MISSION OPERATIONS',
    title: '任务运营中心',
    description: '完成任务校验、发布、ACK 追踪与状态回放'
  },
  aircraft: {
    eyebrow: 'AIRCRAFT ASSETS',
    title: '飞机管理',
    description: '维护飞机身份、机型绑定、网络地址与运行状态'
  },
  models: {
    eyebrow: 'MODEL PROFILES',
    title: '机型管理',
    description: '维护机型档案及可复用的任务能力模板'
  },
  system: {
    eyebrow: 'SYSTEM SETTINGS',
    title: '系统管理',
    description: '配置平台 API、MQTT 与 Redpanda 连接'
  },
  planner: {
    eyebrow: 'ROUTE PLANNING',
    title: '航线规划',
    description: '创建、编辑并导出可执行的无人机航点任务'
  }
}

const viewMeta = computed(() => viewMetaMap[currentView.value] || viewMetaMap.planner)

function readViewFromUrl() {
  const view = new URLSearchParams(window.location.search).get('view')
  return ['admin', 'aircraft', 'models', 'system'].includes(view) ? view : 'planner'
}

function switchView(view) {
  if (view === currentView.value) return
  currentView.value = view
  const url = new URL(window.location.href)
  if (view === 'planner') {
    url.searchParams.delete('view')
  } else {
    url.searchParams.set('view', view)
  }
  window.history.pushState({ view }, '', url)
}

function syncViewFromHistory() {
  currentView.value = readViewFromUrl()
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('uav-platform-sidebar-collapsed', String(sidebarCollapsed.value))
}

onMounted(() => window.addEventListener('popstate', syncViewFromHistory))
onBeforeUnmount(() => window.removeEventListener('popstate', syncViewFromHistory))
</script>

<template>
  <component :is="currentView === 'admin' ? AdminConsole : WaypointGenerator" v-if="isEmbedded" />

  <div v-else class="platform-shell">
    <aside :class="['platform-sidebar', { 'is-collapsed': sidebarCollapsed }]">
      <div class="brand-block">
        <div class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M6 10.5 16 5l10 5.5v11L16 27 6 21.5v-11Z" stroke="currentColor" stroke-width="2" />
            <path d="m10 18 6-9 6 9-6 5-6-5Z" fill="currentColor" />
          </svg>
        </div>
        <div>
          <div class="brand-name">UAV TASK</div>
          <div class="brand-subtitle">无人机任务平台</div>
        </div>
      </div>

      <div class="nav-section-label">核心工作台</div>
      <nav class="platform-nav" aria-label="平台主导航">
        <button :class="['platform-nav-item', { active: currentView === 'planner' }]" title="航线规划" @click="switchView('planner')">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5 9 4l6 2.5L20 4v14l-5 2.5L9 18l-5 2V6.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 4v14m6-11.5v14" stroke="currentColor" stroke-width="1.7"/></svg>
          </span>
          <span class="nav-copy">
            <strong>航线规划</strong>
            <small>设计与管理航点任务</small>
          </span>
          <span class="nav-arrow">›</span>
        </button>

        <button :class="['platform-nav-item', { active: currentView === 'admin' }]" title="任务运营中心" @click="switchView('admin')">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none"><path d="M5 19V9m7 10V5m7 14v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3.5 19.5h17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </span>
          <span class="nav-copy">
            <strong>任务运营中心</strong>
            <small>发布、执行与状态回放</small>
          </span>
          <span class="nav-arrow">›</span>
        </button>
      </nav>

      <div class="nav-section-label resource-label">资源管理</div>
      <nav class="platform-nav" aria-label="资源管理导航">
        <button :class="['platform-nav-item', { active: currentView === 'aircraft' }]" title="飞机管理" @click="switchView('aircraft')">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none"><path d="m3.5 13 6-2 2.5-6.5 2.5 6.5 6 2-6 2.2L12 20l-2.5-4.8-6-2.2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 8 5.5 6.5M16 8l2.5-1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          </span>
          <span class="nav-copy">
            <strong>飞机管理</strong>
            <small>资产、机型与运行状态</small>
          </span>
          <span class="nav-arrow">›</span>
        </button>

        <button :class="['platform-nav-item', { active: currentView === 'models' }]" title="机型管理" @click="switchView('models')">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m4.5 8.2 7.5 4.3 7.5-4.3M12 12.5v8" stroke="currentColor" stroke-width="1.7"/></svg>
          </span>
          <span class="nav-copy">
            <strong>机型管理</strong>
            <small>机型档案与能力模板</small>
          </span>
          <span class="nav-arrow">›</span>
        </button>
      </nav>

      <div class="nav-section-label system-label">平台设置</div>
      <nav class="platform-nav" aria-label="系统管理导航">
        <button :class="['platform-nav-item', { active: currentView === 'system' }]" title="系统管理" @click="switchView('system')">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" stroke-width="1.7"/><path d="m19 13.5 1.5 1.2-1.7 3-1.9-.7a7.5 7.5 0 0 1-2.1 1.2l-.3 2h-3.4l-.4-2a7 7 0 0 1-2-1.2l-1.9.7-1.7-3 1.5-1.2a7 7 0 0 1 0-2.5L5.1 9.8l1.7-3 1.9.7a7 7 0 0 1 2-1.2l.4-2h3.4l.3 2a7.5 7.5 0 0 1 2.1 1.2l1.9-.7 1.7 3L19 11a7 7 0 0 1 0 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          </span>
          <span class="nav-copy">
            <strong>系统管理</strong>
            <small>服务连接与中间件配置</small>
          </span>
          <span class="nav-arrow">›</span>
        </button>
      </nav>

      <div class="workflow-card">
        <div class="workflow-title">任务闭环</div>
        <div class="workflow-flow">
          <span>规划</span><i></i><span>发布</span><i></i><span>执行</span><i></i><span>回放</span>
        </div>
        <p>Server 与机载 Client 通过 MQTT / Redpanda 协同。</p>
      </div>

      <div class="sidebar-footer">
        <span class="version-dot"></span>
        <div><strong>Platform 1.0</strong><small>Server + Client 架构</small></div>
        <button
          class="sidebar-toggle"
          type="button"
          :aria-label="sidebarCollapsed ? '展开导航栏' : '收起导航栏'"
          :aria-expanded="!sidebarCollapsed"
          :title="sidebarCollapsed ? '展开导航栏' : '收起导航栏'"
          @click="toggleSidebar"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m12 5-5 5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </aside>

    <section class="platform-workspace">
      <header class="platform-header">
        <div class="header-copy">
          <div class="header-eyebrow">{{ viewMeta.eyebrow }}</div>
          <div class="header-title-row">
            <h1>{{ viewMeta.title }}</h1>
            <span class="header-divider"></span>
            <p>{{ viewMeta.description }}</p>
          </div>
        </div>
        <div class="header-stack">
          <span><i class="stack-dot mqtt"></i>MQTT</span>
          <span><i class="stack-dot stream"></i>Redpanda</span>
        </div>
      </header>

      <main class="platform-content">
        <AdminConsole v-if="currentView === 'admin'" />
        <AircraftManagement v-else-if="currentView === 'aircraft'" />
        <ModelManagement v-else-if="currentView === 'models'" />
        <SystemManagement v-else-if="currentView === 'system'" />
        <WaypointGenerator v-else />
      </main>
    </section>
  </div>
</template>
