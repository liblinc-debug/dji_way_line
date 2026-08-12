<script setup>
defineEmits(['navigate'])

const capabilities = [
  {
    key: 'planner',
    index: '01',
    title: '航线规划',
    subtitle: 'Mission Planning',
    description: '在地图上完成航点设计、飞行参数配置与任务动作编排，生成可执行航线。',
    tone: 'blue'
  },
  {
    key: 'admin',
    index: '02',
    title: '任务运营',
    subtitle: 'Mission Operations',
    description: '校验任务与飞机能力，完成测试运行、正式发布、ACK 跟踪和状态回放。',
    tone: 'violet'
  },
  {
    key: 'aircraft',
    index: '03',
    title: '飞机资产',
    subtitle: 'Aircraft Assets',
    description: '统一维护飞机身份、机型绑定、网络地址与在线状态，让资源清晰可管。',
    tone: 'cyan'
  },
  {
    key: 'system',
    index: '04',
    title: '系统连接',
    subtitle: 'System Connections',
    description: '集中配置并测试 Server API、MQTT 与 Redpanda，快速确认平台链路状态。',
    tone: 'emerald'
  }
]

const workflow = [
  { number: '01', title: '定义资源', detail: '机型能力 · 飞机资产', icon: 'cube' },
  { number: '02', title: '规划航线', detail: '航点 · 参数 · 动作', icon: 'route' },
  { number: '03', title: '校验发布', detail: '能力匹配 · 安全检查', icon: 'send' },
  { number: '04', title: '机载执行', detail: '命令接收 · 飞行控制', icon: 'drone' },
  { number: '05', title: '状态闭环', detail: 'ACK · 事件 · 回放', icon: 'pulse' }
]
</script>

