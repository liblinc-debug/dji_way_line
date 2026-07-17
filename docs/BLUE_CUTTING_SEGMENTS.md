# 蓝色切割段可视化功能

## 功能概述

蓝色切割段是带状航线（弓字航线模式）中的横向连接线，用于显示切割距离的分段效果。这些线条垂直于航线方向，将整个带状区域分割成多个矩形区域，每个区域内独立生成弓字航线。

## 核心逻辑

### 1. 区域切割
按切割距离将中心线分段，每个分段形成一个独立的矩形区域：
```
中心线: A -------- B -------- C -------- D
         |          |          |          |
切割距离: |<- 1000m->|<- 1000m->|<- 1000m->|
         |          |          |          |
区域:    [  区域1  ][  区域2  ][  区域3  ]
```

### 2. 区域内航线生成
在每个矩形区域内生成独立的弓字航线（多条平行线）：
```
区域1:
  左航线 ←←←←←←←
  右航线 →→→→→→→

区域2:
  左航线 →→→→→→→
  右航线 ←←←←←←←

区域3:
  左航线 ←←←←←←←
  右航线 →→→→→→→
```

### 3. S型连接
各区域之间的航线按S型连接，形成连续的飞行路径。

## 实现细节

### 1. 数据生成 (`stripRouteGenerator.js`)

#### 新增函数：`segmentCenterLineByDistance`
```javascript
const segmentCenterLineByDistance = (centerLine, segmentDistance) => {
  // 按切割距离将中心线分段
  // 处理跨越多个中心线点的情况
  // 返回分段数组，每个分段包含起点、终点、路径和方位角
};
```

#### 新增函数：`generateParallelRouteForSegment`
```javascript
const generateParallelRouteForSegment = (segment, offset, altitude, speed) => {
  // 为单个分段生成平行航线
  // 对路径中的每个点计算平行偏移
  // 返回该分段的航点数组
};
```

#### 新增函数：`connectRegionsInSPattern`
```javascript
const connectRegionsInSPattern = (allRegionRoutes) => {
  // 按S型连接多个区域的航线
  // 区域之间交替方向
  // 区域内部也按S型连接
  // 返回连接后的航点数组
};
```

#### 改进函数：`generateZigzagRouteWithSegments`
```javascript
export const generateZigzagRouteWithSegments = (centerLine, config) => {
  // 1. 将中心线按切割距离分段
  const centerLineSegments = segmentCenterLineByDistance(centerLine, cuttingDistance);
  
  // 2. 为每个分段生成独立的弓字航线区域
  const allRegionRoutes = [];
  const cuttingSegments = [];
  
  for (let segIdx = 0; segIdx < centerLineSegments.length; segIdx++) {
    const segment = centerLineSegments[segIdx];
    
    // 为当前分段生成多条平行航线
    const regionRoutes = [];
    for (let i = 0; i < routeCount; i++) {
      const offset = -leftExtension + (i * totalWidth / (routeCount - 1 || 1));
      const route = generateParallelRouteForSegment(segment, offset, altitude, speed);
      regionRoutes.push(route);
    }
    
    // 生成当前区域的切割段（区域边界）
    if (regionRoutes.length >= 2) {
      // 区域起始边界
      cuttingSegments.push([leftRoute[0], rightRoute[0]]);
      // 区域结束边界
      cuttingSegments.push([leftRoute[end], rightRoute[end]]);
    }
    
    allRegionRoutes.push(regionRoutes);
  }
  
  // 3. 按S型连接所有区域的航线
  const waypoints = connectRegionsInSPattern(allRegionRoutes);
  
  return { waypoints, cuttingSegments };
};
```

### 2. 数据流 (`index.vue`)

#### 状态管理
```javascript
const cuttingSegments = ref([]);  // 添加切割段数据
```

#### 生成航线时接收切割段
```javascript
const generateStripRouteInternal = (showAlert = false) => {
  const result = generateStripRoute(waypoints.value, options);
  
  scanPath.value = result.waypoints;
  routeStats.value = result.statistics;
  coverageArea.value = result.coverageArea || [];
  cuttingSegments.value = result.cuttingSegments || [];  // 设置切割段
};
```

