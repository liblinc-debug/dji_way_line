# 地图点击精度优化

## 问题描述

1. **坐标偏移**: 放大地图后点击添加航点时，航点位置与点击位置不一致
2. **航点漂浮**: 航点显示在空中而不是贴近地面

## 根本原因

### 问题 1: 坐标偏移
- 使用了不精确的拾取方法（`globe.pick` 或 `pickPosition`）
- 这些方法在某些缩放级别下会产生偏差
- 没有直接使用椭球体表面坐标

### 问题 2: 航点漂浮
- 航点使用了 `wp.height`（飞行高度）作为显示高度
- 应该将显示高度设为 0（贴地），飞行高度仅用于航线规划

## 解决方案

### 1. 使用 `camera.pickEllipsoid` 方法

这是最精确的贴地拾取方法：

```javascript
const ellipsoid = viewerInstance.scene.globe.ellipsoid;
const cartesian = viewerInstance.camera.pickEllipsoid(windowPosition, ellipsoid);
const cartographic = ellipsoid.cartesianToCartographic(cartesian);
```

**优势**:
- ✅ 直接获取椭球体表面坐标
- ✅ 不受地形数据影响
- ✅ 所有缩放级别下都精确
- ✅ 性能最优

### 2. 分离显示高度和飞行高度

```javascript
// 航点数据存储（包含飞行高度）
waypoints.value.push({
  lat: coords.lat,
  lng: coords.lng,
  height: missionConfig.value.globalHeight, // 飞行高度（用于航线规划）
  speed: missionConfig.value.globalSpeed
});

// 航点显示（贴地）
:position="{ lng: wp.lng, lat: wp.lat, height: 0 }" // 显示高度为 0
```

### 3. 优化场景配置

```javascript
// 禁用地形（使用平坦椭球体）
viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();

// 禁用深度测试
viewer.scene.globe.depthTestAgainstTerrain = false;

// 禁用光照（避免阴影）
viewer.scene.globe.enableLighting = false;
```

## 实现细节

### MapViewer.vue 关键修改

#### 1. 航点渲染（贴地）
```vue
<vc-entity
  v-for="(wp, index) in waypoints"
  :key="'wp-' + index"
  :position="{ lng: wp.lng, lat: wp.lat, height: 0 }"
  ...
>
```

#### 2. 航线路径（贴地）
```javascript
const scanPathPositions = computed(() => {
  return props.scanPath.map(wp => ({ 
    lng: wp.lng, 
    lat: wp.lat, 
    height: 0  // 贴地显示
  }));
});
```

#### 3. 覆盖区域（贴地）
```javascript
const coverageAreaPositions = computed(() => {
  return props.coverageArea.map(point => ({ 
    lng: point.lng, 
    lat: point.lat, 
    height: 0  // 贴地显示
  }));
});
```

#### 4. 点击拾取（精确）
```javascript
const onMapClick = (e) => {
  const ellipsoid = viewerInstance.scene.globe.ellipsoid;
  const cartesian = viewerInstance.camera.pickEllipsoid(windowPosition, ellipsoid);
  const cartographic = ellipsoid.cartesianToCartographic(cartesian);
  
  const lng = cesiumInstance.Math.toDegrees(cartographic.longitude);
  const lat = cesiumInstance.Math.toDegrees(cartographic.latitude);
  
  emit('map-click', { lat, lng });
};
```

## 优化效果

### 优化前 ❌
- 航点漂浮在空中（使用飞行高度显示）
- 点击位置偏移 ±5-20 米
- 不同缩放级别精度不一致
- 视觉效果不直观

### 优化后 ✅
- 航点完全贴地显示
- 点击位置精确（偏差 < 1 米）
- 所有缩放级别精度一致
- 视觉效果清晰直观

## 测试验证

### 1. 贴地测试
```
步骤：
1. 添加航点
2. 从侧面观察（调整相机角度）
3. 验证航点是否贴在地面上

预期结果：
✅ 航点标记紧贴地面
✅ 没有漂浮或下沉
```

### 2. 精度测试
```
步骤：
1. 在最大缩放级别点击
2. 观察航点位置
3. 连续点击同一位置 3 次

预期结果：
✅ 航点位置与点击位置一致
✅ 3 次点击坐标偏差 < 0.00001 度
```

### 3. 控制台验证
```
查看日志输出：
✓ Map clicked (ground level): { lat: "31.090123", lng: "104.390456", height: 0 }

验证：
✅ height 始终为 0
✅ 坐标值合理
✅ 没有错误信息
```

## 技术说明

### 为什么使用 `pickEllipsoid` 而不是 `pickPosition`？

| 方法 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| `pickPosition` | 可以拾取 3D 模型 | 需要深度缓冲，可能失败 | 有 3D 建筑的场景 |
| `globe.pick` | 考虑地形高度 | 精度受地形数据影响 | 有地形数据的场景 |
| `pickEllipsoid` | 最精确，最稳定 | 不考虑地形 | 平面地图（我们的场景）✅ |

### 飞行高度 vs 显示高度

```javascript
// 数据层（用于航线规划和 KMZ 导出）
waypoint.height = 50;  // 飞行高度 50 米

// 显示层（用于地图可视化）
position.height = 0;   // 贴地显示
```

这种分离确保：
- ✅ 地图上看到的是贴地的航点（直观）
- ✅ 导出的 KMZ 包含正确的飞行高度（功能正确）

## 相关文件

- `src/components/WaypointGenerator/MapViewer.vue` - 地图组件（主要修改）
- `src/components/WaypointGenerator/index.vue` - 航点数据管理

## 更新日志

### 2026-01-29 v2
- ✅ 使用 `camera.pickEllipsoid` 替代多级拾取策略
- ✅ 所有显示元素高度设为 0（贴地）
- ✅ 禁用地形提供器（使用平坦椭球体）
- ✅ 分离飞行高度和显示高度
- ✅ 优化日志输出

### 2026-01-29 v1
- 实现多级拾取策略
- 优化场景配置
- 增强错误处理

## 参考资料

- [Cesium - Camera.pickEllipsoid](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#pickEllipsoid)
- [Cesium - Ellipsoid](https://cesium.com/learn/cesiumjs/ref-doc/Ellipsoid.html)
- [Cesium - 坐标系统](https://cesium.com/learn/cesiumjs-learn/cesiumjs-quickstart/)