<template>
  <div class="home-page">
    <div class="home-scroll">
      <section class="home-hero">
        <img src="/images/uav-platform-hero.png" alt="工业无人机沿数字化航线执行基础设施巡检任务" />
        <div class="hero-shade"></div>
        <div class="hero-grid"></div>
        <div class="hero-content">
          <div class="hero-badge"><i></i> UAV MISSION PLATFORM <span>1.0</span></div>
          <h2>让每一次飞行任务<br /><em>可规划、可执行、可追溯</em></h2>
          <p>面向无人机航点任务的一体化运营平台，连接任务规划、飞机资产、机载执行与状态数据，形成完整任务闭环。</p>
          <div class="hero-actions">
            <button class="hero-primary" @click="$emit('navigate', 'planner')">
              开始规划航线
              <svg viewBox="0 0 20 20" fill="none"><path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="hero-secondary" @click="$emit('navigate', 'admin')">进入任务运营中心</button>
          </div>
          <div class="hero-foundation">
            <span><i class="mqtt"></i> MQTT 命令通道</span>
            <span><i class="redpanda"></i> Redpanda 状态流</span>
            <span><i class="mavlink"></i> MAVLink 飞行控制</span>
          </div>
        </div>
        <div class="hero-indicator"><span>SCROLL TO EXPLORE</span><i></i></div>
      </section>

      <section class="home-section capability-section">
        <div class="section-heading">
          <div><span class="section-eyebrow">PLATFORM CAPABILITIES</span><h2>一个平台，贯通任务全生命周期</h2></div>
          <p>从基础资源定义到任务执行回放，各模块共享统一的数据和连接规范。</p>
        </div>
        <div class="capability-grid">
          <button v-for="item in capabilities" :key="item.key" :class="['capability-card', item.tone]" @click="$emit('navigate', item.key)">
            <div class="card-top"><span>{{ item.index }}</span><i></i><svg viewBox="0 0 20 20" fill="none"><path d="M5 10h9m-3.5-3.5L14 10l-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            <div class="capability-icon">
              <svg v-if="item.key === 'planner'" viewBox="0 0 28 28" fill="none"><path d="M4.5 7.5 10 5l7 3 6.5-3v16L17 23.5l-7-3-5.5 2.5V7.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 5v15.5M17 8v15.5" stroke="currentColor" stroke-width="1.6"/></svg>
              <svg v-else-if="item.key === 'admin'" viewBox="0 0 28 28" fill="none"><path d="M5 22V11m9 11V5m9 17v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3.5 22.5h21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
              <svg v-else-if="item.key === 'aircraft'" viewBox="0 0 28 28" fill="none"><path d="m3 15 7-2.5L14 5l4 7.5 7 2.5-7 2.5-4 6-4-6L3 15Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m9 9-3-2m13 2 3-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
              <svg v-else viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="4" stroke="currentColor" stroke-width="1.6"/><path d="m22 15.5 2 1.5-2 3.5-2.4-.8a9 9 0 0 1-2.4 1.4l-.5 2.4h-4.2l-.5-2.4a9 9 0 0 1-2.4-1.4l-2.4.8-2-3.5 2-1.5a9 9 0 0 1 0-3l-2-1.5 2-3.5 2.4.8A9 9 0 0 1 11 6.9l.5-2.4h4.2l.5 2.4a9 9 0 0 1 2.4 1.4l2.4-.8 2 3.5-2 1.5a9 9 0 0 1 0 3Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            </div>
            <span class="capability-subtitle">{{ item.subtitle }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </button>
        </div>
      </section>

      <section class="home-section workflow-section">
        <div class="section-heading light">
          <div><span class="section-eyebrow">MISSION WORKFLOW</span><h2>从资源定义到状态回放</h2></div>
          <p>Server 与机载 Client 分工协同，通过消息中间件保持命令和状态一致。</p>
        </div>
        <div class="workflow-track">
          <template v-for="(step, index) in workflow" :key="step.number">
            <div class="workflow-step">
              <div class="workflow-node">
                <svg v-if="step.icon === 'cube'" viewBox="0 0 26 26" fill="none"><path d="m13 3.5 9 5v9l-9 5-9-5v-9l9-5Z" stroke="currentColor" stroke-width="1.6"/><path d="m4.5 8.8 8.5 4.7 8.5-4.7M13 13.5v9" stroke="currentColor" stroke-width="1.6"/></svg>
                <svg v-else-if="step.icon === 'route'" viewBox="0 0 26 26" fill="none"><circle cx="6" cy="19" r="2.5" stroke="currentColor" stroke-width="1.6"/><circle cx="20" cy="7" r="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 18.5c7.5 0 3-11 9-11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-dasharray="2.5 2.5"/></svg>
                <svg v-else-if="step.icon === 'send'" viewBox="0 0 26 26" fill="none"><path d="m3.5 12.5 19-8-7 18-3.5-7-8.5-3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m12 15.5 10.5-11" stroke="currentColor" stroke-width="1.6"/></svg>
                <svg v-else-if="step.icon === 'drone'" viewBox="0 0 26 26" fill="none"><path d="m3 14 6-2 4-7 4 7 6 2-6 2.5-4 5-4-5L3 14Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m8 8-3-2m13 2 3-2" stroke="currentColor" stroke-width="1.5"/></svg>
                <svg v-else viewBox="0 0 26 26" fill="none"><path d="M3 14h4l2-6 4 12 3-9 2 3h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="13" cy="13" r="10" stroke="currentColor" stroke-width="1.2" opacity=".45"/></svg>
              </div>
              <span>{{ step.number }}</span><h3>{{ step.title }}</h3><p>{{ step.detail }}</p>
            </div>
            <div v-if="index < workflow.length - 1" class="workflow-connector"><i></i><svg viewBox="0 0 16 16" fill="none"><path d="m6 4 4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          </template>
        </div>
      </section>

      <section class="home-section architecture-section">
        <div class="architecture-copy">
          <span class="section-eyebrow">SERVER + CLIENT ARCHITECTURE</span>
          <h2>云端规划，机载执行<br />数据实时闭环</h2>
          <p>平台采用 Server / Client 分层架构。Server 负责任务规划与发布，Client 部署在机载电脑上执行命令；MQTT 承载控制消息，Redpanda 汇聚执行状态。</p>
          <button @click="$emit('navigate', 'system')">查看系统连接配置 <span>→</span></button>
        </div>
        <div class="architecture-diagram">
          <div class="arch-zone server-zone">
            <div class="zone-label">CLOUD / SERVER</div>
            <div class="arch-unit"><span class="unit-icon">S</span><div><strong>UAV Task Server</strong><small>任务规划 · 能力校验 · 任务发布</small></div></div>
          </div>
          <div class="arch-bus">
            <div class="bus-line command"><span>MQTT COMMAND</span><i></i><b>→</b></div>
            <div class="middleware"><span>MQ</span><strong>消息与状态中间件</strong><small>统一数据链路</small></div>
            <div class="bus-line status"><b>←</b><i></i><span>ACK / REDPANDA</span></div>
          </div>
          <div class="arch-zone client-zone">
            <div class="zone-label">EDGE / AIRCRAFT</div>
            <div class="arch-unit"><span class="unit-icon">C</span><div><strong>UAV Task Client</strong><small>命令接收 · MAVLink · 状态上报</small></div></div>
          </div>
          <div class="arch-footnote"><i></i><span>统一 Envelope 协议</span><i></i><span>WGS84 航线坐标</span><i></i><span>事件可审计</span></div>
        </div>
      </section>

      <footer class="home-footer">
        <div><strong>UAV TASK</strong><span>无人机航点任务规划与执行平台</span></div>
        <button @click="$emit('navigate', 'planner')">创建第一个飞行任务 <span>→</span></button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.home-page { width: 100%; height: 100%; overflow: hidden; color: #172238; background: #f3f6fa; }
.home-scroll { height: 100%; overflow-y: auto; scroll-behavior: smooth; }
.home-hero { position: relative; min-height: 500px; height: min(64vh, 610px); overflow: hidden; color: #fff; background: #071428; }
.home-hero > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; }
.hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(4,13,28,.98) 0%, rgba(4,16,34,.9) 30%, rgba(4,16,34,.35) 63%, rgba(4,16,34,.08) 100%), linear-gradient(0deg, rgba(3,11,24,.72), transparent 42%); }
.hero-grid { position: absolute; inset: 0; opacity: .15; background-image: linear-gradient(rgba(98,143,211,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(98,143,211,.22) 1px, transparent 1px); background-size: 64px 64px; mask-image: linear-gradient(90deg, #000, transparent 70%); }
.hero-content { position: relative; z-index: 2; width: min(610px, 54%); display: flex; flex-direction: column; justify-content: center; height: 100%; padding: 0 clamp(30px, 5vw, 72px); box-sizing: border-box; }
.hero-badge { width: max-content; display: flex; align-items: center; gap: 8px; margin-bottom: 22px; padding: 6px 9px; border: 1px solid rgba(117,164,255,.24); border-radius: 6px; color: #9bbcff; font-size: 9px; font-weight: 750; letter-spacing: .15em; background: rgba(41,90,180,.13); }.hero-badge i { width: 6px; height: 6px; border-radius: 50%; background: #48d6a2; box-shadow: 0 0 10px rgba(72,214,162,.7); }.hero-badge span { color: #607cae; }
.hero-content h2 { margin: 0; font-size: clamp(31px, 3.5vw, 50px); font-weight: 690; line-height: 1.19; letter-spacing: -.04em; }.hero-content h2 em { color: #81aaff; font-style: normal; }
.hero-content > p { max-width: 540px; margin: 20px 0 0; color: #9cacc4; font-size: 13px; line-height: 1.85; }
.hero-actions { display: flex; gap: 10px; margin-top: 28px; }.hero-actions button { height: 42px; padding: 0 17px; border-radius: 8px; font-size: 11px; font-weight: 650; cursor: pointer; transition: 180ms ease; }.hero-primary { display: flex; align-items: center; gap: 12px; border: 1px solid #4d83ef; color: #fff; background: #326fe7; box-shadow: 0 8px 24px rgba(33,89,204,.28); }.hero-primary svg { width: 17px; }.hero-primary:hover { background: #427ff1; transform: translateY(-1px); }.hero-secondary { border: 1px solid rgba(255,255,255,.18); color: #c4d0e1; background: rgba(255,255,255,.06); }.hero-secondary:hover { border-color: rgba(125,165,245,.45); color: #fff; background: rgba(80,122,207,.13); }
.hero-foundation { display: flex; flex-wrap: wrap; gap: 17px; margin-top: 30px; color: #70839f; font-size: 9px; }.hero-foundation span { display: flex; align-items: center; gap: 6px; }.hero-foundation i { width: 5px; height: 5px; border-radius: 50%; }.hero-foundation .mqtt { background: #4d8cff; }.hero-foundation .redpanda { background: #a271ff; }.hero-foundation .mavlink { background: #48d6a2; }
.hero-indicator { position: absolute; z-index: 2; right: 25px; bottom: 20px; display: flex; align-items: center; gap: 10px; color: rgba(220,230,245,.5); font-size: 8px; letter-spacing: .14em; writing-mode: vertical-rl; }.hero-indicator i { width: 1px; height: 32px; background: linear-gradient(#7597d8, transparent); }
.home-section { padding: 58px clamp(26px, 4.5vw, 68px); }
.section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 30px; margin-bottom: 28px; }.section-eyebrow { color: #3470df; font-size: 9px; font-weight: 800; letter-spacing: .17em; }.section-heading h2, .architecture-copy h2 { margin: 6px 0 0; color: #172238; font-size: 25px; line-height: 1.3; letter-spacing: -.025em; }.section-heading > p { max-width: 410px; margin: 0; color: #7e899a; font-size: 11px; line-height: 1.7; }
.capability-section { background: #f4f7fb; }.capability-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.capability-card { position: relative; min-height: 255px; padding: 16px 18px 20px; overflow: hidden; border: 1px solid #dfe6ef; border-radius: 12px; text-align: left; cursor: pointer; background: #fff; box-shadow: 0 6px 20px rgba(15,23,42,.04); transition: 200ms ease; }.capability-card::after { position: absolute; right: -35px; bottom: -45px; width: 120px; height: 120px; border-radius: 50%; content: ''; background: var(--card-soft); }.capability-card:hover { border-color: var(--card-line); box-shadow: 0 14px 34px rgba(23,50,94,.1); transform: translateY(-4px); }.capability-card.blue { --card-color:#3979ea; --card-soft:#edf4ff; --card-line:#a8c4f8; }.capability-card.violet { --card-color:#805bc9; --card-soft:#f3effc; --card-line:#cbb9ec; }.capability-card.cyan { --card-color:#168ca1; --card-soft:#eaf8fa; --card-line:#9dd9e2; }.capability-card.emerald { --card-color:#168565; --card-soft:#eaf8f2; --card-line:#9cd8c5; }
.card-top { display: flex; align-items: center; color: #b2bbc8; font-size: 9px; font-weight: 700; }.card-top i { height: 1px; flex: 1; margin: 0 8px; background: #edf0f4; }.card-top svg { width: 17px; color: var(--card-color); }.capability-icon { width: 46px; height: 46px; display: grid; place-items: center; margin-top: 24px; border-radius: 12px; color: var(--card-color); background: var(--card-soft); }.capability-icon svg { width: 27px; }.capability-subtitle { display: block; margin-top: 21px; color: var(--card-color); font-size: 8px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }.capability-card h3 { margin: 4px 0 0; color: #243047; font-size: 17px; }.capability-card p { position: relative; z-index: 1; margin: 9px 0 0; color: #7e899a; font-size: 10px; line-height: 1.65; }
.workflow-section { color: #fff; background: radial-gradient(circle at 80% 15%, rgba(54,103,210,.18), transparent 27%), #0b1629; }.section-heading.light h2 { color: #fff; }.section-heading.light > p { color: #7486a2; }.workflow-track { display: flex; align-items: flex-start; justify-content: center; padding: 25px 0 4px; }.workflow-step { width: 130px; text-align: center; }.workflow-node { position: relative; width: 62px; height: 62px; display: grid; place-items: center; margin: 0 auto 14px; border: 1px solid rgba(94,139,229,.32); border-radius: 18px; color: #87adfa; background: rgba(46,91,183,.13); box-shadow: inset 0 0 25px rgba(47,96,199,.08); }.workflow-node::after { position: absolute; inset: 6px; border: 1px solid rgba(117,157,235,.1); border-radius: 13px; content: ''; }.workflow-node svg { width: 28px; }.workflow-step > span { color: #486796; font-size: 8px; font-weight: 750; }.workflow-step h3 { margin: 3px 0 0; font-size: 13px; }.workflow-step p { margin: 5px 0 0; color: #6f819c; font-size: 9px; }.workflow-connector { width: clamp(28px, 5vw, 75px); display: flex; align-items: center; padding-top: 30px; color: #3e6198; }.workflow-connector i { height: 1px; flex: 1; background: repeating-linear-gradient(90deg, #365b94 0 4px, transparent 4px 8px); }.workflow-connector svg { width: 14px; }
.architecture-section { display: grid; grid-template-columns: .8fr 1.2fr; align-items: center; gap: clamp(35px, 7vw, 100px); background: #fff; }.architecture-copy > p { margin: 17px 0 0; color: #7b8798; font-size: 11px; line-height: 1.85; }.architecture-copy button, .home-footer button { margin-top: 21px; padding: 0; border: 0; color: #3470df; font-size: 10px; font-weight: 700; cursor: pointer; background: none; }.architecture-copy button span, .home-footer button span { margin-left: 7px; }
.architecture-diagram { position: relative; display: grid; grid-template-columns: 1fr 150px 1fr; align-items: center; min-height: 280px; padding: 24px; border: 1px solid #e1e7ef; border-radius: 16px; background: linear-gradient(145deg, #f9fbfd, #f2f6fb); box-shadow: 0 16px 45px rgba(31,55,91,.07); }.arch-zone { min-height: 155px; display: flex; flex-direction: column; justify-content: center; padding: 16px; border: 1px solid #dce4ef; border-radius: 12px; background: rgba(255,255,255,.8); }.zone-label { margin-bottom: 18px; color: #8592a4; font-size: 7px; font-weight: 750; letter-spacing: .16em; }.arch-unit { display: flex; align-items: center; gap: 10px; }.unit-icon { width: 34px; height: 34px; display: grid; place-items: center; flex: none; border-radius: 9px; color: #fff; font-size: 11px; font-weight: 800; background: #316fe3; box-shadow: 0 7px 17px rgba(49,111,227,.25); }.client-zone .unit-icon { background: #168b79; box-shadow: 0 7px 17px rgba(22,139,121,.22); }.arch-unit div { min-width: 0; }.arch-unit strong { display: block; color: #263349; font-size: 11px; }.arch-unit small { display: block; margin-top: 4px; color: #8793a4; font-size: 8px; line-height: 1.5; }
.arch-bus { position: relative; z-index: 2; height: 190px; display: flex; align-items: center; justify-content: center; }.middleware { width: 85px; display: flex; flex-direction: column; align-items: center; padding: 11px 5px; border: 1px solid #b8cdf5; border-radius: 11px; text-align: center; background: #fff; box-shadow: 0 9px 24px rgba(47,96,186,.12); }.middleware > span { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; color: #4a78ce; font-size: 9px; font-weight: 800; background: #eaf1ff; }.middleware strong { margin-top: 7px; color: #3b4a62; font-size: 7px; }.middleware small { color: #9aa5b4; font-size: 6px; }.bus-line { position: absolute; left: 0; right: 0; display: flex; align-items: center; color: #6282ba; font-size: 6px; font-weight: 700; letter-spacing: .08em; }.bus-line.command { top: 26px; }.bus-line.status { bottom: 25px; }.bus-line i { height: 1px; flex: 1; margin: 0 4px; background: repeating-linear-gradient(90deg, #7d9ed6 0 4px, transparent 4px 7px); }.bus-line b { font-size: 11px; }.arch-footnote { position: absolute; right: 24px; bottom: 12px; left: 24px; display: flex; align-items: center; justify-content: center; gap: 7px; color: #909bac; font-size: 7px; }.arch-footnote i { width: 4px; height: 4px; border-radius: 50%; background: #8faee2; }
.home-footer { display: flex; align-items: center; justify-content: space-between; padding: 26px clamp(26px,4.5vw,68px); color: #93a2b7; background: #081222; }.home-footer div { display: flex; align-items: baseline; gap: 12px; }.home-footer strong { color: #fff; font-size: 13px; letter-spacing: .12em; }.home-footer span { font-size: 9px; }.home-footer button { margin: 0; color: #8dafef; }
@media (max-width: 1100px) { .capability-grid { grid-template-columns: repeat(2, 1fr); }.architecture-section { grid-template-columns: 1fr; }.architecture-copy { max-width: 620px; }.hero-content { width: 65%; }.workflow-step { width: 110px; }.workflow-connector { width: 25px; } }
@media (max-width: 760px) { .home-hero { min-height: 530px; }.home-hero > img { object-position: 63% center; opacity: .72; }.hero-shade { background: linear-gradient(90deg, rgba(4,13,28,.96), rgba(4,16,34,.68)); }.hero-content { width: 100%; padding: 0 24px; }.hero-content > p { max-width: 90%; }.section-heading { align-items: flex-start; flex-direction: column; }.capability-grid { grid-template-columns: 1fr; }.workflow-track { align-items: center; flex-direction: column; }.workflow-connector { width: 1px; height: 28px; padding: 0; flex-direction: column; }.workflow-connector i { width: 1px; height: 100%; flex: none; }.workflow-connector svg { display: none; }.architecture-diagram { grid-template-columns: 1fr; gap: 10px; }.arch-bus { height: 110px; }.bus-line.command { top: 5px; }.bus-line.status { bottom: 5px; }.home-footer { align-items: flex-start; flex-direction: column; gap: 12px; }.hero-indicator { display: none; } }
</style>
