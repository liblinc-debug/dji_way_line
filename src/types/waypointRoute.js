/**
 * 航点动作类型定义
 */

export const ACTION_TYPE = {
    TAKE_PHOTO: 'takePhoto',
    START_RECORD: 'startRecord',
    STOP_RECORD: 'stopRecord',
    GIMBAL_PITCH: 'gimbalPitch',
    AIRCRAFT_YAW: 'aircraftYaw',
    HOVER: 'hover',
    ZOOM: 'zoom',
    START_TIMED_PHOTO: 'startTimedPhoto',
    START_DISTANCE_PHOTO: 'startDistancePhoto',
    STOP_INTERVAL_PHOTO: 'stopIntervalPhoto',
    PANORAMA: 'panorama',
    ORIENTED_PHOTO: 'orientedPhoto',
    CUSTOM_DIR_NAME: 'customDirName',
    RECORD_POINT_CLOUD: 'recordPointCloud',
    SET_FOCUS_TYPE: 'setFocusType',
    FOCUS: 'focus',
    GIMBAL_ANGLE_LOCK: 'gimbalAngleLock',
    GIMBAL_ANGLE_UNLOCK: 'gimbalAngleUnlock',
    // 司空 2 扩展动作
    SPOTLIGHT: 'spotlight',
    SPEAKER: 'speaker',
    SMART_RECOGNITION: 'smartRecognition',
    START_TIME_LAPSE: 'startTimeLapse',
    STOP_TIME_LAPSE: 'stopTimeLapse'
};

export const ACTION_LABEL = {
    [ACTION_TYPE.TAKE_PHOTO]: '拍照',
    [ACTION_TYPE.START_RECORD]: '开始录像',
    [ACTION_TYPE.STOP_RECORD]: '停止录像',
    [ACTION_TYPE.GIMBAL_PITCH]: '云台俯仰',
    [ACTION_TYPE.AIRCRAFT_YAW]: '偏航角',
    [ACTION_TYPE.HOVER]: '悬停',
    [ACTION_TYPE.ZOOM]: '变焦',
    [ACTION_TYPE.START_TIMED_PHOTO]: '等时间隔拍照',
    [ACTION_TYPE.START_DISTANCE_PHOTO]: '等距间隔拍照',
    [ACTION_TYPE.STOP_INTERVAL_PHOTO]: '停止间隔拍照',
    [ACTION_TYPE.PANORAMA]: '全景拍照',
    [ACTION_TYPE.ORIENTED_PHOTO]: '定向拍照',
    [ACTION_TYPE.CUSTOM_DIR_NAME]: '新建文件夹',
    [ACTION_TYPE.RECORD_POINT_CLOUD]: '激光点云录制',
    [ACTION_TYPE.SET_FOCUS_TYPE]: '设置对焦模式',
    [ACTION_TYPE.FOCUS]: '对焦',
    [ACTION_TYPE.GIMBAL_ANGLE_LOCK]: '云台角度锁定',
    [ACTION_TYPE.GIMBAL_ANGLE_UNLOCK]: '云台角度解锁',
    [ACTION_TYPE.SPOTLIGHT]: '探照灯',
    [ACTION_TYPE.SPEAKER]: '喊话器',
    [ACTION_TYPE.SPEAKER]: '喊话器',
    [ACTION_TYPE.SMART_RECOGNITION]: '智能识别',
    [ACTION_TYPE.START_TIME_LAPSE]: '开始延时摄影',
    [ACTION_TYPE.STOP_TIME_LAPSE]: '停止延时摄影'
};

export const ACTION_ICON = {
    [ACTION_TYPE.TAKE_PHOTO]: '📸',
    [ACTION_TYPE.START_RECORD]: '⏺️',
    [ACTION_TYPE.STOP_RECORD]: '⏹️',
    [ACTION_TYPE.GIMBAL_PITCH]: '🔭',
    [ACTION_TYPE.AIRCRAFT_YAW]: '🧭',
    [ACTION_TYPE.HOVER]: '⏲️',
    [ACTION_TYPE.ZOOM]: '🔍',
    [ACTION_TYPE.START_TIMED_PHOTO]: '⏱️',
    [ACTION_TYPE.START_DISTANCE_PHOTO]: '📏',
    [ACTION_TYPE.STOP_INTERVAL_PHOTO]: '⏹️📸',
    [ACTION_TYPE.PANORAMA]: '🌐',
    [ACTION_TYPE.ORIENTED_PHOTO]: '🎯',
    [ACTION_TYPE.CUSTOM_DIR_NAME]: '📁',
    [ACTION_TYPE.RECORD_POINT_CLOUD]: '☁️',
    [ACTION_TYPE.SET_FOCUS_TYPE]: '🎯',
    [ACTION_TYPE.FOCUS]: '🔎',
    [ACTION_TYPE.GIMBAL_ANGLE_LOCK]: '🔒',
    [ACTION_TYPE.GIMBAL_ANGLE_UNLOCK]: '🔓',
    [ACTION_TYPE.SPOTLIGHT]: '🔦',
    [ACTION_TYPE.SPEAKER]: '📢',
    [ACTION_TYPE.SPEAKER]: '📢',
    [ACTION_TYPE.SMART_RECOGNITION]: '🧠',
    [ACTION_TYPE.START_TIME_LAPSE]: '🕓',
    [ACTION_TYPE.STOP_TIME_LAPSE]: '⏹️🕓'
};

