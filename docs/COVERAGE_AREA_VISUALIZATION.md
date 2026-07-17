# 带状航线覆盖区域可视化

## 功能概述

为带状航线添加了覆盖区域的可视化显示，用户现在可以直观地看到扫描覆盖的范围，而不仅仅是航线路径。

## 视觉效果

### 显示元素

1. **覆盖区域多边形** (绿色半透明)
   - 颜色: `rgba(46, 204, 113, 0.25)` - 浅绿色，25% 透明度
   - 边框: `#27ae60` - 深绿色，2px 宽度
   - 表示: 无人机扫描覆盖的完整区域

2. **航线路径** (红色线条)
   - 颜色: `#e74c3c` - 红色
   - 宽度: 3px
   - 表示: 无人机实际飞行路径

3. **中心线** (蓝色线条)
   - 颜色: `#3498db` - 蓝色
   - 宽度: 3px
   - 表示: 用户绘制的中心线

4. **航点标记** (红色圆点)
   - 颜色: 红色
   - 大小: 10px
   - 标签: 显示航点序号

## 技术实现

### 1. 覆盖区域生成算法

```javascript
/**
 * 生成覆盖区域多边形
 * @param {Array} centerLine - 中心线坐标数组
 * @param {Object} config - 配置参数
 * @returns {Array} 多边形顶点数组
 */
export const generateCoveragePolygon = (centerLine, config) => {
  const { leftExtension, rightExtension } = config;
  
  // 1. 分段中心线
  const segments = segmentCenterLine(centerLine);
  
  // 2. 生成左右边界点
  const leftBoundary = [];
  const rightBoundary = [];
  
  for (const segment of segments) {
    const bearing = segment.bearing;
    
    // 计算垂直偏移点
    const leftPoint = calculatePerpendicularPoint(
      segment.start, 
      bearing, 
      -leftExtension
    );
    const rightPoint = calculatePerpendicularPoint(
      segment.start, 
      bearing, 
      rightExtension
    );
    
    leftBoundary.push(leftPoint);
    rightBoundary.push(rightPoint);
  }
  
  // 3. 组合成多边形：左边界 + 反向右边界
  return [...leftBoundary, ...rightBoundary.reverse()];
};
```

### 2. 数据流

```
用户绘制中心线
    ↓
配置左右外扩距离
    ↓
生成航线 (stripRouteGenerator.js)
    ├─ 生成航点数组
    └─ 生成覆盖区域多边形
    ↓
传递到地图组件 (MapViewer.vue)
    ↓
渲染覆盖区域 (CesiumJS Polygon)
```

### 3. 关键代码位置

#### stripRouteGenerator.js
```javascript
// 生成航线时同时生成覆盖区域
export const generateStripRoute = (centerLine, config) => {
  // ... 生成航点
  
  // 生成覆盖区域多边形
  const coverageArea = generateCoveragePolygon(centerLine, config);
  
  return {
    waypoints,
    coverageArea,  // 新增
    metadata,
    statistics
  };
};
```

#### index.vue
```javascript
// 添加覆盖区域状态
const coverageArea = ref([]);

// 生成航线时更新覆盖区域
const generateStripRouteInternal = (showAlert = false) => {
  const result = generateStripRoute(waypoints.value, options);
  
  scanPath.value = result.waypoints;
  coverageArea.value = result.coverageArea;  // 新增
  routeStats.value = result.statistics;
};
```

#### MapViewer.vue
```vue
<!-- 渲染覆盖区域 -->
<vc-entity v-if="routeType === 'strip' && coverageAreaPositions.length > 2">
  <vc-graphics-polygon
    :hierarchy="coverageAreaPositions"
    :material="'rgba(46, 204, 113, 0.25)'"
    :outline="true"
    :outlineColor="'#27ae60'"
    :outlineWidth="2"
  ></vc-graphics-polygon>
</vc-entity>
```

## 用户体验

### 优势

1. **直观可视化**: 用户可以清楚地看到扫描覆盖的范围
2. **参数调整反馈**: 调整左右外扩距离时，覆盖区域实时更新
3. **规划验证**: 可以验证覆盖区域是否符合预期
4. **颜色区分**: 绿色覆盖区域 + 红色航线 + 蓝色中心线，层次清晰

