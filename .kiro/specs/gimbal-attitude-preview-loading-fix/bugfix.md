# Bugfix Requirements Document

## Introduction

云台/姿态预览功能(CameraPreview组件)在用户选择航点后,有概率出现黑屏或一直卡在加载状态的问题,导致用户无法正常查看云台姿态的第一人称视角预览。该功能基于Cesium地图引擎实现,通过模拟无人机的位置、云台俯仰角、飞行器偏航角和变焦倍数来渲染预览画面。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 用户选择航点触发云台预览时 THEN 系统有概率显示黑屏,无法看到预览画面

1.2 WHEN 用户选择航点触发云台预览时 THEN 系统有概率一直显示加载状态,预览画面无法正常渲染

1.3 WHEN CameraPreview组件初始化时地形数据加载失败 THEN 系统没有提供降级方案,导致预览功能不可用

1.4 WHEN currentDronePos数据包含无效坐标值(NaN/undefined) THEN 相机设置失败但没有错误提示,导致黑屏

1.5 WHEN updateCamera()在viewer初始化完成前被调用 THEN 相机参数设置失败,导致预览无法显示

### Expected Behavior (Correct)

2.1 WHEN 用户选择航点触发云台预览时 THEN 系统SHALL稳定地显示云台姿态的第一人称视角预览画面

2.2 WHEN 用户选择航点触发云台预览时 THEN 系统SHALL在合理时间内(如2秒内)完成加载并显示预览画面

2.3 WHEN CameraPreview组件初始化时地形数据加载失败 THEN 系统SHALL自动切换到椭球体地形并继续渲染预览

2.4 WHEN currentDronePos数据包含无效坐标值 THEN 系统SHALL使用默认有效值或显示错误提示,避免黑屏

2.5 WHEN updateCamera()被调用时 THEN 系统SHALL确保viewer和cesiumInstance已完全初始化后再执行相机设置

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 云台预览正常显示时 THEN 系统SHALL CONTINUE TO正确渲染第一人称视角画面

3.2 WHEN 用户调整云台俯仰角、飞行器偏航角或变焦倍数时 THEN 系统SHALL CONTINUE TO实时更新预览画面

3.3 WHEN 用户在大屏FPV模式和小窗预览模式之间切换时 THEN 系统SHALL CONTINUE TO保持预览功能正常工作

3.4 WHEN 地形数据成功加载时 THEN 系统SHALL CONTINUE TO使用真实地形数据进行渲染

3.5 WHEN 预览画面显示测距信息时 THEN 系统SHALL CONTINUE TO准确计算并显示相机到地面的距离