/**
 * 默认动作参数 (对标司空 2)
 */
export const DEFAULT_ACTION_PARAMS = {
    [ACTION_TYPE.TAKE_PHOTO]: {
        payloadPositionIndex: 0
    },
    [ACTION_TYPE.START_RECORD]: {
        payloadPositionIndex: 0
    },
    [ACTION_TYPE.STOP_RECORD]: {
        payloadPositionIndex: 0
    },
    [ACTION_TYPE.GIMBAL_PITCH]: {
        gimbalPitchRotateAngle: -45,
        gimbalPitchRotateEnable: 1,
        payloadPositionIndex: 0
    },
    [ACTION_TYPE.AIRCRAFT_YAW]: {
        aircraftYawAngle: 0,
        aircraftRotateDirection: 0 // 0: 顺时针, 1: 逆时针
    },
    [ACTION_TYPE.HOVER]: {
        hoverTime: 10
    },
    [ACTION_TYPE.ZOOM]: {
        zoomFactor: 1.0,
        payloadPositionIndex: 0
    },
    [ACTION_TYPE.START_TIMED_PHOTO]: {
        photoInterval: 3,
        payloadPositionIndex: 0,
        payloadLensIndex: 'followRoute',
        endIndex: -1
    },
    [ACTION_TYPE.START_DISTANCE_PHOTO]: {
        photoDistanceInterval: 10,
        payloadPositionIndex: 0,
        payloadLensIndex: 'followRoute',
        endIndex: -1
    },
    [ACTION_TYPE.STOP_INTERVAL_PHOTO]: {
        payloadPositionIndex: 0
    },
    [ACTION_TYPE.PANORAMA]: {
        payloadPositionIndex: 0,
        subMode: 'pano_shot_360'
    },
    [ACTION_TYPE.ORIENTED_PHOTO]: {
        payloadPositionIndex: 0
    },
    [ACTION_TYPE.CUSTOM_DIR_NAME]: {
        payloadPositionIndex: 0,
        directoryName: 'DJI_001'
    },
    [ACTION_TYPE.RECORD_POINT_CLOUD]: {
        payloadPositionIndex: 0,
        pointCloudOperateType: 'start' // start, stop, pause, resume
    },
    [ACTION_TYPE.SET_FOCUS_TYPE]: {
        payloadPositionIndex: 0,
        cameraFocusType: 'manual' // manual, auto
    },
    [ACTION_TYPE.FOCUS]: {
        payloadPositionIndex: 0,
        focusX: 0,
        focusY: 0,
        focusRegionWidth: 0,
        focusRegionHeight: 0,
        isPointFocus: 0,
        isInfiniteFocus: 1,
        isCalibrationFocus: 0
    },
    [ACTION_TYPE.GIMBAL_ANGLE_LOCK]: {
        payloadPositionIndex: 0
    },
    [ACTION_TYPE.GIMBAL_ANGLE_UNLOCK]: {
        payloadPositionIndex: 0
    },
    [ACTION_TYPE.SPOTLIGHT]: {
        payloadPositionIndex: 0,
        spotlightMode: 'on', // on, off, blink
        spotlightBrightness: 100
    },
    [ACTION_TYPE.SPEAKER]: {
        payloadPositionIndex: 0,
        speakerMode: 'start', // start, stop, play_once
        speakerSoundId: 0,
        speakerVolume: 100
    },
    [ACTION_TYPE.SMART_RECOGNITION]: {
        payloadPositionIndex: 0,
        smartRecognitionMode: 'start', // start, stop
        smartRecognitionType: ['person', 'vehicle', 'boat'] // 司空 2 支持类型
    },
    [ACTION_TYPE.START_TIME_LAPSE]: {
        payloadPositionIndex: 0,
        photoInterval: 3,
        payloadLensIndex: 'visable' // visable, infrared
    },
    [ACTION_TYPE.STOP_TIME_LAPSE]: {
        payloadPositionIndex: 0
    }
};
