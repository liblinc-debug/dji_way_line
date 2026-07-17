# 航线生成接口文档

## 概述

用于外部系统通过 HTTP 方式调用本项目生成航线文件，并同步上传到 MinIO，最终返回可访问的下载地址。

## 基础地址

- 本地默认：`http://127.0.0.1:8088`
- 接口前缀：`/api/waylines`

## 接口列表

### 1. 健康检查

`GET /health`

#### 响应

```json
{
  "code": 0,
  "message": "ok"
}
```

### 2. 生成航线并上传 MinIO

`POST /api/waylines/generate`

#### 请求头

```http
Content-Type: application/json
```

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| missionName | string | 否 | 航线名称 |
| missionId | string | 否 | 任务 ID，用于生成文件名 |
| updatedAt | number | 否 | 时间戳，毫秒；不传则使用当前时间 |
| aircraftModel | string | 否 | 机型 ID，建议传这个 |
| config | object | 是 | 航线配置 |
| waypoints | array | 否 | 航点列表，航点航线必填 |
| boundaryPoints | array | 否 | 边界点，测绘/带状/斜面类航线可用 |

#### `config` 常用字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| routeType | string | `waypoint` / `patrol` / `mapping` / `strip` / `slope` / `geometry` |
| aircraftModel | string | 机型 ID，例如 `m4d`、`m4td`、`m4e`、`m4t` |
| missionName | string | 航线名称 |
| takeOffSecurityHeight | number | 起飞安全高度 |
| globalTransitionalSpeed | number | 过渡速度 |
| takeoffSpeed | number | 起飞速度 |
| finishAction | string | 结束动作 |
| exitOnRCLost | string | 失联处理 |
| executeRCLostAction | string | 失联执行动作 |
| takeOffPointLat | number | 起飞点纬度 |
| takeOffPointLng | number | 起飞点经度 |
| takeOffPointHeight | number | 起飞点高度 |

#### `waypoints` 示例字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| lat | number | 纬度 |
| lng | number | 经度 |
| height | number | 高度 |
| speed | number | 速度 |
| waypointTurnMode | string | 转弯模式 |

#### 请求示例

```json
{
  "missionName": "巡检航线A",
  "missionId": "10001",
  "updatedAt": 1718000000000,
  "aircraftModel": "m4d",
  "config": {
    "routeType": "waypoint",
    "aircraftModel": "m4d",
    "missionName": "巡检航线A",
    "takeOffSecurityHeight": 20,
    "globalTransitionalSpeed": 5,
    "takeoffSpeed": 5,
    "finishAction": "goHome",
    "exitOnRCLost": "executeLostAction",
    "executeRCLostAction": "goBack",
    "takeOffPointLat": 31.1,
    "takeOffPointLng": 104.1,
    "takeOffPointHeight": 10
  },
  "waypoints": [
    {
      "lat": 31.1001,
      "lng": 104.1001,
      "height": 20,
      "speed": 5,
      "waypointTurnMode": "toPointAndStopWithDiscontinuityCurvature"
    }
  ]
}
```

#### 响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "recordId": 1,
    "bucket": "demo-bucket",
    "objectKey": "wayline/saas_wailine/2026-06-10T08-15-47-784Z_10001_巡检航线A.kmz",
    "endpoint": "http://192.168.15.175:32090",
    "publicUrl": "http://192.168.15.175:32090/demo-bucket/wayline/saas_wailine/xxx.kmz",
    "signedUrl": "http://192.168.15.175:32090/demo-bucket/wayline/saas_wailine/xxx.kmz?...",
    "url": "http://192.168.15.175:32090/demo-bucket/wayline/saas_wailine/xxx.kmz?...",
    "record": {
      "id": 1,
      "missionId": "10001",
      "missionName": "巡检航线A",
      "routeType": "waypoint",
      "aircraftModel": "m4d",
      "bucket": "demo-bucket",
      "objectKey": "wayline/saas_wailine/xxx.kmz",
      "url": "http://192.168.15.175:32090/demo-bucket/wayline/saas_wailine/xxx.kmz?...",
      "createdAt": 1718000000000,
      "updatedAt": 1718000000000
    }
  }
}
```

生成成功后，后端会自动把 MinIO 文件信息写入 SQLite 数据库。

### 3. 查询航线文件记录

`GET /api/waylines/records`

#### 查询参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| missionId | string | 否 | 按父系统任务 ID 过滤 |
| limit | number | 否 | 每页数量，默认 50，最大 200 |
| offset | number | 否 | 分页偏移量，默认 0 |

#### 请求示例

```http
GET /api/waylines/records?missionId=10001
```

#### 响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": 1,
      "missionId": "10001",
      "missionName": "巡检航线A",
      "routeType": "waypoint",
      "aircraftModel": "m4d",
      "bucket": "demo-bucket",
      "objectKey": "wayline/saas_wailine/xxx.kmz",
      "endpoint": "http://192.168.15.175:32090",
      "publicUrl": "http://192.168.15.175:32090/demo-bucket/wayline/saas_wailine/xxx.kmz",
      "signedUrl": "http://192.168.15.175:32090/demo-bucket/wayline/saas_wailine/xxx.kmz?...",
      "url": "http://192.168.15.175:32090/demo-bucket/wayline/saas_wailine/xxx.kmz?...",
      "waypointCount": 1,
      "boundaryPointCount": 0,
      "createdAt": 1718000000000,
      "updatedAt": 1718000000000
    }
  ]
}
```

### 4. 查询单条航线文件记录

`GET /api/waylines/records/{id}`

#### 请求示例

```http
GET /api/waylines/records/1
```

## 机型 ID 说明

建议外部系统传入 `aircraftModel`，不是数字枚举。

常用值：

- `m30`
- `m30t`
- `m3e`
- `m3t`
- `m3m`
- `m3d`
- `m3td`
- `m4e`
- `m4t`
- `m4d`
- `m4td`
- `m400`

示例：

- `m4d` = Matrice 4D
- `m4td` = Matrice 4TD

## 错误返回

### 400

```json
{
  "code": 400,
  "message": "waypoints 不能为空"
}
```

### 500

```json
{
  "code": 500,
  "message": "Internal Server Error"
}
```

## 调用建议

1. 外部系统只传 `aircraftModel + routeType + waypoints/config`。
2. 你的后端负责生成 KMZ 并上传 MinIO。
3. 外部系统拿 `data.url` 直接下载即可。
