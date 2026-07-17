/**
 * DJI 无人机相机参数定义
 * 用于 FOV 计算及模拟器视野模拟
 */

export const DRONE_CAMERA_SPECS = {
    // 经纬 M30 系列
    'm30': {
        zoom: {
            minFocalLength: 21.3, // mm (等效 35mm)
            maxFocalLength: 426,  // 200x 混合变焦，光学约 5-16x
            sensorWidth: 6.4,     // 1/2" CMOS (约 6.4mm 宽)
            sensorHeight: 4.8
        },
        wide: {
            focalLength: 24,
            sensorWidth: 6.4,
            sensorHeight: 4.8
        }
    },
    // 经纬 M30T (含热成像)
    'm30t': {
        zoom: {
            minFocalLength: 21.3,
            maxFocalLength: 426,
            sensorWidth: 6.4,
            sensorHeight: 4.8
        },
        wide: {
            focalLength: 24,
            sensorWidth: 6.4,
            sensorHeight: 4.8
        },
        thermal: {
            focalLength: 40, // 典型热成像等效焦距
            hfov: 40.6,
            vfov: 32.6
        }
    },
    // Mavic 3 行业系列
    'm3e': {
        wide: {
            focalLength: 24,
            sensorWidth: 17.3, // 4/3" CMOS (约 17.3mm 宽)
            sensorHeight: 13.0
        },
        tele: {
            focalLength: 162, // 等效焦距
            sensorWidth: 6.4,  // 1/2" CMOS
            sensorHeight: 4.8
        }
    },
    'm3t': {
        wide: {
            focalLength: 24,
            sensorWidth: 6.4, // 1/2" CMOS
            sensorHeight: 4.8
        },
        tele: {
            focalLength: 162,
            sensorWidth: 6.4,
            sensorHeight: 4.8
        }
    }
};

/**
 * 获取默认相机参数
 * @param {String} model 机型代码
 * @param {String} type 镜头类型 (zoom, wide, thermal)
 */
export const getCameraSpec = (model, type = 'zoom') => {
    const specs = DRONE_CAMERA_SPECS[model.toLowerCase()] || DRONE_CAMERA_SPECS['m30'];
    return specs[type] || specs['wide'] || specs['zoom'];
};
