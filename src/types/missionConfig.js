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
    useObstacleAvoidance: true
};