### 交互流程

1. **绘制中心线**: 在地图上点击至少 2 个点
2. **配置参数**: 设置左右外扩距离
3. **实时预览**: 
   - 绿色区域显示覆盖范围
   - 红色线条显示飞行路径
   - 蓝色线条显示中心线
4. **调整优化**: 根据覆盖区域调整参数

## 视觉设计说明

### 颜色选择

| 元素 | 颜色 | 原因 |
|------|------|------|
| 覆盖区域 | 绿色 (#2ecc71) | 表示"安全覆盖"、"完成区域" |
| 航线路径 | 红色 (#e74c3c) | 醒目，表示"飞行路径" |
| 中心线 | 蓝色 (#3498db) | 表示"用户输入"、"基准线" |
| 航点 | 红色 | 与航线路径一致 |

### 透明度设置

- **覆盖区域**: 25% 透明度
  - 足够透明，不遮挡地图细节
  - 足够明显，清晰显示覆盖范围
  
- **边框**: 不透明
  - 清晰定义边界
  - 便于精确查看覆盖范围

## 性能考虑

### 多边形顶点数量

- **中心线 2 个点**: 覆盖区域 4 个顶点
- **中心线 10 个点**: 覆盖区域 20 个顶点
- **中心线 50 个点**: 覆盖区域 100 个顶点

### 渲染性能

- CesiumJS 高效渲染多边形
- 实时更新流畅（300ms 防抖）
- 对性能影响可忽略

## 与其他航线类型对比

| 航线类型 | 覆盖区域显示 | 颜色 |
|---------|------------|------|
| 航点航线 | 无 | - |
| 巡逻航线 | 蓝色多边形 | `rgba(52, 152, 219, 0.3)` |
| 面状航线 | 蓝色多边形 | `rgba(52, 152, 219, 0.3)` |
| 带状航线 | 绿色多边形 | `rgba(46, 204, 113, 0.25)` |

## 测试验证

### 功能测试

1. **基本显示**
   - 绘制 2 个点的中心线
   - 验证显示绿色覆盖区域
   - 验证边界正确

2. **参数调整**
   - 增加左外扩距离
   - 验证左侧边界扩展
   - 增加右外扩距离
   - 验证右侧边界扩展

3. **复杂中心线**
   - 绘制多个转折点
   - 验证覆盖区域连续性
   - 验证转角处理正确

4. **实时更新**
   - 修改参数
   - 验证 300ms 后自动更新
   - 验证覆盖区域与参数一致

### 视觉测试

1. **颜色对比度**: 绿色覆盖区域在地图上清晰可见
2. **透明度**: 不遮挡地图细节
3. **边框清晰度**: 边界线清晰可辨
4. **层次关系**: 覆盖区域在底层，航线在上层

## 已知限制

1. **复杂中心线**: 急转弯处可能出现自相交
2. **极端参数**: 非常大的外扩距离可能导致不合理的覆盖区域
3. **地形适配**: 当前为平面多边形，未考虑地形起伏

## 未来改进

### 短期
- [ ] 添加覆盖区域面积显示
- [ ] 支持自定义覆盖区域颜色
- [ ] 添加覆盖区域透明度调节

### 中期
- [ ] 3D 地形适配
- [ ] 覆盖区域高度显示
- [ ] 多段覆盖区域支持

### 长期
- [ ] 覆盖率热力图
- [ ] 重叠区域分析
- [ ] 盲区检测和提示

## 相关文件

- `src/utils/stripRouteGenerator.js` - 覆盖区域生成算法
- `src/components/WaypointGenerator/index.vue` - 数据管理
- `src/components/WaypointGenerator/MapViewer.vue` - 渲染实现

## 更新日志

- **2026-01-29**: 初始实现覆盖区域可视化功能
  - 添加 `generateCoveragePolygon` 函数
  - 更新地图渲染逻辑
  - 添加绿色半透明多边形显示

## 总结

覆盖区域可视化功能显著提升了带状航线规划的用户体验，使用户能够直观地看到扫描覆盖的范围，更好地规划和验证航线。绿色的覆盖区域与红色的航线路径形成清晰的视觉对比，帮助用户快速理解航线规划结果。