#### 传递给地图组件
```vue
<MapViewer 
  :waypoints="waypoints" 
  :scan-path="scanPath" 
  :coverage-area="coverageArea"
  :cutting-segments="cuttingSegments"
  :route-type="missionConfig.routeType"
  @map-click="onMapClick" 
/>
```

### 3. 可视化渲染 (`MapViewer.vue`)

#### Props 定义
```javascript
const props = defineProps({
  cuttingSegments: {
    type: Array,
    default: () => []
  },
  // ... 其他 props
});
```

#### 渲染蓝色切割线
```vue
<!-- Blue Cutting Segments (Strip Route Only) -->
<vc-entity 
  v-for="(segment, index) in cuttingSegments" 
  :key="'cutting-' + index"
  v-if="routeType === 'strip' && cuttingSegments.length > 0"
>
  <vc-graphics-polyline
    :positions="[
      { lng: segment[0].lng, lat: segment[0].lat, height: 0 },
      { lng: segment[1].lng, lat: segment[1].lat, height: 0 }
    ]"
    :material="'#3498db'"
    :width="2"
  ></vc-graphics-polyline>
</vc-entity>
```

## 视觉效果

- **颜色**：蓝色 (`#3498db`)
- **宽度**：2 像素
- **显示条件**：仅在带状航线（弓字航线模式）下显示
- **位置**：贴地显示（height: 0）

## 特性

1. **区域切割**：按切割距离将中心线分段，形成多个独立区域
2. **独立航线**：每个区域内生成独立的弓字航线
3. **自动生成**：切割段随航线自动生成，无需手动配置
4. **实时更新**：参数变化时自动更新切割段和航线
5. **精确对齐**：切割段垂直于航线方向，标记区域边界
6. **S型连接**：区域之间按S型连接，形成连续飞行路径
7. **性能优化**：只在弓字航线模式下生成和渲染

## 与大疆司空的对比

| 特性 | 大疆司空 | 当前实现 |
|------|---------|---------|
| 蓝色分段线 | ✅ | ✅ |
| 区域切割 | ✅ | ✅ |
| 独立区域航线 | ✅ | ✅ |
| 垂直于航线 | ✅ | ✅ |
| 间距与切割距离一致 | ✅ | ✅ |
| S型连接 | ✅ | ✅ |
| 贴地显示 | ✅ | ✅ |

## 修复的问题

### 问题：带状航线配置面板空白

**原因**：
1. `ControlPanel.vue` 中 `activeTab` 默认值为 `'config'`
2. 带状模式下标签页 key 为 `'strip-config'` 和 `'centerline'`
3. 没有匹配的标签页导致显示空白

**解决方案**：
1. 添加 `watch` 监听 `routeType` 变化
2. 根据航线类型自动切换到对应的标签页
3. 在 `defaultMissionConfig` 中添加 `stripRoute` 默认配置

```javascript
// ControlPanel.vue
watch(() => props.missionConfig.routeType, (newType) => {
  if (newType === 'strip') {
    activeTab.value = 'strip-config';
  } else if (newType === 'mapping' || newType === 'polygon') {
    activeTab.value = 'polygon';
  } else {
    activeTab.value = 'config';
  }
}, { immediate: true });

// index.vue
const defaultMissionConfig = {
  // ... 其他配置
  stripRoute: { ...DEFAULT_STRIP_CONFIG }  // 添加带状航线默认配置
};
```

## 测试建议

1. **创建带状航线**：
   - 创建新的带状航线任务
   - 验证配置面板正常显示
   - 验证默认参数正确加载

2. **绘制中心线**：
   - 在地图上点击至少 2 个点
   - 验证航线自动生成
   - 验证蓝色切割段显示

3. **参数调整**：
   - 调整切割距离
   - 验证切割段间距变化
   - 调整左右外扩距离
   - 验证切割段长度变化

4. **模式切换**：
   - 切换到单航线模式
   - 验证切割段消失
   - 切换回弓字航线模式
   - 验证切割段重新显示

## 版本信息

- **版本**：v1.3.0
- **日期**：2026-01-29
- **功能**：蓝色切割段可视化 + 配置面板空白修复
