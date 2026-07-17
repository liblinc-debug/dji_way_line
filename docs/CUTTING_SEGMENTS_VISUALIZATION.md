# 切割段可视化功能

## 概述

切割段可视化功能为弓字航线（S型航线）添加了蓝色横向连接线，用于显示切割距离的分段效果。这些蓝色线条垂直于航线方向，连接左右两侧的平行航线，帮助用户直观地理解航线的切割间距。

## 功能特性

### 1. 蓝色分段线
- **颜色**: `#3498db` (蓝色)
- **宽度**: 2 像素
- **位置**: 贴地显示（高度为 0）
- **方向**: 垂直于航线方向，横向连接左右航线

### 2. 显示条件
- 仅在**弓字航线模式**下显示
- 单航线模式不显示切割段
- 至少需要 2 条平行航线才会生成切割段

### 3. 生成逻辑
- 切割段连接最左侧和最右侧的平行航线
- 每个切割段对应一个切割距离间隔
- 切割段数量 = 航点数量（每条航线）

## 实现细节

### 数据结构

切割段数据格式：
```javascript
cuttingSegments = [
  [
    { lat: 31.09, lng: 104.39 },  // 左侧点
    { lat: 31.09, lng: 104.40 }   // 右侧点
  ],
  // ... 更多切割段
]
```

### 核心函数

#### `generateCuttingSegments(routes)`
生成切割段的核心函数，位于 `src/utils/stripRouteGenerator.js`

**参数**:
- `routes`: 航线数组，每条航线是航点数组

**返回值**:
- 切割段数组，每个切割段是两个点的数组

**逻辑**:
1. 获取最左侧航线（`routes[0]`）
2. 获取最右侧航线（`routes[routes.length - 1]`）
3. 为每对对应的航点创建横向连接线
4. 返回切割段数组

### 数据流

```
用户配置
  ↓
generateStripRoute()
  ↓
generateZigzagRouteWithSegments()
  ↓
generateCuttingSegments()
  ↓
返回 { waypoints, cuttingSegments }
  ↓
index.vue (存储到 cuttingSegments ref)
  ↓
MapViewer.vue (渲染蓝色线条)
```

## 使用示例

### 1. 创建带状航线
1. 选择"带状航线"模式
2. 在地图上点击至少 2 个点作为中心线
3. 在"带状航线配置"中设置参数：
   - 左侧延伸：50m
   - 右侧延伸：50m
   - 切割距离：1000m
   - 航线模式：**弓字航线**

### 2. 查看切割段
- 绿色线条：飞行路径（S型）
- 绿色半透明区域：覆盖区域
- **蓝色横向线条**：切割段（显示切割间距）

## 视觉效果

```
左侧航线 ←─────蓝色切割段─────→ 右侧航线
    ↓                              ↓
    ↓                              ↓
    ↓←─────蓝色切割段─────→        ↓
    ↓                              ↓
    ↓                              ↓
    ↓←─────蓝色切割段─────→        ↓
```

## 技术要点

### 1. 贴地显示
所有切割段的高度设置为 0，确保完全贴近地面：
```javascript
{ lng: segment[0].lng, lat: segment[0].lat, height: 0 }
```

### 2. 条件渲染
只在弓字航线模式下显示：
```vue
v-if="routeType === 'strip' && cuttingSegments.length > 0"
```

### 3. 性能优化
- 使用 `v-for` 高效渲染多个切割段
- 每个切割段是独立的 `vc-entity`
- 使用唯一的 `key` 值（`'cutting-' + index`）

## 与大疆司空的对比

| 特性 | 大疆司空 | 当前实现 |
|------|---------|---------|
| 蓝色分段线 | ✅ | ✅ |
| 垂直于航线方向 | ✅ | ✅ |
| 连接左右航线 | ✅ | ✅ |
| 显示切割间距 | ✅ | ✅ |
| 贴地显示 | ✅ | ✅ |

## 相关文件

- `src/utils/stripRouteGenerator.js` - 切割段生成逻辑
- `src/components/WaypointGenerator/index.vue` - 数据管理
- `src/components/WaypointGenerator/MapViewer.vue` - 可视化渲染

## 版本历史

- **v1.2.3** (2026-01-29): 添加蓝色切割段可视化功能

## 参考资料

- [带状航线规划指南](./STRIP_ROUTE_GUIDE.md)
- [覆盖区域可视化](./COVERAGE_AREA_VISUALIZATION.md)
- [地图点击精度优化](./MAP_CLICK_ACCURACY.md)
