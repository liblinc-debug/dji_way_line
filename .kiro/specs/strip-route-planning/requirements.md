# 需求文档

## 介绍

带状航线规划功能是大疆无人机航线规划系统的新增功能模块，用于生成沿指定中心线的带状扫描航线。该功能主要应用于河流巡检、道路监测、电力线巡检等线性目标的航拍任务，通过自动生成S形扫描路径确保对带状区域的完整覆盖。

## 术语表

- **Strip_Route_System**: 带状航线规划系统
- **Center_Line**: 用户在地图上绘制的中心线路径
- **Extension_Length**: 左右扩展长度，定义中心线两侧的覆盖距离
- **Cutting_Distance**: 切割距离，定义每个飞行段的长度
- **Zigzag_Mode**: Z字形扫描模式，用于多航线覆盖
- **Single_Route_Mode**: 单航线模式，用于简单的线性飞行
- **S_Pattern**: S形扫描路径，确保完整覆盖的飞行模式
- **WPML_Generator**: WPML 1.0.6标准KMZ文件生成器
- **Route_Config_Component**: 航线配置组件
- **Route_Generator**: 航线生成算法模块

## 需求

### 需求 1: 中心线绘制

**用户故事:** 作为无人机操作员，我希望能在地图上绘制中心线，以便定义带状航线的基准路径。

#### 验收标准

1. WHEN 用户选择带状航线模式 THEN Strip_Route_System SHALL 提供中心线绘制工具
2. WHEN 用户在地图上点击 THEN Strip_Route_System SHALL 添加航点到中心线
3. WHEN 中心线包含少于2个点 THEN Strip_Route_System SHALL 阻止航线生成并显示错误提示
4. WHEN 用户完成中心线绘制 THEN Strip_Route_System SHALL 在地图上显示完整的中心线路径
5. WHEN 用户修改中心线航点 THEN Strip_Route_System SHALL 实时更新中心线显示

### 需求 2: 带宽参数配置

**用户故事:** 作为无人机操作员，我希望能设置带宽参数，以便控制扫描覆盖的范围。

#### 验收标准

1. THE Strip_Route_System SHALL 提供左右扩展长度(Extension Length)参数输入界面
2. THE Strip_Route_System SHALL 支持左右扩展长度独立设置或链接设置
3. WHEN 用户输入扩展长度值 THEN Strip_Route_System SHALL 验证数值为正数且在合理范围内
4. WHEN 扩展长度参数改变 THEN Strip_Route_System SHALL 实时更新航线预览和最小飞行高度
5. WHEN 扩展长度设置为0或负数 THEN Strip_Route_System SHALL 显示验证错误并阻止生成
6. THE Strip_Route_System SHALL 根据扩展长度自动计算所需的最小飞行高度

### 需求 3: 扫描参数配置

**用户故事:** 作为无人机操作员，我希望能配置扫描间距和切割距离，以便优化航拍效果和飞行效率。

#### 验收标准

1. THE Strip_Route_System SHALL 提供切割距离(Cutting Distance)参数配置
2. THE Strip_Route_System SHALL 提供航线间距参数配置
3. THE Strip_Route_System SHALL 支持单航线模式和Z字形(Zigzag)航线模式选择
4. WHEN 切割距离小于等于0 THEN Strip_Route_System SHALL 显示验证错误
5. WHEN 选择Z字形模式 THEN Strip_Route_System SHALL 根据扩展长度自动计算所需航线数量
6. WHEN 扫描参数改变 THEN Strip_Route_System SHALL 实时更新航线预览和飞行时间估算

### 需求 4: S形航线生成

**用户故事:** 作为无人机操作员，我希望系统能自动生成S形扫描航线，以便实现带状区域的完整覆盖。

#### 验收标准

1. WHEN 用户触发航线生成 THEN Strip_Route_System SHALL 基于中心线和带宽生成S形扫描路径
2. THE Strip_Route_System SHALL 确保生成的航线完全覆盖指定的带状区域
3. WHEN 生成S形路径 THEN Strip_Route_System SHALL 优化航点顺序以最小化飞行时间
4. THE Strip_Route_System SHALL 在航线转向点添加适当的过渡航点
5. WHEN 中心线包含急转弯 THEN Strip_Route_System SHALL 调整扫描路径以保持覆盖连续性

### 需求 5: 航线预览和可视化

**用户故事:** 作为无人机操作员，我希望能预览生成的航线，以便在执行前验证航线的正确性。

#### 验收标准

1. WHEN 航线生成完成 THEN Strip_Route_System SHALL 在地图上显示完整的航线路径
2. THE Strip_Route_System SHALL 使用不同颜色区分中心线和扫描航线
3. WHEN 用户悬停在航点上 THEN Strip_Route_System SHALL 显示航点详细信息
4. THE Strip_Route_System SHALL 显示预计飞行时间和总距离
5. WHEN 参数改变 THEN Strip_Route_System SHALL 实时更新航线预览

### 需求 6: WPML文件生成

**用户故事:** 作为无人机操作员，我希望能导出符合WPML 1.0.6标准的KMZ文件，以便在大疆司空2和Matrice系列无人机上执行任务。

#### 验收标准

1. WHEN 用户请求导出 THEN WPML_Generator SHALL 生成符合WPML 1.0.6标准的KMZ文件
2. THE WPML_Generator SHALL 包含所有航点的经纬度和高度信息
3. THE WPML_Generator SHALL 包含适当的航线元数据和配置参数
4. WHEN 生成KMZ文件 THEN WPML_Generator SHALL 验证文件格式的正确性
5. THE WPML_Generator SHALL 确保生成的文件与大疆司空2和Matrice系列无人机兼容

### 需求 7: 系统集成

**用户故事:** 作为系统架构师，我希望带状航线功能能无缝集成到现有系统中，以便保持系统的一致性和可维护性。

#### 验收标准

1. THE Strip_Route_System SHALL 遵循现有的代码架构和设计模式
2. WHEN 添加带状航线类型 THEN Strip_Route_System SHALL 扩展现有的航线类型枚举
3. THE Strip_Route_System SHALL 复用现有的地图交互和UI组件
4. WHEN 切换航线类型 THEN Strip_Route_System SHALL 正确清理和初始化相应的组件
5. THE Strip_Route_System SHALL 与现有的航点航线、巡逻航线、面状航线功能共存

### 需求 8: 错误处理和验证

**用户故事:** 作为无人机操作员，我希望系统能提供清晰的错误提示和输入验证，以便避免生成无效的航线。

#### 验收标准

1. WHEN 输入参数无效 THEN Strip_Route_System SHALL 显示具体的错误信息
2. WHEN 中心线过短或过复杂 THEN Strip_Route_System SHALL 提供相应的警告和建议
3. WHEN 生成的航线超出安全飞行范围 THEN Strip_Route_System SHALL 警告用户并提供调整建议
4. IF 系统资源不足导致生成失败 THEN Strip_Route_System SHALL 优雅降级并通知用户
5. THE Strip_Route_System SHALL 记录所有错误和警告信息用于调试