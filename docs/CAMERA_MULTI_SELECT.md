# 相机多选功能实现说明

## 功能概述

带状航线规划功能支持同时选择多个相机类型（可见光和红外），用户可以根据任务需求灵活配置。

## 实现细节

### 1. 数据结构变更

**之前（单选）:**
```javascript
cameraType: 'visible'  // 字符串
```

**现在（多选）:**
```javascript
cameraTypes: ['visible']  // 数组
```

### 2. UI 交互

- **按钮样式**: 使用 `a-button` 组件，选中时显示 `primary` 类型（蓝色），未选中时显示 `default` 类型（灰色）
- **多选逻辑**: 用户可以同时选择可见光和红外两种相机
- **最少选择限制**: 至少必须选择一个相机类型，当只剩一个选项时无法取消

### 3. GSD 配置联动

根据选择的相机类型，动态显示对应的 GSD 配置项：

- 选择**可见光**: 显示 "GSD(可见光)" 配置项，默认值 5 cm/pixel
- 选择**红外**: 显示 "GSD(红外)" 配置项，默认值 14.06 cm/pixel
- 同时选择两者: 显示两个 GSD 配置项

### 4. 验证规则

```javascript
// 验证镜头选择
if (!localConfig.value.cameraTypes || localConfig.value.cameraTypes.length === 0) {
  errors.cameraTypes = '至少选择一个镜头';
}
```

### 5. 切换逻辑

```javascript
const toggleCameraType = (type) => {
  const index = localConfig.value.cameraTypes.indexOf(type);
  if (index > -1) {
    // 如果已选中，尝试取消选择
    if (localConfig.value.cameraTypes.length > 1) {
      // 只有在有多个选项时才允许取消
      localConfig.value.cameraTypes.splice(index, 1);
    }
  } else {
    // 如果未选中，添加选择
    localConfig.value.cameraTypes.push(type);
  }
  validateConfig();
  emitConfig();
};
```

## 用户体验

1. **直观的视觉反馈**: 选中的相机按钮显示为蓝色，未选中为灰色
2. **智能的配置显示**: 只显示已选择相机类型对应的 GSD 配置
3. **防误操作**: 不允许取消所有相机选择，确保至少有一个相机被选中
4. **提示信息**: 在按钮下方显示 "可多选，但至少选择一个镜头" 的提示

## 测试建议

### 功能测试

1. **基本多选测试**
   - 打开带状航线配置
   - 点击"可见光"按钮，验证按钮变为蓝色
   - 点击"红外"按钮，验证两个按钮都为蓝色
   - 验证两个 GSD 配置项都显示

2. **最少选择限制测试**
   - 选择两个相机类型
   - 尝试取消一个，验证可以成功取消
   - 当只剩一个相机时，尝试取消，验证无法取消

3. **GSD 联动测试**
   - 只选择可见光，验证只显示可见光 GSD
   - 只选择红外，验证只显示红外 GSD
   - 同时选择两者，验证两个 GSD 都显示

4. **参数调整测试**
   - 调整可见光 GSD 值（使用 +/- 按钮）
   - 调整红外 GSD 值
   - 验证值的变化范围（最小 0.1）

### 集成测试

1. **航线生成测试**
   - 绘制中心线（至少2个点）
   - 配置带状航线参数
   - 选择不同的相机组合
   - 验证航线能正常生成

2. **KMZ 导出测试**
   - 生成带状航线
   - 导出 KMZ 文件
   - 验证文件包含正确的相机配置信息

## 相关文件

- `src/components/WaypointGenerator/StripRouteConfig.vue` - UI 组件
- `src/types/stripRoute.js` - 类型定义
- `src/utils/stripRouteGenerator.js` - 航线生成逻辑
- `src/components/WaypointGenerator/ControlPanel.vue` - 控制面板集成

## 未来改进

1. **相机参数配置**: 可以为每种相机类型配置更详细的参数（焦距、传感器尺寸等）
2. **预设方案**: 提供常用的相机组合预设（如"全光谱扫描"、"热成像巡检"等）
3. **智能推荐**: 根据任务类型自动推荐相机组合
4. **多相机协同**: 优化多相机同时工作时的航线规划策略
