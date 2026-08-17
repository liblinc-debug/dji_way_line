export const OBSTACLE_AVOIDANCE_DEFAULT = {
    enabled: true,
    strategy: 'vertical-overfly',
    altitudeMode: 'auto',
    fixedClimbHeight: 20,
    verticalClearance: 10,
    horizontalClearance: 3,
    lookaheadDistance: 20,
    maxWaitSeconds: 30,
    fallbackAction: 'hover'
};

export const OBSTACLE_AVOIDANCE_STRATEGIES = [
    {
        value: 'stop-hover',
        label: '停止并悬停',
        algorithm: 'PX4 Collision Prevention',
        description: '接近障碍物时减速并停止，等待障碍消失或人工处理；适合动态障碍和空间狭窄区域。'
    },
    {
        value: 'vertical-overfly',
        label: '垂直爬升越障',
        algorithm: 'Vertical BendyRuler',
        description: '在障碍物前原地垂直上升，以恒定安全高度水平飞越，越障后原地垂直下降并恢复原航线；不会用斜坡、三角形或梯形航迹穿越建筑。'
    },
    {
        value: 'horizontal-bypass',
        label: '水平局部绕行',
        algorithm: 'Horizontal BendyRuler',
        description: '在局部水平空间搜索可通行方向并逐步绕开障碍；适合限高区域和不宜改变飞行高度的任务。'
    },
    {
        value: 'global-local-replan',
        label: '全局与局部重规划',
        algorithm: 'Dijkstra + BendyRuler',
        description: '使用已知地图进行全局最短路规划，并通过局部规划处理传感器临时发现的障碍；适合复杂园区和禁飞区较多的环境。'
    }
];

export const MISSION_CONFIG_DEFAULT = {
    flyToWaylineMode: 'safely',
    finishAction: 'goHome',
    executeRCLostAction: 'hover',
    exitOnRCLost: 'executeLostAction',
    isClosedLoop: false,
    globalAction: 'none',
    takeOffSecurityHeight: 20,
    globalTransitionalSpeed: 10,
    globalHeight: 60,
    executeHeightMode: 'relativeToStartPoint',
    realtimeFollowSurface: false,
    climbMode: 'vertical',
    caliFlightEnable: false,
    aiPatrol: {
        scanSpacing: 20,
        direction: 0,
        margin: 0,
        enabled: false,
        confidence: 80,
        cameraMode: 'visible',
        gimbalPitchAngle: -45,
        recordEnable: true,
        customTitle: '',
        customText: '检测到异常目标',
        targets: {
            people: true,
            vehicle: false,
            boat: false
        },
        targetRules: {
            people: { operator: '>', value: 1 },
            vehicle: { operator: '>', value: 1 },
            boat: { operator: '>', value: 1 }
        },
        alarmActions: {
            snapshot: true,
            record: true,
            waitControl: false,
            speaker: false,
            searchlight: false
        }
    },
    scanSetting: {
        aiEnabled: false,
        confidence: 80,
        cameraMode: 'visible',
        overlap: 20,
        angle: 0,
        margin: 0
    },
    photoType: ['visible'], // Array of visible, infrared
    lowLightMode: false,
    takeoffSpeed: 10,
    waypointType: 'linear', // linear, curved
    yawMode: 'alongPath', // alongPath, lockYaw, manual, pointToPoint
    gimbalPitchMode: 'usePointSettings', // usePointSettings, lockGimbal
    useObstacleAvoidance: true,
    obstacleAvoidance: { ...OBSTACLE_AVOIDANCE_DEFAULT }
};
