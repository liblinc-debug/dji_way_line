import * as turf from '@turf/turf';

/**
 * 相机视场 (Field of View) 计算工具
 * 模拟司空 2 中的 FOV 投影效果
 */

/**
 * 计算 FOV 投影在地面上的顶点坐标
 * @param {Object} dronePos 无人机 WGS84 坐标 {lng, lat, alt}
 * @param {Object} gimbalAtt 云台姿态 {yaw, pitch} (单位: 度)
 * @param {Object} cameraParam 相机参数 {hfov, vfov} (单位: 度)
 * @param {Number} groundAlt 地面高度 (默认为 0)
 * @returns {Array} 投影区域的经纬度顶点数组
 */
export const calculateFovFromFocalLength = (focalLength, sensorWidth = 6.4, sensorHeight = 4.8) => {
    // FOV = 2 * atan(sensorSize / (2 * focalLength))
    // 注意：这里的 focalLength 输入通常为 35mm 等效焦距
    // 如果输入是物理焦距，需配合物理传感器尺寸计算

    // 假设输入为 35mm 等效焦距，则传感器宽度基准为 36mm
    const hfovRad = 2 * Math.atan(36 / (2 * focalLength));

    // 假设传感器比例 4:3
    const vfovRad = 2 * Math.atan(27 / (2 * focalLength)); // 36 * (3/4) = 27

    return {
        hfov: (hfovRad * 180) / Math.PI,
        vfov: (vfovRad * 180) / Math.PI
    };
};

export const calculateFOVProjection = (dronePos, gimbalAtt, cameraParam, groundAlt = 0) => {
    const { lng, lat, alt } = dronePos;
    const { yaw, pitch } = gimbalAtt; // pitch 通常为负数 (下俯)
    const { hfov, vfov } = cameraParam;

    // 1. 无人机到地面的垂直高度
    const relativeHeight = alt - groundAlt;
    if (relativeHeight <= 0) return [];

    // 2. 将角度转换为弧度
    const toRad = (deg) => (deg * Math.PI) / 180;
    const radYaw = toRad(yaw);
    const radPitch = toRad(pitch);
    const radHFOV = toRad(hfov);
    const radVFOV = toRad(vfov);

    // 3. 计算相机本地坐标系下的四个角向量
    // 假设前方为 +Y (North), 右方为 +X (East), 上方为 +Z (Up)
    // 初步相机朝向为垂直向下 (-Z)

    // 计算半视角
    const halfH = Math.tan(radHFOV / 2);
    const halfV = Math.tan(radVFOV / 2);

    // 四个角的本地向量 (基于相机空间)
    const corners = [
        { x: -halfH, y: 1, z: halfV }, // 左上
        { x: halfH, y: 1, z: halfV },  // 右上
        { x: halfH, y: 1, z: -halfV }, // 右下
        { x: -halfH, y: 1, z: -halfV } // 左下
    ];

    // 4. 应用航向 (Yaw) 和 俯仰 (Pitch) 旋转映射
    // 这里的坐标变换逻辑：先俯仰，再偏航
    const projectPoint = (vec) => {
        // 俯仰旋转 (绕 X 轴)
        // 注意：大疆 Pitch 0 为水平，-90 为垂直向下
        let py = vec.y * Math.cos(radPitch) - vec.z * Math.sin(radPitch);
        let pz = vec.y * Math.sin(radPitch) + vec.z * Math.cos(radPitch);
        let px = vec.x;

        // 偏航旋转 (绕 Z 轴)
        let finalX = px * Math.cos(radYaw) + py * Math.sin(radYaw);
        let finalY = -px * Math.sin(radYaw) + py * Math.cos(radYaw);
        let finalZ = pz;

        // 计算射线与地平面的交点 t
        // 射线方程: P = Drone + t * Vector -> z_p = alt + t * finalZ = groundAlt

        // 修复关键：如果射线向上（finalZ >= 0）或角度极浅，给予一个较大的虚拟距离 (2000m)
        // 这样可以确保视锥在平视或仰视时依然能渲染出外形的边界，而不是直接消失
        let t;
        if (finalZ >= -0.1) {
            t = 2000; // 虚拟远点，覆盖大多数视觉场景
        } else {
            t = -relativeHeight / finalZ;
            // 限制最大距离，防止投影无限拉伸导致性能问题或视觉异常
            if (t > 3000) t = 3000;
        }

        if (!isFinite(t)) return null;

        const dx = finalX * t; // 东向距离偏移 (m)
        const dy = finalY * t; // 北向距离偏移 (m)

        // 使用 Turf.js 计算目标经纬度，确保在地球曲面上的精确度
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance === 0 || !isFinite(distance)) return { lng, lat };

        const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
        try {
            const destination = turf.destination(
                turf.point([lng, lat]),
                distance / 1000,
                bearing,
                { units: 'kilometers' }
            );

            const coords = destination.geometry.coordinates;
            if (!isFinite(coords[0]) || !isFinite(coords[1])) return null;

            return {
                lng: coords[0],
                lat: coords[1]
            };
        } catch (e) {
            return null;
        }
    };

    const projectionPoints = corners.map(projectPoint).filter(p => p !== null);

    // 闭合多边形
    if (projectionPoints.length > 0) {
        projectionPoints.push(projectionPoints[0]);
    }

    return projectionPoints;
};

/**
 * 计算相机的光心（Center Ray）投影点，确保双视锥共享中心
 */
export const calculateCenterPoint = (dronePos, gimbalAtt, groundAlt = 0) => {
    // 逻辑复用：投影相机坐标系下的 {x: 0, y: 1, z: 0} 向量
    const results = calculateFOVProjection(dronePos, gimbalAtt, { hfov: 0.1, vfov: 0.1 }, groundAlt);
    return results.length > 0 ? results[0] : null;
};

/**
 * 格式化为 GeoJSON 格式，由 Turf.js 或 OpenLayers/Cesium 直接使用
 */
export const getFOVGeoJSON = (points) => {
    return {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [points.map(p => [p.lng, p.lat])]
        },
        properties: {
            label: 'FOV Projection'
        }
    };
};
