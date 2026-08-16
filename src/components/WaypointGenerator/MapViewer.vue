<template>
  <div class="relative w-full h-full">
    <vc-viewer @ready="onViewerReadyInternal" v-model:camera="camera" :scene-mode="sceneMode" @left-click="onMapClick"
      :access-token="cesiumAccessToken" :animation="false" :timeline="false" :base-layer-picker="false"
      :fullscreen-button="false" :scene-mode-picker="false" :info-box="false" :selection-indicator="false"
      class="absolute inset-0">
      <vc-navigation></vc-navigation>
      <vc-compass-sm :auto-hidden="false" position="bottom" :offset="[200, 20]"></vc-compass-sm>
      <vc-zoom-control-sm position="bottom" :offset="[380, 60]"></vc-zoom-control-sm>

      <template v-if="cesiumInstance">
        <!-- Enhanced 3D Waypoints with Measurement HUD (只用于航点模式) -->
        <template v-if="props.routeType === 'waypoint' && (enhancedWaypoints || []).length > 0">
          <template v-for="(wp, index) in enhancedWaypoints" :key="'wp-group-' + index">
            <!-- 1. Vertical Dash Line -->
            <vc-entity>
              <vc-graphics-polyline :positions="[wp.cartesian, wp.groundCartesian]" :material="measurementLineMaterial"
                :width="1.0" />
            </vc-entity>

            <!-- 2. Dual-Height HUD Label (ASL/HAE) -->
            <vc-entity :position="wp.cartesian">
              <vc-graphics-label :text="'ASL: ' + wp.asl + ' m\nHAE: ' + Math.round(wp.hae || 0) + ' m'" :font="'bold 11px monospace'"
                :fillColor="'white'" :outlineColor="'black'" :outlineWidth="1" :showBackground="true"
                :backgroundColor="'rgba(0,0,0,0.75)'" :pixelOffset="[15, 20]" :horizontalOrigin="0" :verticalOrigin="0"
                :backgroundPadding="[5, 3]" />
            </vc-entity>

            <!-- 3. Waypoint Icon/Aircraft -->
            <vc-entity :position="wp.cartesian">
              <!-- Always show the cyan base point for better visibility -->
              <vc-graphics-point :pixelSize="14" :color="'#00f2ff'" :outlineColor="'white'" :outlineWidth="2.5"
                :disableDepthTestDistance="Number.POSITIVE_INFINITY"></vc-graphics-point>

              <!-- Show airplane icon as overlay when selected - Force Cyan color -->
              <vc-graphics-billboard v-if="selectedWpIndex === index" :image="PLANE_SVG" :scale="0.8"
                :rotation="selectedWpYawRad" :alignedAxis="cesiumInstance.Cartesian3.UNIT_Z" :color="'#00f2ff'"
                :disableDepthTestDistance="Number.POSITIVE_INFINITY"></vc-graphics-billboard>

              <!-- Label: Yellow background when selected for maximum contrast -->
              <vc-graphics-label :text="(index + 1).toString()" :font="'bold 14px sans-serif'" :pixelOffset="[0, -25]"
                :fillColor="'white'" :outlineColor="'black'" :outlineWidth="2" :showBackground="true"
                :backgroundColor="selectedWpIndex === index ? '#00f2ff' : 'rgba(0, 242, 255, 0.8)'"
                :backgroundPadding="[4, 4]" :disableDepthTestDistance="Number.POSITIVE_INFINITY"></vc-graphics-label>
            </vc-entity>

            <!-- 4. Ground Intersection Point -->
            <vc-entity :position="wp.groundCartesian">
              <vc-graphics-point :pixelSize="4" :color="'rgba(241, 196, 15, 0.6)'" />
            </vc-entity>
          </template>
        </template>

        <!-- 巡逻 / 测绘预览 -->
        <template v-if="props.isPatrolMode">
          <template v-if="isStripMode">
            <template v-for="coverage in stripCoverageAreaEntities" :key="'strip-coverage-' + coverage.key">
              <vc-entity v-if="coverage.positions.length > 2">
                <vc-graphics-polygon
                  :hierarchy="coverage.positions"
                  :material="coverage.fillColor"
                  :perPositionHeight="true"
                />
                <vc-graphics-polyline
                  :positions="coverage.positions"
                  :material="coverage.outlineColor"
                  :width="coverage.isActive ? 3.5 : 2.2"
                  :clampToGround="false"
                />
              </vc-entity>
            </template>

            <template v-for="segment in stripCuttingSegmentEntities" :key="'strip-cut-' + segment.key">
              <vc-entity>
                <vc-graphics-polyline
                  :positions="segment.positions"
                  :material="segment.color"
                  :width="1.8"
                  :clampToGround="false"
                />
              </vc-entity>
            </template>

            <template v-for="region in stripCenterlineGroups" :key="'strip-region-' + region.key">
              <vc-entity v-if="region.positions.length > 1">
                <vc-graphics-polyline
                  :positions="region.positions"
                  :material="region.color"
                  :width="region.isActive ? 3.2 : 2.2"
                  :clampToGround="false"
                />
              </vc-entity>
              <template v-for="point in region.points" :key="'strip-center-point-' + region.key + '-' + point.pointOrder">
                <vc-entity :position="point.cartesian">
                  <vc-graphics-point
                    :pixelSize="point.regionId === props.activeRegionId ? 12 : 9"
                    :color="point.regionId === props.activeRegionId ? '#4DA3FF' : 'rgba(77,163,255,0.65)'"
                    :outlineColor="'white'"
                    :outlineWidth="2"
                    :disableDepthTestDistance="Number.POSITIVE_INFINITY"
                  />
                </vc-entity>
              </template>
              <vc-entity v-if="region.labelPosition" :position="region.labelPosition">
                <vc-graphics-label
                  :text="String(region.regionOrder)"
                  :font="'bold 12px Arial'"
                  :fillColor="'white'"
                  :showBackground="true"
                  :backgroundColor="region.isActive ? '#4DA3FF' : 'rgba(77,163,255,0.7)'"
                  :backgroundPadding="[4,3]"
                  :disableDepthTestDistance="Number.POSITIVE_INFINITY"
                />
              </vc-entity>
            </template>

            <template v-if="isStripSingleMode">
              <template v-for="segment in stripSingleRouteSegments" :key="'strip-single-route-' + segment.key">
                <vc-entity v-if="segment.points.length > 1">
                  <vc-graphics-polyline
                    :positions="segment.points.map(p => p.cartesian)"
                    :material="getRouteSegmentMaterial(segment)"
                    :width="segment.isSelected ? 3.4 : 2.2"
                    :clampToGround="false"
                    :depthFailMaterial="getRouteSegmentDepthFailMaterial(segment)"
                  />
                </vc-entity>
              </template>
            </template>

            <template v-if="enhancedScanPath.length > 0">
              <template v-for="segment in stripVisibleWaylineSegments" :key="'strip-scan-segment-' + segment.key">
                <vc-entity v-if="segment.points.length > 1">
                  <vc-graphics-polyline
                    :positions="segment.points.map(p => p.cartesian)"
                    :material="getRouteSegmentMaterial(segment)"
                    :width="segment.isSelected ? 3.2 : 2.3"
                    :clampToGround="false"
                    :depthFailMaterial="getRouteSegmentDepthFailMaterial(segment)"
                  />
                </vc-entity>
              </template>
              <vc-entity :position="enhancedScanPath[0].cartesian">
                <vc-graphics-point :pixelSize="20" :color="'rgba(0, 122, 255, 1.0)'" :outlineColor="'white'"
                  :outlineWidth="2" :disableDepthTestDistance="Number.POSITIVE_INFINITY" />
                <vc-graphics-label text="S" :font="'bold 12px Arial'" :fillColor="'white'"
                  :disableDepthTestDistance="Number.POSITIVE_INFINITY" />
              </vc-entity>
            </template>
          </template>

          <template v-else>
            <!-- 1. 扫描路径 (Flight Route) - Bright Green -->
            <template v-if="visibleEnhancedScanPath.length > 0">
              <template v-for="segment in visibleScanPathSegments" :key="'scan-segment-' + segment.key">
                <vc-entity v-if="segment.points.length > 1">
                  <vc-graphics-polyline :positions="segment.points.map(p => p.cartesian)"
                    :material="getRouteSegmentMaterial(segment)" :width="3.5" :clampToGround="false"
                    :depthFailMaterial="getRouteSegmentDepthFailMaterial(segment)" />
                </vc-entity>
              </template>

              <vc-entity :position="visibleEnhancedScanPath[0].cartesian">
                <vc-graphics-point :pixelSize="20" :color="'rgba(0, 122, 255, 1.0)'" :outlineColor="'white'"
                  :outlineWidth="2" :disableDepthTestDistance="Number.POSITIVE_INFINITY" />
                <vc-graphics-label text="S" :font="'bold 12px Arial'" :fillColor="'white'"
                  :disableDepthTestDistance="Number.POSITIVE_INFINITY" />
              </vc-entity>

              <template v-for="(p, idx) in visibleEnhancedScanPath" :key="'scan-wp-' + idx">
                <vc-entity :position="p.cartesian">
                  <vc-graphics-point :pixelSize="isMappingMode ? 3 : 4" :color="'white'" :outlineColor="'rgba(0, 255, 127, 1.0)'"
                    :outlineWidth="1.5" :disableDepthTestDistance="Number.POSITIVE_INFINITY" />
                  <vc-graphics-label v-if="!isMappingMode && idx % 5 === 0" :text="(Math.round(p.asl || 0)) + 'm'" :font="'9px monospace'"
                    :fillColor="'white'" :showBackground="true" :backgroundColor="'rgba(0,0,0,0.7)'"
                    :pixelOffset="[0, 15]" :verticalOrigin="0" :backgroundPadding="[3, 1]"
                    :disableDepthTestDistance="Number.POSITIVE_INFINITY" />
                </vc-entity>
              </template>
            </template>

            <template v-if="isGeometryMode">
              <template v-for="wall in geometryWallPolygons" :key="'geometry-wall-' + wall.key">
                <vc-entity>
                  <vc-graphics-polygon
                    :hierarchy="wall.positions"
                    :material="'rgba(77, 163, 255, 0.12)'"
                    :perPositionHeight="true"
                  />
                </vc-entity>
              </template>

              <vc-entity v-if="geometryBottomOutlinePositions.length > 1">
                <vc-graphics-polyline :positions="geometryBottomOutlinePositions" :material="'rgba(77, 163, 255, 0.9)'"
                  :width="3.0" :clampToGround="false" />
              </vc-entity>

              <vc-entity v-if="geometryTopOutlinePositions.length > 1">
                <vc-graphics-polyline :positions="geometryTopOutlinePositions" :material="'rgba(77, 163, 255, 0.95)'"
                  :width="3.0" :clampToGround="false" />
              </vc-entity>

              <template v-for="edge in geometryVerticalEdges" :key="'geometry-edge-' + edge.key">
                <vc-entity>
                  <vc-graphics-polyline :positions="edge.positions" :material="'rgba(77, 163, 255, 0.8)'"
                    :width="2.0" :clampToGround="false" />
                </vc-entity>
              </template>
            </template>

            <template v-if="isSlopeMode">
              <vc-entity v-if="slopeSurfacePositions.length > 2">
                <vc-graphics-polygon
                  :hierarchy="slopeSurfacePositions"
                  :material="'rgba(255, 0, 255, 0.16)'"
                  :perPositionHeight="true"
                />
              </vc-entity>

              <vc-entity v-if="slopeSurfaceOutlinePositions.length > 1">
                <vc-graphics-polyline
                  :positions="slopeSurfaceOutlinePositions"
                  :material="'rgba(255, 0, 255, 0.95)'"
                  :width="3.5"
                  :clampToGround="false"
                />
              </vc-entity>

              <vc-entity v-if="slopeBottomEdgePositions.length > 1">
                <vc-graphics-polyline
                  :positions="slopeBottomEdgePositions"
                  :material="'rgba(77, 163, 255, 0.95)'"
                  :width="3.0"
                  :clampToGround="false"
                />
              </vc-entity>
            </template>

            <template v-for="(wp, index) in enhancedBoundaryWaypoints" :key="'patrol-wp-' + index">
              <vc-entity>
                <vc-graphics-polyline :positions="[wp.cartesian, wp.groundCartesian]" :material="measurementLineMaterial"
                  :width="1.2" />
              </vc-entity>

              <vc-entity :position="wp.cartesian">
                <vc-graphics-label :text="(Math.round(wp.asl || 0)) + ' m'" :font="'bold 10px Arial'" :fillColor="'white'"
                  :showBackground="true" :backgroundColor="'rgba(0,0,0,0.85)'" :pixelOffset="[15, 10]"
                  :horizontalOrigin="-1" :verticalOrigin="0" :backgroundPadding="[5, 2]"
                  :disableDepthTestDistance="Number.POSITIVE_INFINITY" />
                <vc-graphics-point :pixelSize="14" :color="boundaryPointColor" :outlineColor="'white'"
                  :outlineWidth="2" :disableDepthTestDistance="Number.POSITIVE_INFINITY" />
                <vc-graphics-label :text="(index + 1).toString()" :font="'bold 10px Arial'" :fillColor="'white'"
                  :disableDepthTestDistance="Number.POSITIVE_INFINITY" />
              </vc-entity>

              <vc-entity :position="wp.groundCartesian">
                <vc-graphics-point :pixelSize="5" :color="boundaryGroundPointColor" />
              </vc-entity>
            </template>

            <vc-entity v-if="props.waypoints.length > 1 && !isGeometryMode && !isSlopeMode">
              <vc-graphics-polyline :positions="closedBoundaryPositions" :material="boundaryLineColor" :width="4.0"
                :clampToGround="false" />
            </vc-entity>

            <vc-entity v-if="props.waypoints.length > 2 && !isGeometryMode && !isSlopeMode">
              <vc-graphics-polygon :hierarchy="closedBoundaryPositions" :material="boundaryFillColor"
                :perPositionHeight="true" />
            </vc-entity>
          </template>
        </template>

        <!-- 3D FOV Frustum (Wide - Yellow) -->
        <template v-if="isFovVisible && wideFovData.frustum && fovDronePosition">
          <!-- 1. Geometric Side Walls (Explicit polygons for much better stability) -->
          <template v-for="(p, i) in wideFovData.rawPoints" :key="'wide-side-' + i">
            <vc-entity :disableDepthTestDistance="Number.POSITIVE_INFINITY">
              <vc-graphics-polygon
                :hierarchy="[fovDronePosition, p, wideFovData.rawPoints[(i + 1) % wideFovData.rawPoints.length]]"
                :material="'rgba(255, 255, 0, 0.08)'" :perPositionHeight="true" />
              <!-- Connector Ribs -->
              <vc-graphics-polyline :positions="[fovDronePosition, p]" :material="'rgba(255, 255, 0, 0.4)'"
                :width="1.0" />
            </vc-entity>
          </template>

          <!-- 2. Ground Border (Using Entity for better stability) -->
          <vc-entity v-if="wideFovData.points.length > 0">
            <vc-graphics-polyline :positions="wideFovData.points" :clampToGround="true"
              :material="wideFovData.lineAttributes.color.value" :width="1.2" />
          </vc-entity>

          <!-- 3. Ground Fill (Using Entity for better stability) -->
          <vc-entity v-if="wideFovData.points.length > 0">
            <vc-graphics-polygon :hierarchy="wideFovData.points"
              :material="wideFovData.appearance.material.uniforms.color" :heightReference="1" />
          </vc-entity>
        </template>

        <!-- 3D FOV Frustum (Zoom - Green) -->
        <template v-if="isFovVisible && zoomFovData.frustum && fovDronePosition">
          <!-- 1. Geometric Side Walls -->
          <template v-for="(p, i) in zoomFovData.rawPoints" :key="'zoom-side-' + i">
            <vc-entity :disableDepthTestDistance="Number.POSITIVE_INFINITY">
              <vc-graphics-polygon
                :hierarchy="[fovDronePosition, p, zoomFovData.rawPoints[(i + 1) % zoomFovData.rawPoints.length]]"
                :material="'rgba(0, 255, 0, 0.15)'" :perPositionHeight="true" />
              <!-- Connector Ribs -->
              <vc-graphics-polyline :positions="[fovDronePosition, p]" :material="'rgba(0, 255, 0, 0.8)'"
                :width="1.5" />
            </vc-entity>
          </template>

          <!-- 2. Ground Border (Using Entity) -->
          <vc-entity v-if="zoomFovData.points.length > 0">
            <vc-graphics-polyline :positions="zoomFovData.points" :clampToGround="true"
              :material="zoomFovData.lineAttributes.color.value" :width="2.0" />
          </vc-entity>

          <!-- 3. Ground Fill (Using Entity) -->
          <vc-entity v-if="zoomFovData.points.length > 0">
            <vc-graphics-polygon :hierarchy="zoomFovData.points"
              :material="zoomFovData.appearance.material.uniforms.color" :heightReference="1" />
          </vc-entity>
        </template>

        <template v-if="virtualDroneVisible && virtualWideFovData.frustum && virtualDronePosition">
          <template v-for="(p, i) in virtualWideFovData.rawPoints" :key="'virtual-wide-side-' + i">
            <vc-entity :disableDepthTestDistance="Number.POSITIVE_INFINITY">
              <vc-graphics-polygon
                :hierarchy="[virtualDronePosition, p, virtualWideFovData.rawPoints[(i + 1) % virtualWideFovData.rawPoints.length]]"
                :material="'rgba(0, 170, 255, 0.08)'"
                :perPositionHeight="true"
              />
              <vc-graphics-polyline
                :positions="[virtualDronePosition, p]"
                :material="'rgba(0, 170, 255, 0.4)'"
                :width="1.0"
              />
            </vc-entity>
          </template>

          <vc-entity v-if="virtualWideFovData.points.length > 0">
            <vc-graphics-polyline
              :positions="virtualWideFovData.points"
              :clampToGround="true"
              :material="virtualWideFovData.lineAttributes.color.value"
              :width="1.2"
            />
          </vc-entity>

          <vc-entity v-if="virtualWideFovData.points.length > 0">
            <vc-graphics-polygon
              :hierarchy="virtualWideFovData.points"
              :material="virtualWideFovData.appearance.material.uniforms.color"
              :heightReference="1"
            />
          </vc-entity>
        </template>

        <template v-if="virtualDroneVisible && virtualZoomFovData.frustum && virtualDronePosition">
          <template v-for="(p, i) in virtualZoomFovData.rawPoints" :key="'virtual-zoom-side-' + i">
            <vc-entity :disableDepthTestDistance="Number.POSITIVE_INFINITY">
              <vc-graphics-polygon
                :hierarchy="[virtualDronePosition, p, virtualZoomFovData.rawPoints[(i + 1) % virtualZoomFovData.rawPoints.length]]"
                :material="'rgba(0, 242, 255, 0.16)'"
                :perPositionHeight="true"
              />
              <vc-graphics-polyline
                :positions="[virtualDronePosition, p]"
                :material="'rgba(0, 242, 255, 0.85)'"
                :width="1.5"
              />
            </vc-entity>
          </template>

          <vc-entity v-if="virtualZoomFovData.points.length > 0">
            <vc-graphics-polyline
              :positions="virtualZoomFovData.points"
              :clampToGround="true"
              :material="virtualZoomFovData.lineAttributes.color.value"
              :width="2.0"
            />
          </vc-entity>

          <vc-entity v-if="virtualZoomFovData.points.length > 0">
            <vc-graphics-polygon
              :hierarchy="virtualZoomFovData.points"
              :material="virtualZoomFovData.appearance.material.uniforms.color"
              :heightReference="1"
            />
          </vc-entity>
        </template>

        <template v-if="virtualDroneVisible && virtualDronePosition">
          <vc-entity :position="virtualDronePosition">
            <vc-graphics-billboard
              :image="PLANE_SVG"
              :scale="0.85"
              :rotation="virtualDroneYawRad"
              :alignedAxis="cesiumInstance.Cartesian3.UNIT_Z"
              :color="virtualDroneColor"
              :disableDepthTestDistance="Number.POSITIVE_INFINITY"
            />
            <vc-graphics-label
              text="V"
              :font="'bold 12px Arial'"
              :fillColor="'white'"
              :showBackground="true"
              :backgroundColor="'rgba(0, 153, 255, 0.85)'"
              :backgroundPadding="[4, 3]"
              :pixelOffset="[0, -28]"
              :disableDepthTestDistance="Number.POSITIVE_INFINITY"
            />
          </vc-entity>
        </template>

        <!-- Route playback camera FOV: 24 mm wide reference (yellow) -->
        <template v-if="previewReady && previewShowWideFov && routePreviewWideFovData.frustum && routePreviewDronePosition">
          <template v-if="sceneMode === 3" v-for="(p, i) in routePreviewWideFovData.rawPoints" :key="'route-wide-side-' + i">
            <vc-entity :disableDepthTestDistance="Number.POSITIVE_INFINITY">
              <vc-graphics-polygon
                :hierarchy="[routePreviewDronePosition, p, routePreviewWideFovData.rawPoints[(i + 1) % routePreviewWideFovData.rawPoints.length]]"
                :material="'rgba(255, 255, 0, 0.08)'"
                :perPositionHeight="true"
              />
              <vc-graphics-polyline
                :positions="[routePreviewDronePosition, p]"
                :material="'rgba(255, 255, 0, 0.45)'"
                :width="3.0"
              />
            </vc-entity>
          </template>
          <vc-entity v-if="routePreviewWideFovData.points.length > 0">
            <vc-graphics-polyline
              :positions="routePreviewWideFovData.points"
              :clampToGround="sceneMode === 2"
              :material="routePreviewWideFovData.lineAttributes.color.value"
              :width="4.0"
            />
          </vc-entity>
          <vc-entity v-if="routePreviewWideFovData.points.length > 0">
            <vc-graphics-polygon
              :hierarchy="routePreviewWideFovData.points"
              :material="routePreviewWideFovData.appearance.material.uniforms.color"
              :perPositionHeight="sceneMode === 3"
              :heightReference="sceneMode === 2 ? 1 : 0"
            />
          </vc-entity>
        </template>

        <!-- Route playback current zoom FOV (green) -->
        <template v-if="previewReady && previewShowZoomFov && routePreviewZoomFovData.frustum && routePreviewDronePosition">
          <template v-if="sceneMode === 3" v-for="(p, i) in routePreviewZoomFovData.rawPoints" :key="'route-zoom-side-' + i">
            <vc-entity :disableDepthTestDistance="Number.POSITIVE_INFINITY">
              <vc-graphics-polygon
                :hierarchy="[routePreviewDronePosition, p, routePreviewZoomFovData.rawPoints[(i + 1) % routePreviewZoomFovData.rawPoints.length]]"
                :material="'rgba(0, 255, 0, 0.15)'"
                :perPositionHeight="true"
              />
              <vc-graphics-polyline
                :positions="[routePreviewDronePosition, p]"
                :material="'rgba(0, 255, 0, 0.85)'"
                :width="1.5"
              />
            </vc-entity>
          </template>
          <vc-entity v-if="routePreviewZoomFovData.points.length > 0">
            <vc-graphics-polyline
              :positions="routePreviewZoomFovData.points"
              :clampToGround="sceneMode === 2"
              :material="routePreviewZoomFovData.lineAttributes.color.value"
              :width="2.0"
            />
          </vc-entity>
          <vc-entity v-if="routePreviewZoomFovData.points.length > 0">
            <vc-graphics-polygon
              :hierarchy="routePreviewZoomFovData.points"
              :material="routePreviewZoomFovData.appearance.material.uniforms.color"
              :perPositionHeight="sceneMode === 3"
              :heightReference="sceneMode === 2 ? 1 : 0"
            />
          </vc-entity>
        </template>

        <!-- Waypoint Route Polyline (Hidden in Patrol Mode to avoid color conflict) -->
        <template v-if="!props.isPatrolMode && waypointRouteSegments.length > 0">
          <vc-entity v-for="segment in waypointRouteSegments" :key="'waypoint-route-' + segment.key">
            <vc-graphics-polyline
              :positions="segment.points.map(p => p.cartesian)"
              :material="segment.isUnderground ? undergroundRouteMaterial : '#00f2ff'"
              :width="3"
              :clampToGround="false"
              :depthFailMaterial="segment.isUnderground ? undergroundRouteDepthFailMaterial : '#00f2ff'"
            ></vc-graphics-polyline>
          </vc-entity>
        </template>

        <!-- Center Metrics (Active FOV Only) -->
        <template v-if="selectedWpIndex !== -1 && fovCenterPoint && fovDronePosition">
          <vc-entity>
            <vc-graphics-polyline :positions="[fovDronePosition, fovCenterPoint]" :material="centerLineMaterial"
              :width="1.8" :zIndex="10" />
          </vc-entity>
        </template>
      </template>
    </vc-viewer>

    <!-- UI Overlay Info -->
    <div @mousemove.stop
      class="absolute bottom-0 left-0 right-0 h-7 bg-[#0a0a0ae6] backdrop-blur-md flex items-center justify-between px-6 text-[10px] text-gray-400 font-mono z-20 select-none border-t border-white/5">
      <div class="flex gap-6 items-center">
        <div class="flex gap-2 items-center"><span
            class="text-gray-600 font-bold uppercase scale-75 origin-left">纬度</span><span class="text-white">{{
              hoverPos.lat.toFixed(8) }}°</span></div>
        <div class="flex gap-2 items-center border-l border-gray-800 pl-6"><span
            class="text-gray-600 font-bold uppercase scale-75 origin-left">经度</span><span class="text-white">{{
              hoverPos.lng.toFixed(8) }}°</span></div>
      </div>
      <div class="flex gap-6 items-center">
        <div class="flex gap-2 items-center"><span class="text-gray-600 scale-75 origin-right font-bold">海拔</span><span
            class="text-green-400 font-black">{{ hoverPos.asl.toFixed(1) }}m</span></div>
        <div class="flex gap-2 items-center border-l border-gray-800 pl-6"><span
            class="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span><span
            class="text-[9px] font-bold text-gray-500 uppercase">WGS84</span></div>
      </div>
    </div>

    <div
      v-if="showWaylineSelector"
      class="absolute left-6 top-1/2 z-30 flex -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-white/25 bg-black/55 shadow-lg backdrop-blur-md pointer-events-auto"
      :style="waylineSelectorStyle"
    >
      <button
        v-for="group in selectableWaylineGroups"
        :key="'wayline-switch-' + group.key"
        type="button"
        class="min-h-9 min-w-9 border-0 px-3 text-sm font-semibold text-white transition-colors"
        :class="group.key === selectedWaylineKey ? 'bg-[#4d8dff]' : 'bg-transparent hover:bg-white/10'"
        @click.stop="selectWaylineGroup(group.key)"
      >
        {{ group.label }}
      </button>
    </div>

    <div
      class="absolute top-4 z-30 flex items-center gap-2 rounded-lg border border-white/25 bg-black/60 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-md pointer-events-auto"
      :style="mapControlStyle"
      @click.stop
    >
      <span class="font-semibold">地图</span>
      <select
        v-model="mapMode"
        class="rounded border border-white/20 bg-black/50 px-2 py-1 text-xs text-white outline-none"
        :disabled="mapLoading"
        @change="applyMapMode"
      >
        <option value="standard">标准地图</option>
        <option value="buildings">ArcGIS 影像 + 3D 白模</option>
      </select>
      <span v-if="mapLoading" class="text-amber-300">加载中…</span>
      <span v-else-if="mapStatus" class="max-w-52 truncate text-gray-300" :title="mapStatus">{{ mapStatus }}</span>
    </div>

    <div
      v-if="canPreviewRoute"
      class="absolute top-16 z-30 w-[360px] rounded-xl border border-white/20 bg-black/70 p-3 text-white shadow-2xl backdrop-blur-md pointer-events-auto"
      :style="mapControlStyle"
      @click.stop
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-bold">航线贴楼飞行预览</div>
          <div class="mt-0.5 text-[10px] text-gray-400">固定间距重采样建筑表面，预览数据不会修改导出航点</div>
        </div>
        <button
          type="button"
          class="shrink-0 rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="previewPreparing || mapMode !== 'buildings'"
          @click="prepareRoutePreview"
        >
          {{ previewPreparing ? '采样中…' : (previewReady ? '重新采样' : '生成预览') }}
        </button>
      </div>

      <div v-if="mapMode !== 'buildings' && !previewReady" class="mt-2 rounded bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-200">
        请先选择“ArcGIS 影像 + 3D 白模”。
      </div>
      <div v-else-if="previewError" class="mt-2 rounded bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">
        {{ previewError }}
      </div>
      <div v-else-if="previewReady && sceneMode === 2" class="mt-2 rounded bg-blue-400/10 px-2 py-1.5 text-[11px] text-blue-100">
        当前为 2D 俯视预览；切换到 3D 后将使用透视无人机图标。
      </div>

      <template v-if="previewReady">
        <div class="mt-3 grid grid-cols-4 gap-2 text-center">
          <div class="rounded bg-white/5 px-1 py-1.5"><div class="text-[9px] text-gray-400">航点</div><div class="font-mono text-xs">{{ previewStats.waypointCount }}</div></div>
          <div class="rounded bg-white/5 px-1 py-1.5"><div class="text-[9px] text-gray-400">长度</div><div class="font-mono text-xs">{{ previewStats.distanceLabel }}</div></div>
          <div class="rounded bg-white/5 px-1 py-1.5"><div class="text-[9px] text-gray-400">时长</div><div class="font-mono text-xs">{{ previewStats.durationLabel }}</div></div>
          <div class="rounded bg-white/5 px-1 py-1.5"><div class="text-[9px] text-gray-400">速度</div><div class="font-mono text-xs">{{ previewSpeed }}m/s</div></div>
        </div>
        <div v-if="previewAltitudeAdjustedCount > 0" class="mt-2 rounded bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-100">
          {{ previewAltitudeModeLabel }}：检测到 {{ previewAltitudeAdjustedCount }} 个采样点低于建筑安全高度，最大自动抬升 {{ previewMaxAltitudeAdjustment.toFixed(1) }}m。
        </div>
        <div v-else class="mt-2 rounded bg-emerald-400/10 px-2 py-1.5 text-[11px] text-emerald-100">
          {{ previewAltitudeModeLabel }}：模拟飞行高度与规划高度一致。
        </div>
        <div class="mt-2 rounded border border-white/10 bg-black/20 px-2 py-2 text-[10px] text-gray-200">
          <div class="mb-1.5 text-gray-400">视场显示（默认关闭）</div>
          <div class="flex items-center justify-between gap-3">
            <label class="flex cursor-pointer items-center gap-1.5">
              <input v-model="previewShowWideFov" type="checkbox" class="h-3.5 w-3.5 accent-yellow-400" />
              <i class="h-2.5 w-2.5 rounded-sm border border-yellow-200 bg-yellow-400/40"></i>
              <span>黄色：广角基准 24 mm</span>
            </label>
            <span class="font-mono text-yellow-100">固定最大取景范围</span>
          </div>
          <div class="mt-1 flex items-center justify-between gap-3">
            <label class="flex cursor-pointer items-center gap-1.5">
              <input v-model="previewShowZoomFov" type="checkbox" class="h-3.5 w-3.5 accent-green-400" />
              <i class="h-2.5 w-2.5 rounded-sm border border-green-200 bg-green-400/40"></i>
              <span>绿色：当前变焦视场</span>
            </label>
            <span class="font-mono text-green-100">{{ previewZoomFactor.toFixed(1) }}× / {{ previewFocalLength.toFixed(1) }} mm</span>
          </div>
          <div class="mt-1 text-gray-400">两者共享飞机航向与云台俯仰（当前 {{ previewGimbalPitch.toFixed(1) }}°）；1× 变焦时两区域重合。</div>
        </div>

        <input
          class="mt-3 w-full accent-blue-500"
          type="range"
          min="0"
          max="100"
          step="0.1"
          :value="previewProgress"
          @input="seekRoutePreview($event.target.value)"
        />

        <div class="mt-2 flex items-center gap-2">
          <button type="button" class="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-400" @click="toggleRoutePreview">
            {{ previewPlaying ? '暂停' : (previewFinished ? '回放' : '播放') }}
          </button>
          <button type="button" class="rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20" @click="resetRoutePreview">回到起点</button>
          <select v-model.number="previewSpeed" class="rounded border border-white/20 bg-black/50 px-2 py-1.5 text-xs text-white outline-none">
            <option :value="2">2 m/s</option>
            <option :value="5">5 m/s</option>
            <option :value="10">10 m/s</option>
            <option :value="15">15 m/s</option>
            <option :value="20">20 m/s</option>
          </select>
          <select v-model="previewViewMode" class="ml-auto rounded border border-white/20 bg-black/50 px-2 py-1.5 text-xs text-white outline-none">
            <option value="first">第一人称</option>
            <option value="third">第三人称</option>
          </select>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ACTION_TYPE } from '../../types/waypointRoute.js';
import { calculateCenterPoint, calculateFOVProjection, calculateFovFromFocalLength } from '../../utils/fovCalculator';
import { createDronePreviewIcons } from '../../utils/dronePreviewIcon.js';
import { PLANE_SVG } from './constants';

// --- 1. Props & Emits ---
const props = defineProps({
  waypoints: { type: Array, default: () => [] },
  isClosedLoop: Boolean,
  isPatrolMode: Boolean,
  scanPath: { type: Array, default: () => [] },
  coverageArea: { type: Array, default: () => [] },
  cuttingSegments: { type: Array, default: () => [] },
  routeType: { type: String, default: 'waypoint' },
  selectedWpIndex: { type: Number, default: -1 },
  executeHeightMode: { type: String, default: 'relativeToStartPoint' },
  takeoffPoint: { type: Object, default: null },
  activeRegionId: { type: Number, default: 1 },
  stripRouteMode: { type: String, default: 'zigzag' },
  geometryConfig: { type: Object, default: () => ({}) },
  slopeConfig: { type: Object, default: () => ({}) },
  leftOverlayOffset: { type: Number, default: 0 },
  previewMode: { type: String, default: 'idle' }
});

const emit = defineEmits(['map-click', 'fly-to', 'context-menu', 'insert-waypoint', 'update:takeoffHeight']);
const cesiumAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyZWRkYjY5MC1kOTAwLTQwMmYtYmUyYi0yM2JlNjU5YjVkYTAiLCJpZCI6MTY1MzMxLCJpYXQiOjE2OTQxNzY5Nzh9.MGD5_U2P3_spf9VQlJTFm3elXcVRI0zzC-v9VKTA7c4';

// --- 2. Reactive State (Refs) ---
const cesiumInstance = ref(null);
const viewerInstance = ref(null);
const eventHandler = ref(null);
const sceneMode = ref(2); // 2: SCENE2D, 3: SCENE3D
const isFovVisible = ref(false);
const hoverPos = ref({ lat: 0, lng: 0, asl: 0, hae: 0 });

const camera = ref(props.waypoints?.length > 0 && props.waypoints[0]?.lng != null && props.waypoints[0]?.lat != null
  ? { position: { lng: props.waypoints[0].lng, lat: props.waypoints[0].lat, height: 1000 }, heading: 0, pitch: -90, roll: 0 }
  : { position: { lng: 104.39, lat: 31.09, height: 1000000 }, heading: 0, pitch: -90, roll: 0 }
);
const hasAutoLocated = ref(false);
const mapMode = ref('standard');
const mapLoading = ref(false);
const mapStatus = ref('ArcGIS 影像 · WGS84 · Cesium 地形');
const previewPreparing = ref(false);
const previewError = ref('');
const previewPathVersion = ref(0);
const previewPlaying = ref(false);
const previewFinished = ref(false);
const previewProgress = ref(0);
const previewSpeed = ref(10);
const previewViewMode = ref('third');
const previewTotalDistance = ref(0);
const previewAltitudeAdjustedCount = ref(0);
const previewMaxAltitudeAdjustment = ref(0);

let mapSwitchSequence = 0;
let buildingTileset = null;
let previewRouteEntity = null;
let previewDroneEntity = null;
let previewHeadingEntity = null;
let previewPath = [];
let previewCameraStates = [];
let previewSurfaceHeights = [];
let previewCumulativeDistances = [];
let previewDistance = 0;
let previewRafId = 0;
let previewLastTimestamp = 0;
let previewVisualPosition = null;
let previewHeadingTip = null;
let previewVisualHeading = 0;
let previewScreenRotation = 0;
let previewDroneIcons = null;
let previewIconSceneMode = null;
let previewLastFovUpdateAt = 0;
let previewCameraFollowMode = 'idle';
let previewThirdPersonRange = 100;
let preview2DFrustumWidth = 0;

const wideFovData = ref({ points: [], rawPoints: [], altitude: 0, absAltitude: 0, params: null, frustum: null, orientation: null, modelMatrix: null, appearance: null, lineAppearance: null, lineAttributes: null });
const zoomFovData = ref({ points: [], rawPoints: [], altitude: 0, absAltitude: 0, params: null, frustum: null, orientation: null, modelMatrix: null, appearance: null, lineAppearance: null, lineAttributes: null });
const virtualWideFovData = ref({ points: [], rawPoints: [], altitude: 0, absAltitude: 0, params: null, frustum: null, orientation: null, modelMatrix: null, appearance: null, lineAppearance: null, lineAttributes: null });
const virtualZoomFovData = ref({ points: [], rawPoints: [], altitude: 0, absAltitude: 0, params: null, frustum: null, orientation: null, modelMatrix: null, appearance: null, lineAppearance: null, lineAttributes: null });
const routePreviewWideFovData = ref({ points: [], rawPoints: [], altitude: 0, absAltitude: 0, params: null, frustum: null, orientation: null, modelMatrix: null, appearance: null, lineAppearance: null, lineAttributes: null });
const routePreviewZoomFovData = ref({ points: [], rawPoints: [], altitude: 0, absAltitude: 0, params: null, frustum: null, orientation: null, modelMatrix: null, appearance: null, lineAppearance: null, lineAttributes: null });

const fovDronePosition = ref(null);
const virtualDronePosition = ref(null);
const virtualDroneYawRad = ref(0);
const virtualDroneColor = ref('#00aaff');
const virtualDroneVisible = ref(false);
const routePreviewDronePosition = ref(null);
const previewGimbalPitch = ref(-45);
const previewZoomFactor = ref(1);
const previewShowWideFov = ref(false);
const previewShowZoomFov = ref(false);
const fovPreviewMode = ref('idle');
const pendingFovState = ref(null);
const pendingVirtualFlightState = ref(null);
const centerLineMaterial = ref(null);
const measurementLineMaterial = ref(null);
const centerPointRaw = ref(null);

const UNDERGROUND_ROUTE_THRESHOLD_METERS = -0.5;
const ROUTE_SOLID_MATERIAL = 'rgba(0, 255, 127, 0.9)';
const ROUTE_SOLID_DEPTH_FAIL_MATERIAL = 'rgba(0, 255, 127, 0.4)';
const STRIP_ROUTE_SELECTED_MATERIAL = 'rgba(77, 255, 166, 0.95)';
const STRIP_ROUTE_MUTED_MATERIAL = 'rgba(77, 255, 166, 0.62)';
const STRIP_ROUTE_DEPTH_FAIL_MATERIAL = 'rgba(77, 255, 166, 0.45)';

const createDashedRouteMaterial = (color, dashLength = 18) => {
  const Cesium = cesiumInstance.value;
  if (!Cesium?.PolylineDashMaterialProperty || !Cesium?.Color) {
    return color;
  }

  return markRaw(new Cesium.PolylineDashMaterialProperty({
    color: Cesium.Color.fromCssColorString(color),
    dashLength
  }));
};

const undergroundRouteMaterial = computed(() => createDashedRouteMaterial('rgba(255, 122, 89, 0.95)'));
const undergroundRouteDepthFailMaterial = computed(() => createDashedRouteMaterial('rgba(255, 122, 89, 0.55)'));

const mapControlStyle = computed(() => ({
  left: `${Math.max(16, Number(props.leftOverlayOffset) + 16)}px`
}));
const canPreviewRoute = computed(() => (
  props.routeType === 'waypoint'
  && !props.isPatrolMode
  && props.waypoints.filter((point) => point?.lng != null && point?.lat != null).length >= 2
));
const previewReady = computed(() => previewPathVersion.value > 0 && previewPath.length >= 2);
const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return minutes > 0 ? `${minutes}分${remainder}秒` : `${remainder}秒`;
};
const previewStats = computed(() => ({
  waypointCount: props.waypoints.filter((point) => point?.lng != null && point?.lat != null).length,
  distanceLabel: previewTotalDistance.value >= 1000
    ? `${(previewTotalDistance.value / 1000).toFixed(2)}km`
    : `${Math.round(previewTotalDistance.value)}m`,
  durationLabel: formatDuration(previewTotalDistance.value / Math.max(0.1, Number(previewSpeed.value) || 10))
}));
const previewAltitudeModeLabel = computed(() => (
  props.executeHeightMode === 'realTimeFollowSurface'
    ? '实时仿地高度'
    : (props.executeHeightMode === 'WGS84' ? 'WGS84 绝对高度' : '相对起飞点高度')
));
const previewFocalLength = computed(() => 24 * previewZoomFactor.value);

// --- 3. Computed Properties ---
// 使用 Props 中的 isPatrolMode 避免冲突

const selectedWpYawRad = computed(() => {
  if (props.selectedWpIndex === -1 || !props.waypoints[props.selectedWpIndex]) return 0;
  const wp = props.waypoints[props.selectedWpIndex];
  const yawAction = wp.actions?.find(a => a.type === ACTION_TYPE.AIRCRAFT_YAW);
  return -((yawAction?.params?.aircraftYawAngle || 0) * Math.PI) / 180;
});

const waypointPositions = computed(() => {
  if (!cesiumInstance.value || enhancedWaypoints.value.length === 0) return [];
  const positions = enhancedWaypoints.value.map(wp => wp.cartesian);

  if (props.isClosedLoop && positions.length > 2) {
    positions.push(positions[0]);
  }
  return positions;
});

const enhancedWaypoints = computed(() => {
  if (!cesiumInstance.value || !viewerInstance.value) return [];
  const Cesium = cesiumInstance.value;
  const viewer = viewerInstance.value;

  return props.waypoints
    .filter(wp => wp.lng != null && wp.lat != null)
    .map((wp, index) => {
      let takeoffH = Number(props.takeoffPoint?.asl || props.takeoffPoint?.height || 0);
      const isRel = props.executeHeightMode === 'relativeToStartPoint';
      const isAGL = props.executeHeightMode === 'realTimeFollowSurface';

      const carto = Cesium.Cartographic.fromDegrees(Number(wp.lng), Number(wp.lat));
      const groundHeight = (wp.terrainHeight !== undefined && wp.terrainHeight !== null) ? Number(wp.terrainHeight) : (viewer.scene.globe.getHeight(carto) || 0);

      // Fallback: If in relative mode but takeoff height is missing, use ground height of first point
      if (isRel && takeoffH === 0 && props.waypoints.length > 0) {
        const firstWp = props.waypoints[0];
        const firstCarto = Cesium.Cartographic.fromDegrees(Number(firstWp.lng), Number(firstWp.lat));
        takeoffH = (firstWp.terrainHeight !== undefined && firstWp.terrainHeight !== null) ? Number(firstWp.terrainHeight) : (viewer.scene.globe.getHeight(firstCarto) || groundHeight);
      }

      let absHeight = Number(wp.height) || 0;
      if (isRel) {
        absHeight += takeoffH;
      } else if (isAGL) {
        absHeight += groundHeight;
      }

      const cartesian = Cesium.Cartesian3.fromDegrees(Number(wp.lng), Number(wp.lat), absHeight);
      const groundCartesian = Cesium.Cartesian3.fromDegrees(Number(wp.lng), Number(wp.lat), groundHeight);

      return {
        ...wp,
        cartesian,
        groundCartesian,
        asl: Math.round(absHeight || 0),
        hae: absHeight - groundHeight
      };
    });
});

const isStripMode = computed(() => props.routeType === 'strip');
const isStripSingleMode = computed(() => isStripMode.value && props.stripRouteMode === 'single');
const isGeometryMode = computed(() => props.routeType === 'geometry');
const isSlopeMode = computed(() => props.routeType === 'slope');

const getGeometryBaseAltitude = () => {
  const samples = (props.waypoints || [])
    .map((point) => Number(point?.terrainHeight))
    .filter((value) => Number.isFinite(value));

  if (samples.length === 0) return 0;
  return Math.max(...samples);
};

const buildGeometryRingPositions = (heightValue) => {
  if (!cesiumInstance.value || !Array.isArray(props.waypoints) || props.waypoints.length === 0) return [];

  const Cesium = cesiumInstance.value;
  const points = props.waypoints
    .filter((point) => point?.lng != null && point?.lat != null)
    .map((point) => Cesium.Cartesian3.fromDegrees(Number(point.lng), Number(point.lat), heightValue));

  if (points.length < 2) return points;
  return [...points, points[0]];
};

const geometryBottomAltitude = computed(() => {
  if (!isGeometryMode.value) return 0;
  const configHeight = Number(props.geometryConfig?.bottomHeight);
  const baseAltitude = getGeometryBaseAltitude();
  return baseAltitude + (Number.isFinite(configHeight) ? configHeight : 0);
});

const geometryTopAltitude = computed(() => {
  if (!isGeometryMode.value) return 0;
  const configHeight = Number(props.geometryConfig?.topHeight);
  const baseAltitude = getGeometryBaseAltitude();
  return baseAltitude + (Number.isFinite(configHeight) ? configHeight : 0);
});

const geometryBottomOutlinePositions = computed(() => (
  isGeometryMode.value ? buildGeometryRingPositions(geometryBottomAltitude.value) : []
));

const geometryTopOutlinePositions = computed(() => (
  isGeometryMode.value ? buildGeometryRingPositions(geometryTopAltitude.value) : []
));

const geometryVerticalEdges = computed(() => {
  if (!isGeometryMode.value || !cesiumInstance.value || !Array.isArray(props.waypoints)) return [];

  const Cesium = cesiumInstance.value;
  return props.waypoints
    .filter((point) => point?.lng != null && point?.lat != null)
    .map((point, index) => ({
      key: index,
      positions: [
        Cesium.Cartesian3.fromDegrees(Number(point.lng), Number(point.lat), geometryBottomAltitude.value),
        Cesium.Cartesian3.fromDegrees(Number(point.lng), Number(point.lat), geometryTopAltitude.value)
      ]
    }));
});

const geometryWallPolygons = computed(() => {
  if (!isGeometryMode.value || !cesiumInstance.value || !Array.isArray(props.waypoints) || props.waypoints.length < 2) return [];

  const Cesium = cesiumInstance.value;
  const rawPoints = props.waypoints.filter((point) => point?.lng != null && point?.lat != null);
  if (rawPoints.length < 2) return [];

  const walls = [];
  for (let index = 0; index < rawPoints.length; index += 1) {
    const current = rawPoints[index];
    const next = rawPoints[(index + 1) % rawPoints.length];
    walls.push({
      key: index,
      positions: [
        Cesium.Cartesian3.fromDegrees(Number(current.lng), Number(current.lat), geometryBottomAltitude.value),
        Cesium.Cartesian3.fromDegrees(Number(next.lng), Number(next.lat), geometryBottomAltitude.value),
        Cesium.Cartesian3.fromDegrees(Number(next.lng), Number(next.lat), geometryTopAltitude.value),
        Cesium.Cartesian3.fromDegrees(Number(current.lng), Number(current.lat), geometryTopAltitude.value)
      ]
    });
  }

  return walls;
});

const slopeSurfacePoints = computed(() => {
  return [];
});

const getRelativeTakeoffHeight = () => {
  let takeoffH = Number(props.takeoffPoint?.asl || props.takeoffPoint?.height || 0);
  if (takeoffH === 0 && Array.isArray(props.waypoints) && props.waypoints.length > 0) {
    const firstPoint = props.waypoints[0];
    takeoffH = Number(firstPoint?.terrainHeight || 0);
  }
  return Number.isFinite(takeoffH) ? takeoffH : 0;
};

const resolveDisplayAltitude = (point = {}) => {
  const height = Number(point.height || 0);
  const terrainHeight = Number(point.terrainHeight || 0);
  if (props.executeHeightMode === 'relativeToStartPoint') {
    return getRelativeTakeoffHeight() + height;
  }
  if (props.executeHeightMode === 'realTimeFollowSurface') {
    return terrainHeight + height;
  }
  return height;
};

const buildSlopeCartesianPoint = (point) => {
  if (!point || !cesiumInstance.value) return null;
  return cesiumInstance.value.Cartesian3.fromDegrees(
    Number(point.lng),
    Number(point.lat),
    resolveDisplayAltitude(point)
  );
};

const slopeSurfacePositions = computed(() => {
  if (!isSlopeMode.value || !cesiumInstance.value) return [];
  return slopeSurfacePoints.value.map((point) => buildSlopeCartesianPoint(point)).filter(Boolean);
});

const slopeSurfaceOutlinePositions = computed(() => {
  if (slopeSurfacePositions.value.length < 2) return slopeSurfacePositions.value;
  return [...slopeSurfacePositions.value, slopeSurfacePositions.value[0]];
});

const slopeBottomEdgePositions = computed(() => {
  if (!isSlopeMode.value || !cesiumInstance.value || !Array.isArray(props.waypoints)) return [];
  return props.waypoints
    .slice(0, 2)
    .filter((point) => point?.lng != null && point?.lat != null)
    .map((point) => cesiumInstance.value.Cartesian3.fromDegrees(
      Number(point.lng),
      Number(point.lat),
      resolveDisplayAltitude(point)
    ));
});

const groupStripCenterlinePoints = (points = []) => {
  const groups = [];
  const bucketMap = new Map();
  points.forEach((point) => {
    const regionId = Number(point.regionId || 1);
    const existing = bucketMap.get(regionId) || {
      regionId,
      regionOrder: Number(point.regionOrder || regionId),
      points: []
    };
    existing.points.push(point);
    bucketMap.set(regionId, existing);
  });

  bucketMap.forEach((group) => {
    group.points.sort((left, right) => Number(left.pointOrder || 0) - Number(right.pointOrder || 0));
    groups.push(group);
  });

  return groups.sort((left, right) => left.regionOrder - right.regionOrder);
};

const stripCenterlineGroups = computed(() => {
  if (!isStripMode.value || !enhancedWaypoints.value.length) return [];

  return groupStripCenterlinePoints(enhancedWaypoints.value).map((group) => ({
    key: group.regionId,
    regionId: group.regionId,
    regionOrder: group.regionOrder,
    points: group.points,
    positions: group.points.map((point) => point.cartesian),
    labelPosition: group.points[0]?.cartesian || null,
    isActive: group.regionId === Number(props.activeRegionId || 1),
    color: group.regionId === Number(props.activeRegionId || 1) ? '#4DA3FF' : 'rgba(77, 163, 255, 0.55)'
  }));
});

const getStripPreviewHeight = () => {
  const scanHeight = props.scanPath.find((point) => point?.height != null)?.height;
  const centerlineHeight = props.waypoints.find((point) => point?.height != null)?.height;
  return Number(scanHeight ?? centerlineHeight ?? 0);
};

const buildStripCartesianPoint = (point) => {
  if (!point || !cesiumInstance.value) return null;
  const baseHeight = Number(point.height ?? getStripPreviewHeight());
  return cesiumInstance.value.Cartesian3.fromDegrees(Number(point.lng), Number(point.lat), baseHeight);
};

const normalizeCoverageItem = (item, index) => {
  const points = Array.isArray(item?.points) ? item.points : (Array.isArray(item) ? item : []);
  const regionId = Number(item?.regionId || 1);
  const waylineId = Number.isFinite(Number(item?.waylineId)) ? Number(item.waylineId) : index;
  return { points, regionId, waylineId };
};

const stripCoverageAreaEntities = computed(() => {
  if (!isStripMode.value || !Array.isArray(props.coverageArea) || !cesiumInstance.value) return [];

  return props.coverageArea
    .map((item, index) => normalizeCoverageItem(item, index))
    .filter((item) => item.points.length >= 3)
    .map((item) => {
      const positions = item.points.map((point) => buildStripCartesianPoint(point)).filter(Boolean);
      const isActive = item.regionId === Number(props.activeRegionId || 1);
      const isSelected = !showWaylineSelector.value || item.waylineId === selectedWaylineKey.value;
      return {
        key: `${item.regionId}-${item.waylineId}`,
        positions,
        isActive,
        isSelected,
        fillColor: isActive && isSelected ? 'rgba(77, 163, 255, 0.12)' : 'rgba(77, 163, 255, 0.04)',
        outlineColor: isActive && isSelected ? '#4DA3FF' : 'rgba(77, 163, 255, 0.42)'
      };
    });
});

const stripCuttingSegmentEntities = computed(() => {
  if (!isStripMode.value || !Array.isArray(props.cuttingSegments) || !cesiumInstance.value) return [];

  return props.cuttingSegments
    .map((item, index) => {
      const points = Array.isArray(item?.points) ? item.points : [];
      if (points.length < 2) return null;
      const regionId = Number(item?.regionId || 1);
      const waylineId = Number.isFinite(Number(item?.waylineId)) ? Number(item.waylineId) : index;
      return {
        regionId,
        waylineId,
        key: `${regionId}-${waylineId}-${index}`,
        positions: points.map((point) => buildStripCartesianPoint(point)).filter(Boolean),
        color: regionId === Number(props.activeRegionId || 1) && (!showWaylineSelector.value || waylineId === selectedWaylineKey.value)
          ? 'rgba(77, 163, 255, 0.95)'
          : 'rgba(77, 163, 255, 0.42)'
      };
    })
    .filter(Boolean);
});

const enhancedBoundaryWaypoints = computed(() => {
  if (!cesiumInstance.value || !viewerInstance.value || !props.isPatrolMode) return [];
  const Cesium = cesiumInstance.value;
  const viewer = viewerInstance.value;
  let takeoffH = Number(props.takeoffPoint?.asl || props.takeoffPoint?.height || 0);
  const isRel = props.executeHeightMode === 'relativeToStartPoint';

  // Fallback: If in relative mode but takeoff height is missing, use ground height of first point
  if (isRel && takeoffH === 0 && props.waypoints.length > 0) {
    const firstWp = props.waypoints[0];
    const firstCarto = Cesium.Cartographic.fromDegrees(Number(firstWp.lng), Number(firstWp.lat));
    // Try to use stored terrain height, otherwise sample globe
    const groundHeight = (viewer.scene.globe.getHeight(firstCarto) || 0);
    takeoffH = (firstWp.terrainHeight !== undefined && firstWp.terrainHeight !== null) ? Number(firstWp.terrainHeight) : groundHeight;
  }

  return props.waypoints
    .filter(wp => wp.lng != null && wp.lat != null)
    .map(wp => {
      const isAGL = props.executeHeightMode === 'realTimeFollowSurface';
      const carto = Cesium.Cartographic.fromDegrees(wp.lng, wp.lat);
      const groundHeight = (wp.terrainHeight !== undefined && wp.terrainHeight !== null) ? Number(wp.terrainHeight) : (viewer.scene.globe.getHeight(carto) || 0);

      let absHeight = Number(wp.height) || 0;
      if (isRel) {
        absHeight += takeoffH;
      } else if (isAGL) {
        absHeight += groundHeight;
      }

      return {
        ...wp,
        cartesian: Cesium.Cartesian3.fromDegrees(wp.lng, wp.lat, absHeight),
        groundCartesian: Cesium.Cartesian3.fromDegrees(wp.lng, wp.lat, groundHeight),
        asl: Math.round(absHeight || 0),
        hae: absHeight - groundHeight
      };
    });
});

const closedBoundaryPositions = computed(() => {
  if (!cesiumInstance.value || !viewerInstance.value || !props.isPatrolMode || !(enhancedBoundaryWaypoints.value || []).length) return [];
  const Cesium = cesiumInstance.value;
  const viewer = viewerInstance.value;
  const isAGL = props.executeHeightMode === 'realTimeFollowSurface';

  const basePoints = [...enhancedBoundaryWaypoints.value];
  basePoints.push(basePoints[0]);

  const finalPositions = [];
  const subdivisionDist = 20;

  for (let i = 0; i < basePoints.length - 1; i++) {
    const p1 = basePoints[i];
    const p2 = basePoints[i + 1];
    const startCartesian = Cesium.Cartesian3.fromDegrees(p1.lng, p1.lat, p1.asl);
    const endCartesian = Cesium.Cartesian3.fromDegrees(p2.lng, p2.lat, p2.asl);
    const dist = Cesium.Cartesian3.distance(startCartesian, endCartesian);
    const steps = Math.max(1, Math.floor(dist / subdivisionDist));

    for (let s = 0; s < steps; s++) {
      const lerpFactor = s / steps;
      const lng = p1.lng + (p2.lng - p1.lng) * lerpFactor;
      const lat = p1.lat + (p2.lat - p1.lat) * lerpFactor;
      let absHeight = p1.asl + (p2.asl - p1.asl) * lerpFactor;

      if (isAGL) {
        const carto = Cesium.Cartographic.fromDegrees(lng, lat);
        const localGround = viewer.scene.globe.getHeight(carto) || 0;
        const offsetHeight = (p1.height + (p2.height - p1.height) * lerpFactor) || 70;
        absHeight = offsetHeight + localGround;
      }
      finalPositions.push(Cesium.Cartesian3.fromDegrees(lng, lat, absHeight));
    }
  }
  const lastPoint = basePoints[basePoints.length - 1];
  finalPositions.push(Cesium.Cartesian3.fromDegrees(lastPoint.lng, lastPoint.lat, lastPoint.asl));
  return finalPositions;
});

const enhancedScanPath = computed(() => {
  if (!cesiumInstance.value || !viewerInstance.value || !props.isPatrolMode || !props.scanPath?.length) return [];
  const Cesium = cesiumInstance.value;
  const viewer = viewerInstance.value;
  let takeoffH = Number(props.takeoffPoint?.asl || props.takeoffPoint?.height || 0);
  const isRel = props.executeHeightMode === 'relativeToStartPoint';

  // Fallback: If in relative mode but takeoff height is missing, use ground height of first point (boundary)
  if (isRel && takeoffH === 0 && props.waypoints.length > 0) {
    const firstWp = props.waypoints[0];
    const firstCarto = Cesium.Cartographic.fromDegrees(Number(firstWp.lng), Number(firstWp.lat));
    // Try to use stored terrain height, otherwise sample globe
    const groundHeight = viewer.scene.globe.getHeight(firstCarto) || 0;
    takeoffH = (firstWp.terrainHeight !== undefined && firstWp.terrainHeight !== null) ? Number(firstWp.terrainHeight) : groundHeight;
  }

  return props.scanPath
    .filter(p => p.lng != null && p.lat != null)
    .map(p => {
      const isAGL = props.executeHeightMode === 'realTimeFollowSurface';
      const carto = Cesium.Cartographic.fromDegrees(p.lng, p.lat);
      const groundHeight = (p.terrainHeight !== undefined && p.terrainHeight !== null) ? Number(p.terrainHeight) : (viewer.scene.globe.getHeight(carto) || 0);
      
      // 使用实际高度，不要使用默认值
      let absHeight = Number(p.height) || 0;
      if (isRel) {
        absHeight += takeoffH;
      } else if (isAGL) {
        absHeight += groundHeight;
      }

      return {
        ...p,
        cartesian: Cesium.Cartesian3.fromDegrees(p.lng, p.lat, absHeight),
        groundHeight,
        asl: Math.round(absHeight || 0),
        hae: absHeight - groundHeight
      };
    });
});

const isMappingMode = computed(() => props.routeType === 'mapping' || props.routeType === 'polygon' || props.routeType === 'strip' || props.routeType === 'slope');
const boundaryLineColor = computed(() => (isMappingMode.value ? '#4DA3FF' : '#FF00FF'));
const boundaryFillColor = computed(() => (isMappingMode.value ? 'rgba(77, 163, 255, 0.14)' : 'rgba(255, 0, 255, 0.12)'));
const boundaryPointColor = computed(() => (isMappingMode.value ? 'rgba(77, 163, 255, 0.95)' : 'rgba(255, 0, 255, 0.9)'));
const boundaryGroundPointColor = computed(() => (isMappingMode.value ? 'rgba(77, 163, 255, 0.55)' : 'rgba(255, 0, 255, 0.6)'));

const enhancedScanPathGroups = computed(() => {
  if (!enhancedScanPath.value.length) return [];

  if (isGeometryMode.value) {
    return [enhancedScanPath.value];
  }

  const groups = [];
  let currentGroup = [];
  let currentRouteIndex = enhancedScanPath.value[0].routeIndex ?? 0;

  enhancedScanPath.value.forEach((point) => {
    const routeIndex = point.routeIndex ?? 0;
    if (currentGroup.length === 0 || routeIndex === currentRouteIndex) {
      currentGroup.push(point);
      currentRouteIndex = routeIndex;
      return;
    }

    groups.push(currentGroup);
    currentGroup = [point];
    currentRouteIndex = routeIndex;
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
});

const selectableWaylineGroups = computed(() => {
  return enhancedScanPathGroups.value
    .filter((group) => group.length > 0)
    .map((group, index) => ({
      key: group[0]?.routeIndex ?? index,
      label: index + 1,
      points: group
    }));
});

const selectedWaylineKey = ref(null);
const showWaylineSelector = computed(() => isMappingMode.value && selectableWaylineGroups.value.length > 1);
const waylineSelectorStyle = computed(() => ({
  left: `${Math.max(24, Number(props.leftOverlayOffset) + 24)}px`
}));

const stripSingleRouteGroups = computed(() => stripCenterlineGroups.value.map((group) => ({
  ...group,
  positions: group.positions
})));

const visibleEnhancedScanPathGroups = computed(() => {
  if (isStripSingleMode.value) {
    return [];
  }

  if (!showWaylineSelector.value) {
    return selectableWaylineGroups.value.map((group) => group.points);
  }

  const selectedGroup = selectableWaylineGroups.value.find((group) => group.key === selectedWaylineKey.value)
    || selectableWaylineGroups.value[0];

  return selectedGroup ? [selectedGroup.points] : [];
});

const visibleEnhancedScanPath = computed(() => visibleEnhancedScanPathGroups.value.flat());

const stripVisibleWaylineGroups = computed(() => selectableWaylineGroups.value.map((group) => ({
  ...group,
  points: isStripSingleMode.value ? [] : group.points,
  isSelected: !showWaylineSelector.value || group.key === selectedWaylineKey.value
})).filter((group) => group.points.length > 1));

const isRoutePointUnderground = (point) => {
  const hae = Number(point?.hae);
  return Number.isFinite(hae) && hae < UNDERGROUND_ROUTE_THRESHOLD_METERS;
};

const splitRouteByUndergroundState = (points = []) => {
  if (!Array.isArray(points) || points.length < 2) return [];

  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (!current?.cartesian || !next?.cartesian) continue;

    const isUnderground = isRoutePointUnderground(current) || isRoutePointUnderground(next);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.isUnderground === isUnderground) {
      lastSegment.points.push(next);
      continue;
    }

    segments.push({
      key: `${index}-${isUnderground ? 'underground' : 'flyable'}`,
      isUnderground,
      points: [current, next]
    });
  }

  return segments;
};

const visibleScanPathSegments = computed(() => (
  visibleEnhancedScanPathGroups.value.flatMap((group, groupIndex) => (
    splitRouteByUndergroundState(group).map((segment, segmentIndex) => ({
      ...segment,
      key: `${groupIndex}-${segmentIndex}-${segment.key}`
    }))
  ))
));

const stripVisibleWaylineSegments = computed(() => (
  stripVisibleWaylineGroups.value.flatMap((group) => (
    splitRouteByUndergroundState(group.points).map((segment, segmentIndex) => ({
      ...segment,
      key: `${group.key}-${segmentIndex}-${segment.key}`,
      isSelected: group.isSelected,
      isStripRoute: true
    }))
  ))
));

const getRouteSegmentMaterial = (segment = {}) => {
  if (segment.isUnderground) return undergroundRouteMaterial.value;
  if (segment.isStripRoute) {
    return segment.isSelected ? STRIP_ROUTE_SELECTED_MATERIAL : STRIP_ROUTE_MUTED_MATERIAL;
  }
  return ROUTE_SOLID_MATERIAL;
};

const getRouteSegmentDepthFailMaterial = (segment = {}) => {
  if (segment.isUnderground) return undergroundRouteDepthFailMaterial.value;
  if (segment.isStripRoute) return STRIP_ROUTE_DEPTH_FAIL_MATERIAL;
  return ROUTE_SOLID_DEPTH_FAIL_MATERIAL;
};

const waypointRouteSegments = computed(() => {
  if (props.isPatrolMode || waypointPositions.value.length <= 1) return [];

  const routePoints = props.isClosedLoop && enhancedWaypoints.value.length > 2
    ? [...enhancedWaypoints.value, enhancedWaypoints.value[0]]
    : enhancedWaypoints.value;

  return splitRouteByUndergroundState(routePoints).map((segment, index) => ({
    ...segment,
    key: `${index}-${segment.key}`
  }));
});

const stripSingleRouteSegments = computed(() => (
  stripCenterlineGroups.value.flatMap((group) => (
    splitRouteByUndergroundState(group.points).map((segment, segmentIndex) => ({
      ...segment,
      key: `${group.key}-${segmentIndex}-${segment.key}`,
      isSelected: group.isActive,
      isStripRoute: true
    }))
  ))
));

watch(selectableWaylineGroups, (groups) => {
  if (!groups.length) {
    selectedWaylineKey.value = null;
    return;
  }

  const hasSelected = groups.some((group) => group.key === selectedWaylineKey.value);
  if (!hasSelected) {
    selectedWaylineKey.value = groups[0].key;
  }
}, { immediate: true });

const selectWaylineGroup = (groupKey) => {
  selectedWaylineKey.value = groupKey;
};

const groundAslValue = computed(() => {
  if (!centerPointRaw.value || !cesiumInstance.value || !viewerInstance.value) return 0;
  return viewerInstance.value.scene.globe.getHeight(cesiumInstance.value.Cartographic.fromDegrees(centerPointRaw.value.lng, centerPointRaw.value.lat)) || 0;
});

const relHeightValue = computed(() => {
  if (!zoomFovData.value?.params?.position?.height || groundAslValue.value == null) return 0;
  return Math.round(zoomFovData.value.params.position.height - groundAslValue.value);
});

const fovCenterPoint = computed(() => {
  if (!centerPointRaw.value || !cesiumInstance.value || !viewerInstance.value) return null;
  const cp = centerPointRaw.value;
  if (cp.lng == null || cp.lat == null || isNaN(cp.lng) || isNaN(cp.lat)) return null;
  return cesiumInstance.value.Cartesian3.fromDegrees(cp.lng, cp.lat, groundAslValue.value || 0);
});

const relHeightLabelPosition = computed(() => {
  if (!fovDronePosition.value || !fovCenterPoint.value || !cesiumInstance.value) return null;
  return cesiumInstance.value.Cartesian3.lerp(fovDronePosition.value, fovCenterPoint.value, 0.5, new cesiumInstance.value.Cartesian3());
});

// --- 4. Methods ---
const ARCGIS_WORLD_IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
const ROUTE_SAMPLE_SPACING_METERS = 20;
const ROUTE_CLEARANCE_METERS = 20;

const waitForNextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

const enableSceneNavigation = (viewer = viewerInstance.value) => {
  const controller = viewer?.scene?.screenSpaceCameraController;
  if (!controller) return;
  controller.enableInputs = true;
  controller.enableZoom = true;
  controller.enableRotate = true;
  controller.enableTilt = true;
  controller.enableLook = true;
  controller.enableTranslate = true;
};

const ensureScene3D = async (viewer = viewerInstance.value, Cesium = cesiumInstance.value) => {
  if (!viewer || !Cesium || viewer.isDestroyed?.()) return false;
  sceneMode.value = Cesium.SceneMode.SCENE3D;
  await nextTick();

  if (viewer.scene.mode === Cesium.SceneMode.MORPHING) {
    viewer.scene.completeMorph();
  }
  if (viewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
    viewer.scene.morphTo3D(0);
    viewer.scene.completeMorph();
  }
  enableSceneNavigation(viewer);
  await waitForNextFrame();
  return viewer.scene.mode === Cesium.SceneMode.SCENE3D;
};

const ensureScene2D = async (viewer = viewerInstance.value, Cesium = cesiumInstance.value) => {
  if (!viewer || !Cesium || viewer.isDestroyed?.()) return false;
  sceneMode.value = Cesium.SceneMode.SCENE2D;
  await nextTick();

  if (viewer.scene.mode === Cesium.SceneMode.MORPHING) {
    viewer.scene.completeMorph();
  }
  if (viewer.scene.mode !== Cesium.SceneMode.SCENE2D) {
    viewer.scene.morphTo2D(0);
    viewer.scene.completeMorph();
  }
  enableSceneNavigation(viewer);
  await waitForNextFrame();
  return viewer.scene.mode === Cesium.SceneMode.SCENE2D;
};

const removeBuildingTileset = () => {
  const viewer = viewerInstance.value;
  if (!viewer || !buildingTileset) return;
  try {
    if (viewer.scene.primitives.contains(buildingTileset)) {
      viewer.scene.primitives.remove(buildingTileset);
    }
  } catch (error) {
    console.warn('Failed to remove 3D building tileset.', error);
  }
  buildingTileset = null;
};

const addImageryForMode = async (_mode, Cesium, viewer) => {
  viewer.imageryLayers.removeAll(true);
  let provider;
  if (Cesium.ArcGisMapServerImageryProvider?.fromUrl) {
    provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(ARCGIS_WORLD_IMAGERY_URL, {
      enablePickFeatures: false
    });
  } else {
    provider = new Cesium.UrlTemplateImageryProvider({
      url: `${ARCGIS_WORLD_IMAGERY_URL}/tile/{z}/{y}/{x}`,
      maximumLevel: 19
    });
  }
  viewer.imageryLayers.addImageryProvider(provider);
};

const applyMapMode = async (options = {}) => {
  if (!viewerInstance.value || !cesiumInstance.value) return;
  const preservePreview = options?.preservePreview === true;
  const sequence = ++mapSwitchSequence;
  const viewer = viewerInstance.value;
  const Cesium = cesiumInstance.value;
  const mode = mapMode.value;
  mapLoading.value = true;
  mapStatus.value = '';
  if (preservePreview) {
    stopRoutePreviewFrame();
    unlockPreviewCamera();
  } else {
    invalidateRoutePreview();
  }

  try {
    removeBuildingTileset();
    await addImageryForMode(mode, Cesium, viewer);
    if (sequence !== mapSwitchSequence || viewerInstance.value !== viewer) return;

    if (mode === 'buildings') {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      const entered3D = await ensureScene3D(viewer, Cesium);
      if (!entered3D) {
        throw new Error('无法切换到 3D 场景，白模未加载。');
      }
      if (sequence !== mapSwitchSequence || viewerInstance.value !== viewer) return;
      const tileset = await Cesium.createOsmBuildingsAsync({
        enableShowOutline: false
      });
      if (sequence !== mapSwitchSequence || viewerInstance.value !== viewer) {
        tileset.destroy?.();
        return;
      }
      tileset.style = new Cesium.Cesium3DTileStyle({
        color: "color('white', 0.92)"
      });
      buildingTileset = markRaw(viewer.scene.primitives.add(tileset));
      mapStatus.value = 'ArcGIS 影像 · OSM 3D 白模 · 无地形';
    } else {
      const terrainProvider = await Cesium.createWorldTerrainAsync();
      if (sequence !== mapSwitchSequence || viewerInstance.value !== viewer) return;
      viewer.terrainProvider = terrainProvider;
      mapStatus.value = 'ArcGIS 影像 · WGS84 · Cesium 地形';
    }
  } catch (error) {
    if (sequence !== mapSwitchSequence || viewerInstance.value !== viewer) return;
    console.warn(`Failed to load ${mode} map mode.`, error);
    if (mode === 'buildings') {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      mapStatus.value = '3D 白模加载失败，请检查网络或 Cesium Token';
    } else {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      mapStatus.value = '地形加载失败，已切换为椭球地面';
    }
  } finally {
    if (sequence === mapSwitchSequence) {
      mapLoading.value = false;
      viewer.scene.requestRender();
    }
  }
};

const stopRoutePreviewFrame = () => {
  if (previewRafId) cancelAnimationFrame(previewRafId);
  previewRafId = 0;
  previewLastTimestamp = 0;
  previewPlaying.value = false;
};

const unlockPreviewCamera = () => {
  const viewer = viewerInstance.value;
  const Cesium = cesiumInstance.value;
  if (!viewer || !Cesium) return;
  try {
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  } catch (error) {
    console.warn('Failed to unlock preview camera.', error);
  }
};

const removePreviewEntities = () => {
  const viewer = viewerInstance.value;
  if (viewer && !viewer.isDestroyed?.()) {
    if (previewRouteEntity) viewer.entities.remove(previewRouteEntity);
    if (previewDroneEntity) viewer.entities.remove(previewDroneEntity);
    if (previewHeadingEntity) viewer.entities.remove(previewHeadingEntity);
  }
  previewRouteEntity = null;
  previewDroneEntity = null;
  previewHeadingEntity = null;
  previewVisualPosition = null;
  previewHeadingTip = null;
  previewVisualHeading = 0;
  previewScreenRotation = 0;
  previewIconSceneMode = null;
  previewLastFovUpdateAt = 0;
  previewCameraFollowMode = 'idle';
  previewThirdPersonRange = 100;
  preview2DFrustumWidth = 0;
  routePreviewDronePosition.value = null;
  routePreviewWideFovData.value = { points: [], rawPoints: [] };
  routePreviewZoomFovData.value = { points: [], rawPoints: [] };
  previewGimbalPitch.value = -45;
  previewZoomFactor.value = 1;
};

const invalidateRoutePreview = () => {
  stopRoutePreviewFrame();
  unlockPreviewCamera();
  removePreviewEntities();
  previewPath = [];
  previewCameraStates = [];
  previewSurfaceHeights = [];
  previewCumulativeDistances = [];
  previewDistance = 0;
  previewTotalDistance.value = 0;
  previewAltitudeAdjustedCount.value = 0;
  previewMaxAltitudeAdjustment.value = 0;
  previewProgress.value = 0;
  previewFinished.value = false;
  previewError.value = '';
  previewPathVersion.value = 0;
};

const interpolateNumber = (start, end, fraction, fallback = 0) => {
  const startNumber = Number(start);
  const endNumber = Number(end);
  const safeStart = Number.isFinite(startNumber) ? startNumber : fallback;
  const safeEnd = Number.isFinite(endNumber) ? endNumber : safeStart;
  return safeStart + (safeEnd - safeStart) * fraction;
};

const normalizeHeadingDegrees = (degrees) => ((Number(degrees) % 360) + 360) % 360;

const interpolateHeadingDegrees = (start, end, fraction) => {
  const normalizedStart = normalizeHeadingDegrees(start);
  const normalizedEnd = normalizeHeadingDegrees(end);
  const shortestDelta = ((normalizedEnd - normalizedStart + 540) % 360) - 180;
  return normalizeHeadingDegrees(normalizedStart + shortestDelta * fraction);
};

const getWaypointActionNumber = (waypoint, type, parameter) => {
  const action = waypoint?.actions?.find((item) => item?.type === type);
  const value = Number(action?.params?.[parameter]);
  return Number.isFinite(value) ? value : null;
};

const resolveWaypointCameraStates = (waypoints) => {
  const activeState = { pitch: -45, zoomFactor: 1, yaw: null };
  return waypoints.map((waypoint) => {
    const pitch = getWaypointActionNumber(waypoint, ACTION_TYPE.GIMBAL_PITCH, 'gimbalPitchRotateAngle');
    const zoomFactor = getWaypointActionNumber(waypoint, ACTION_TYPE.ZOOM, 'zoomFactor');
    const yaw = getWaypointActionNumber(waypoint, ACTION_TYPE.AIRCRAFT_YAW, 'aircraftYawAngle');
    if (pitch != null) activeState.pitch = Math.max(-90, Math.min(70, pitch));
    if (zoomFactor != null) activeState.zoomFactor = Math.max(1, Math.min(112, zoomFactor));
    if (yaw != null) activeState.yaw = normalizeHeadingDegrees(yaw);
    return { ...activeState };
  });
};

const buildResamplePlan = (Cesium) => {
  const waypoints = props.waypoints.filter((point) => point?.lng != null && point?.lat != null);
  const samples = [];
  const waypointCameraStates = resolveWaypointCameraStates(waypoints);
  let finalRouteHeading = 0;

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const start = Cesium.Cartographic.fromDegrees(Number(waypoints[index].lng), Number(waypoints[index].lat));
    const end = Cesium.Cartographic.fromDegrees(Number(waypoints[index + 1].lng), Number(waypoints[index + 1].lat));
    const geodesic = new Cesium.EllipsoidGeodesic(start, end);
    const routeHeading = normalizeHeadingDegrees(Cesium.Math.toDegrees(geodesic.startHeading));
    finalRouteHeading = routeHeading;
    const startCamera = waypointCameraStates[index];
    const endCamera = waypointCameraStates[index + 1];
    const startYaw = startCamera.yaw ?? routeHeading;
    const endYaw = endCamera.yaw ?? routeHeading;
    const steps = Math.max(1, Math.ceil(geodesic.surfaceDistance / ROUTE_SAMPLE_SPACING_METERS));
    for (let step = 0; step < steps; step += 1) {
      const fraction = step / steps;
      samples.push({
        cartographic: geodesic.interpolateUsingFraction(fraction, new Cesium.Cartographic()),
        plannedAbsoluteAltitude: interpolateNumber(
          resolveDisplayAltitude(waypoints[index]),
          resolveDisplayAltitude(waypoints[index + 1]),
          fraction
        ),
        plannedSurfaceOffset: interpolateNumber(
          waypoints[index].height,
          waypoints[index + 1].height,
          fraction,
          ROUTE_CLEARANCE_METERS
        ),
        cameraState: {
          pitch: interpolateNumber(startCamera.pitch, endCamera.pitch, fraction, -45),
          zoomFactor: interpolateNumber(startCamera.zoomFactor, endCamera.zoomFactor, fraction, 1),
          yaw: interpolateHeadingDegrees(startYaw, endYaw, fraction)
        }
      });
    }
  }

  const last = waypoints[waypoints.length - 1];
  const lastCamera = waypointCameraStates[waypointCameraStates.length - 1];
  samples.push({
    cartographic: Cesium.Cartographic.fromDegrees(Number(last.lng), Number(last.lat)),
    plannedAbsoluteAltitude: resolveDisplayAltitude(last),
    plannedSurfaceOffset: Number.isFinite(Number(last.height)) ? Number(last.height) : ROUTE_CLEARANCE_METERS,
    cameraState: {
      pitch: lastCamera.pitch,
      zoomFactor: lastCamera.zoomFactor,
      yaw: normalizeHeadingDegrees(lastCamera.yaw ?? finalRouteHeading)
    }
  });
  return samples;
};

const flyCameraToRoute = (cartographics, Cesium, viewer) => new Promise((resolve) => {
  const positions = cartographics.map((point) => Cesium.Cartesian3.fromRadians(point.longitude, point.latitude, 80));
  const sphere = Cesium.BoundingSphere.fromPoints(positions);
  viewer.camera.flyToBoundingSphere(sphere, {
    offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), Math.max(300, sphere.radius * 3)),
    duration: 0.6,
    complete: resolve,
    cancel: resolve
  });
});

const rebuildPreviewDistances = (Cesium) => {
  previewCumulativeDistances = [0];
  for (let index = 1; index < previewPath.length; index += 1) {
    const nextDistance = previewCumulativeDistances[index - 1]
      + Cesium.Cartesian3.distance(previewPath[index - 1], previewPath[index]);
    previewCumulativeDistances.push(nextDistance);
  }
  previewTotalDistance.value = previewCumulativeDistances[previewCumulativeDistances.length - 1] || 0;
};

const prepareRoutePreview = async () => {
  if (!canPreviewRoute.value || mapMode.value !== 'buildings' || !viewerInstance.value || !cesiumInstance.value) return;
  const viewer = viewerInstance.value;
  const Cesium = cesiumInstance.value;
  previewPreparing.value = true;
  previewError.value = '';
  invalidateRoutePreview();

  try {
    if (!buildingTileset) {
      throw new Error('3D 白模尚未加载完成，请检查网络或 Cesium Token。');
    }
    if (!await ensureScene3D(viewer, Cesium)) {
      throw new Error('无法进入 3D 场景，不能生成贴楼预览。');
    }
    const resamplePlan = buildResamplePlan(Cesium);
    const cartographics = resamplePlan.map(sample => sample.cartographic);
    await flyCameraToRoute(cartographics, Cesium, viewer);
    if (viewerInstance.value !== viewer) return;

    const visibleEntities = viewer.entities.values.filter((entity) => entity.show);
    visibleEntities.forEach((entity) => { entity.show = false; });
    viewer.scene.requestRender();
    await waitForNextFrame();

    let sampled;
    try {
      sampled = await viewer.scene.sampleHeightMostDetailed(cartographics);
    } finally {
      visibleEntities.forEach((entity) => { entity.show = true; });
    }

    let adjustedCount = 0;
    let maxAdjustment = 0;
    const sampledSurfaceHeights = [];
    previewPath = sampled.map((point, index) => {
      const sampledHeight = Number.isFinite(point.height)
        ? point.height
        : (viewer.scene.globe.getHeight(point) || 0);
      sampledSurfaceHeights.push(sampledHeight);
      const plan = resamplePlan[index];
      const plannedAltitude = props.executeHeightMode === 'realTimeFollowSurface'
        ? sampledHeight + Number(plan?.plannedSurfaceOffset || 0)
        : Number(plan?.plannedAbsoluteAltitude);
      const safeAltitude = sampledHeight + ROUTE_CLEARANCE_METERS;
      const resolvedPlannedAltitude = Number.isFinite(plannedAltitude) ? plannedAltitude : safeAltitude;
      const previewAltitude = Math.max(resolvedPlannedAltitude, safeAltitude);
      const adjustment = Math.max(0, previewAltitude - resolvedPlannedAltitude);
      if (adjustment > 0.05) {
        adjustedCount += 1;
        maxAdjustment = Math.max(maxAdjustment, adjustment);
      }
      return markRaw(Cesium.Cartesian3.fromRadians(
        point.longitude,
        point.latitude,
        previewAltitude
      ));
    });
    previewCameraStates = resamplePlan.map((sample) => sample.cameraState);
    previewSurfaceHeights = sampledSurfaceHeights;
    previewAltitudeAdjustedCount.value = adjustedCount;
    previewMaxAltitudeAdjustment.value = maxAdjustment;

    rebuildPreviewDistances(Cesium);
    if (previewPath.length < 2 || previewTotalDistance.value <= 0) {
      throw new Error('航线采样结果不足，无法播放。');
    }

    previewRouteEntity = markRaw(viewer.entities.add({
      name: '3D 白模贴楼预览航线',
      polyline: {
        positions: previewPath,
        width: 5,
        material: new Cesium.PolylineGlowMaterialProperty({
          color: Cesium.Color.CYAN.withAlpha(0.9),
          glowPower: 0.22
        }),
        depthFailMaterial: Cesium.Color.CYAN.withAlpha(0.35)
      }
    }));
    previewVisualPosition = previewPath[0];
    previewHeadingTip = previewPath[1];
    previewVisualHeading = 0;
    previewDroneIcons ||= createDronePreviewIcons();
    previewDroneEntity = markRaw(viewer.entities.add({
      name: '航线预览无人机',
      position: new Cesium.CallbackProperty(() => previewVisualPosition, false),
      point: {
        pixelSize: 9,
        color: Cesium.Color.fromCssColorString('#ffb020'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      billboard: {
        image: previewDroneIcons.threeD,
        width: 80,
        height: 64,
        rotation: new Cesium.CallbackProperty(() => previewScreenRotation, false),
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        scaleByDistance: new Cesium.NearFarScalar(80, 1.15, 5000, 0.65),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: new Cesium.CallbackProperty(
          () => `无人机 · 航向 ${Math.round(Cesium.Math.toDegrees(previewVisualHeading) + 360) % 360}°`,
          false
        ),
        font: 'bold 12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
        pixelOffset: new Cesium.Cartesian2(0, -44),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));
    previewHeadingEntity = markRaw(viewer.entities.add({
      name: '航线预览无人机航向',
      polyline: {
        positions: new Cesium.CallbackProperty(
          () => (previewVisualPosition && previewHeadingTip ? [previewVisualPosition, previewHeadingTip] : []),
          false
        ),
        width: 4,
        material: new Cesium.PolylineArrowMaterialProperty(Cesium.Color.fromCssColorString('#ffb020')),
        depthFailMaterial: new Cesium.PolylineArrowMaterialProperty(Cesium.Color.fromCssColorString('#ffb020').withAlpha(0.55)),
        arcType: Cesium.ArcType.NONE
      }
    }));
    previewPathVersion.value += 1;
    updateRoutePreviewPosition(0);
    viewer.scene.requestRender();
  } catch (error) {
    console.error('Failed to prepare building-aware route preview.', error);
    invalidateRoutePreview();
    previewError.value = error?.message || '航线贴楼采样失败，请确认 3D 白模已加载。';
  } finally {
    previewPreparing.value = false;
  }
};

const findPreviewSegment = (distance) => {
  for (let index = 1; index < previewCumulativeDistances.length; index += 1) {
    if (previewCumulativeDistances[index] >= distance) return index - 1;
  }
  return Math.max(0, previewCumulativeDistances.length - 2);
};

const getPreviewHeading = (position, nextPosition, Cesium) => {
  const transform = Cesium.Transforms.eastNorthUpToFixedFrame(position);
  const inverse = Cesium.Matrix4.inverseTransformation(transform, new Cesium.Matrix4());
  const localNext = Cesium.Matrix4.multiplyByPoint(inverse, nextPosition, new Cesium.Cartesian3());
  return Math.atan2(localNext.x, localNext.y);
};

const getPreviewCameraState = (segmentIndex, fraction) => {
  const start = previewCameraStates[segmentIndex] || { pitch: -45, zoomFactor: 1, yaw: 0 };
  const end = previewCameraStates[segmentIndex + 1] || start;
  return {
    pitch: interpolateNumber(start.pitch, end.pitch, fraction, -45),
    zoomFactor: interpolateNumber(start.zoomFactor, end.zoomFactor, fraction, 1),
    yaw: interpolateHeadingDegrees(start.yaw, end.yaw, fraction)
  };
};

const updateRoutePreviewFov = (position, cameraState, surfaceHeight, force = false) => {
  const viewer = viewerInstance.value;
  const Cesium = cesiumInstance.value;
  if (!viewer || !Cesium || !position || !cameraState) return;

  routePreviewDronePosition.value = markRaw(Cesium.Cartesian3.clone(position, new Cesium.Cartesian3()));
  previewGimbalPitch.value = cameraState.pitch;
  previewZoomFactor.value = cameraState.zoomFactor;

  const updateTime = Date.now();
  const shouldRebuild = force
    || !previewPlaying.value
    || previewLastFovUpdateAt === 0
    || updateTime - previewLastFovUpdateAt >= 80;
  if (!shouldRebuild) return;

  const cartographic = Cesium.Cartographic.fromCartesian(position);
  if (!cartographic) return;
  const absoluteAltitude = Number(cartographic.height) || 0;
  const resolvedSurfaceHeight = Number.isFinite(Number(surfaceHeight)) ? Number(surfaceHeight) : 0;
  const dronePos = {
    lng: Cesium.Math.toDegrees(cartographic.longitude),
    lat: Cesium.Math.toDegrees(cartographic.latitude),
    alt: absoluteAltitude,
    executeHeightMode: 'WGS84'
  };
  const gimbalAtt = {
    yaw: normalizeHeadingDegrees(cameraState.yaw),
    pitch: cameraState.pitch
  };
  const zoomFocalLength = 24 * cameraState.zoomFactor;

  routePreviewWideFovData.value = {
    ...buildFrustumData(dronePos, gimbalAtt, 24, 'yellow', absoluteAltitude, resolvedSurfaceHeight, Cesium),
    altitude: absoluteAltitude,
    absAltitude: absoluteAltitude
  };
  routePreviewZoomFovData.value = {
    ...buildFrustumData(dronePos, gimbalAtt, zoomFocalLength, 'lime', absoluteAltitude, resolvedSurfaceHeight, Cesium),
    altitude: absoluteAltitude,
    absAltitude: absoluteAltitude
  };
  previewLastFovUpdateAt = updateTime;
};

const updatePreviewScreenRotation = (viewer, Cesium) => {
  if (!previewVisualPosition || !previewHeadingTip) return;
  const start = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, previewVisualPosition);
  const end = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, previewHeadingTip);
  if (!start || !end) return;
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) || Math.hypot(deltaX, deltaY) < 0.5) return;

  // 两套 SVG 均以图标顶部为机头。Cesium Billboard.rotation 为逆时针正方向，
  // 浏览器屏幕 Y 轴向下，因此对屏幕前向向量取相反角度。
  previewScreenRotation = -Math.atan2(deltaX, -deltaY);
};

const updatePreviewBillboardForScene = (viewer, Cesium) => {
  if (!previewDroneEntity?.billboard || !previewDroneIcons) return;
  const currentMode = viewer.scene.mode;
  if (previewIconSceneMode === currentMode) return;
  const is2D = currentMode === Cesium.SceneMode.SCENE2D;
  previewDroneEntity.billboard.image = is2D ? previewDroneIcons.twoD : previewDroneIcons.threeD;
  previewDroneEntity.billboard.width = is2D ? 60 : 80;
  previewDroneEntity.billboard.height = is2D ? 60 : 64;
  previewIconSceneMode = currentMode;
};

const captureThirdPersonRange = (viewer, Cesium, previousTarget) => {
  if (previewCameraFollowMode !== 'third' || !previousTarget || !viewer.camera.positionWC) return;
  const range = Cesium.Cartesian3.distance(viewer.camera.positionWC, previousTarget);
  if (Number.isFinite(range)) {
    previewThirdPersonRange = Math.max(5, Math.min(50000, range));
  }
};

const capture2DFrustumWidth = (viewer) => {
  const frustum = viewer.camera.frustum;
  const width = Number(frustum?.right) - Number(frustum?.left);
  if (Number.isFinite(width) && width > 0) {
    preview2DFrustumWidth = Math.max(10, Math.min(50000000, width));
  }
};

const resolveFirstPersonCameraPosition = (viewer, Cesium, previousTarget, currentTarget, currentLocalFrame) => {
  if (previewCameraFollowMode !== 'first' || !previousTarget || !viewer.camera.positionWC) {
    const cartographic = Cesium.Cartographic.fromCartesian(currentTarget);
    return Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      cartographic.height + 2
    );
  }

  // 将相机在上一架无人机局部 ENU 坐标系中的偏移搬到新位置，
  // 用户通过缩放控件或滚轮改变的距离不会被下一帧覆盖。
  const previousFrame = Cesium.Transforms.eastNorthUpToFixedFrame(previousTarget);
  const inversePreviousFrame = Cesium.Matrix4.inverseTransformation(previousFrame, new Cesium.Matrix4());
  const localCameraOffset = Cesium.Matrix4.multiplyByPoint(
    inversePreviousFrame,
    viewer.camera.positionWC,
    new Cesium.Cartesian3()
  );
  return Cesium.Matrix4.multiplyByPoint(
    currentLocalFrame,
    localCameraOffset,
    new Cesium.Cartesian3()
  );
};

const followPreviewCamera = (position, nextPosition, cameraState) => {
  const viewer = viewerInstance.value;
  const Cesium = cesiumInstance.value;
  if (!viewer || !Cesium) return;
  const previousPreviewPosition = previewVisualPosition;
  const routeHeading = getPreviewHeading(position, nextPosition, Cesium);
  const heading = Number.isFinite(Number(cameraState?.yaw))
    ? Cesium.Math.toRadians(normalizeHeadingDegrees(cameraState.yaw))
    : routeHeading;
  previewVisualPosition = position;
  const localDirection = new Cesium.Cartesian3(Math.sin(heading), Math.cos(heading), 0);
  const localFrame = Cesium.Transforms.eastNorthUpToFixedFrame(position);
  const worldDirection = Cesium.Matrix4.multiplyByPointAsVector(localFrame, localDirection, new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(worldDirection, worldDirection);
  previewHeadingTip = Cesium.Cartesian3.add(
    position,
    Cesium.Cartesian3.multiplyByScalar(worldDirection, 35, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );
  previewVisualHeading = heading;

  const is2D = viewer.scene.mode === Cesium.SceneMode.SCENE2D;
  updatePreviewBillboardForScene(viewer, Cesium);
  const showAircraftMarker = is2D || previewViewMode.value !== 'first';
  if (previewDroneEntity) previewDroneEntity.show = showAircraftMarker;
  if (previewHeadingEntity) previewHeadingEntity.show = showAircraftMarker;

  if (is2D) {
    capture2DFrustumWidth(viewer);
    unlockPreviewCamera();
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    const viewHeight = preview2DFrustumWidth
      || Math.max(10, Number(viewer.camera.positionCartographic?.height) || 1000);
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        viewHeight
      ),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }
    });
    previewCameraFollowMode = '2d';
    updatePreviewScreenRotation(viewer, Cesium);
    return;
  }

  if (previewViewMode.value === 'first') {
    unlockPreviewCamera();
    const eyePosition = resolveFirstPersonCameraPosition(
      viewer,
      Cesium,
      previousPreviewPosition,
      position,
      localFrame
    );
    viewer.camera.setView({
      destination: eyePosition,
      orientation: { heading, pitch: 0, roll: 0 }
    });
    previewCameraFollowMode = 'first';
  } else {
    captureThirdPersonRange(viewer, Cesium, previousPreviewPosition);
    viewer.camera.lookAt(
      position,
      new Cesium.HeadingPitchRange(
        heading,
        Cesium.Math.toRadians(-30),
        previewThirdPersonRange
      )
    );
    unlockPreviewCamera();
    previewCameraFollowMode = 'third';
  }
  updatePreviewScreenRotation(viewer, Cesium);
};

const updateRoutePreviewPosition = (distance) => {
  if (!previewReady.value || !cesiumInstance.value || !previewDroneEntity) return;
  const Cesium = cesiumInstance.value;
  const total = previewTotalDistance.value;
  previewDistance = Math.max(0, Math.min(total, Number(distance) || 0));
  const segmentIndex = findPreviewSegment(previewDistance);
  const startDistance = previewCumulativeDistances[segmentIndex];
  const endDistance = previewCumulativeDistances[segmentIndex + 1];
  const fraction = endDistance > startDistance
    ? (previewDistance - startDistance) / (endDistance - startDistance)
    : 0;
  const position = Cesium.Cartesian3.lerp(
    previewPath[segmentIndex],
    previewPath[segmentIndex + 1],
    fraction,
    new Cesium.Cartesian3()
  );
  const cameraState = getPreviewCameraState(segmentIndex, fraction);
  const surfaceHeight = interpolateNumber(
    previewSurfaceHeights[segmentIndex],
    previewSurfaceHeights[segmentIndex + 1],
    fraction,
    0
  );
  previewProgress.value = total > 0 ? (previewDistance / total) * 100 : 0;
  followPreviewCamera(position, previewPath[segmentIndex + 1], cameraState);
  updateRoutePreviewFov(
    position,
    cameraState,
    surfaceHeight,
    previewDistance <= 0 || previewDistance >= total
  );
  viewerInstance.value?.scene?.requestRender?.();
};

const runRoutePreviewFrame = (timestamp) => {
  if (!previewPlaying.value) return;
  const previousTimestamp = previewLastTimestamp || timestamp;
  const deltaSeconds = Math.min(0.1, Math.max(0, (timestamp - previousTimestamp) / 1000));
  previewLastTimestamp = timestamp;
  updateRoutePreviewPosition(previewDistance + deltaSeconds * Math.max(0.1, Number(previewSpeed.value) || 10));

  if (previewDistance >= previewTotalDistance.value) {
    stopRoutePreviewFrame();
    previewFinished.value = true;
    unlockPreviewCamera();
    return;
  }
  previewRafId = requestAnimationFrame(runRoutePreviewFrame);
};

const toggleRoutePreview = () => {
  if (!previewReady.value) return;
  if (previewPlaying.value) {
    stopRoutePreviewFrame();
    unlockPreviewCamera();
    return;
  }
  if (previewFinished.value || previewDistance >= previewTotalDistance.value) {
    previewFinished.value = false;
    updateRoutePreviewPosition(0);
  }
  previewPlaying.value = true;
  previewLastTimestamp = 0;
  previewRafId = requestAnimationFrame(runRoutePreviewFrame);
};

const resetRoutePreview = () => {
  stopRoutePreviewFrame();
  previewFinished.value = false;
  if (previewReady.value) updateRoutePreviewPosition(0);
  unlockPreviewCamera();
};

const seekRoutePreview = (progress) => {
  if (!previewReady.value) return;
  previewFinished.value = false;
  updateRoutePreviewPosition((Math.max(0, Math.min(100, Number(progress) || 0)) / 100) * previewTotalDistance.value);
  if (!previewPlaying.value) unlockPreviewCamera();
};

const onViewerReadyInternal = ({ Cesium, viewer }) => {
  cesiumInstance.value = markRaw(Cesium);
  viewerInstance.value = markRaw(viewer);
  Cesium.Ion.defaultAccessToken = cesiumAccessToken;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
  enableSceneNavigation(viewer);
  viewer.scene.globe.baseColor = Cesium.Color.BLACK;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.globe.showGroundAtmosphere = true;
  viewer.scene.fog.enabled = true;

  applyMapMode();

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  eventHandler.value = handler;
  handler.setInputAction((m) => {
    if (!viewerInstance.value || !cesiumInstance.value) return;
    const ellipsoid = viewerInstance.value.scene.globe.ellipsoid;
    const cartesian = viewerInstance.value.camera.pickEllipsoid(m.endPosition, ellipsoid);
    if (!cartesian) return;
    const cartographic = ellipsoid.cartesianToCartographic(cartesian);
    hoverPos.value = {
      lat: cesiumInstance.value.Math.toDegrees(cartographic.latitude),
      lng: cesiumInstance.value.Math.toDegrees(cartographic.longitude),
      asl: viewerInstance.value.scene.globe.getHeight(cartographic) || 0
    };
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  if (pendingFovState.value) {
    const pending = pendingFovState.value;
    pendingFovState.value = null;
    updateFov(pending.dronePos, pending.gimbalAtt, pending.focalLength, pending.previewMode);
  }

  if (pendingVirtualFlightState.value) {
    const pending = pendingVirtualFlightState.value;
    pendingVirtualFlightState.value = null;
    updateVirtualFlight(pending.dronePos, pending.gimbalAtt, pending.focalLength);
  }

  centerLineMaterial.value = markRaw(new Cesium.PolylineDashMaterialProperty({
    color: Cesium.Color.fromCssColorString('rgba(0, 255, 0, 0.6)'),
    dashLength: 8
  }));
  measurementLineMaterial.value = markRaw(new Cesium.PolylineDashMaterialProperty({
    color: Cesium.Color.fromCssColorString('rgba(241, 196, 15, 0.8)'),
    dashLength: 12
  }));

  locateToCurrentPosition();
};

const locateToCurrentPosition = () => {
  if (hasAutoLocated.value || props.waypoints?.length > 0) return;
  if (!viewerInstance.value || !cesiumInstance.value || !navigator.geolocation) return;

  hasAutoLocated.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (props.waypoints?.length > 0 || !viewerInstance.value || !cesiumInstance.value) return;

      const Cesium = cesiumInstance.value;
      const viewer = viewerInstance.value;
      const { latitude, longitude } = position.coords;
      const height = 1000;
      const targetCamera = {
        position: { lng: longitude, lat: latitude, height },
        heading: 0,
        pitch: -90,
        roll: 0
      };

      camera.value = targetCamera;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0
        },
        duration: 1.2
      });
    },
    (error) => {
      console.warn('Failed to locate current position.', error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
};

const onMapClick = (e) => {
  if (!viewerInstance.value || !cesiumInstance.value) return;
  const windowPosition = e.windowPosition || e.position;
  let cartesian = viewerInstance.value.scene.pickPosition(windowPosition);
  if (!cesiumInstance.value.defined(cartesian)) {
    const ray = viewerInstance.value.camera.getPickRay(windowPosition);
    cartesian = viewerInstance.value.scene.globe.pick(ray, viewerInstance.value.scene);
  }
  if (!cesiumInstance.value.defined(cartesian)) return;
  const carto = cesiumInstance.value.Cartographic.fromCartesian(cartesian);

  cesiumInstance.value.sampleTerrainMostDetailed(viewerInstance.value.terrainProvider, [carto]).then(samples => {
    const terrainHeight = samples[0]?.height || 0;
    emit('map-click', {
      lat: cesiumInstance.value.Math.toDegrees(carto.latitude),
      lng: cesiumInstance.value.Math.toDegrees(carto.longitude),
      terrainHeight: Math.round(terrainHeight)
    });
  }).catch(() => {
    const terrainHeight = viewerInstance.value.scene.globe.getHeight(carto) || 0;
    emit('map-click', {
      lat: cesiumInstance.value.Math.toDegrees(carto.latitude),
      lng: cesiumInstance.value.Math.toDegrees(carto.longitude),
      terrainHeight: Math.round(terrainHeight)
    });
  });
};

const toggleSceneMode = async () => {
  if (!viewerInstance.value || !cesiumInstance.value) return;
  const viewer = viewerInstance.value;
  const Cesium = cesiumInstance.value;

  if (viewer.scene.mode === Cesium.SceneMode.MORPHING) {
    viewer.scene.completeMorph();
  }

  const canvas = viewer.scene.canvas;
  const width = canvas.clientWidth || 1024;
  const heightCanvas = canvas.clientHeight || 768;
  const windowPosition = new Cesium.Cartesian2(width / 2, heightCanvas / 2);
  const ray = viewer.camera.getPickRay(windowPosition);
  const cartesian = viewer.scene.globe.pick(ray, viewer.scene);

  const targetCarto = cartesian
    ? Cesium.Cartographic.fromCartesian(cartesian)
    : (viewer.camera.positionCartographic
      || Cesium.Cartographic.fromCartesian(viewer.camera.positionWC || viewer.camera.position));
  if (!targetCarto || !Number.isFinite(targetCarto.longitude) || !Number.isFinite(targetCarto.latitude)) return;

  const lon = Cesium.Math.toDegrees(targetCarto.longitude);
  const lat = Cesium.Math.toDegrees(targetCarto.latitude);
  const height = Number(viewer.camera.positionCartographic?.height || targetCarto.height || 1000);
  const headingRad = viewer.camera.heading;

  const isCurrently2D = viewer.scene.mode === Cesium.SceneMode.SCENE2D;
  if (!isCurrently2D && mapMode.value === 'buildings') {
    // OSM 3D Tiles 不参与 2D 渲染。先销毁白模并恢复标准地图，再切换场景，
    // 避免 ModelSceneGraph 在 computeModelMatrix2D 阶段读取无效投影中心。
    mapMode.value = 'standard';
    await applyMapMode({ preservePreview: true });
    if (viewerInstance.value !== viewer) return;
  }

  const switched = isCurrently2D
    ? await ensureScene3D(viewer, Cesium)
    : await ensureScene2D(viewer, Cesium);
  if (!switched || viewerInstance.value !== viewer) return;

  if (previewReady.value) {
    updateRoutePreviewPosition(previewDistance);
    return;
  }

  const is3D = viewer.scene.mode === Cesium.SceneMode.SCENE3D;
  const targetPitchDeg = isCurrently2D ? -15 : -90;
  const targetPitchRad = Cesium.Math.toRadians(targetPitchDeg);

  if (props.waypoints?.length > 0) {
    const firstWp = props.waypoints[0];
    const gH = viewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(firstWp.lng, firstWp.lat)) || 0;
    const positions = props.waypoints.map(wp => Cesium.Cartesian3.fromDegrees(wp.lng, wp.lat, gH + (wp.height || 0)));
    const sphere = Cesium.BoundingSphere.fromPoints(positions);
    const range = Math.max(sphere.radius * (is3D ? 3.0 : 2.5), 1000);

    viewer.camera.flyToBoundingSphere(sphere, {
      offset: new Cesium.HeadingPitchRange(headingRad, targetPitchRad, range),
      duration: 1.0
    });

    camera.value = {
      position: { lng: lon, lat: lat, height: range },
      heading: Cesium.Math.toDegrees(headingRad),
      pitch: targetPitchDeg,
      roll: 0
    };
  } else {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      orientation: { heading: headingRad, pitch: targetPitchRad, roll: 0 },
      duration: 1.0
    });
    camera.value = {
      position: { lng: lon, lat: lat, height },
      heading: Cesium.Math.toDegrees(headingRad),
      pitch: targetPitchDeg,
      roll: 0
    };
  }
};

const resolveDroneAbsoluteAltitude = (dronePos, viewer, Cesium) => {
  let absAlt = Number(dronePos.alt);
  const executeHeightMode = dronePos.executeHeightMode || props.executeHeightMode;
  const isRel = executeHeightMode === 'relativeToStartPoint';
  const isAGL = executeHeightMode === 'realTimeFollowSurface';

  let groundHeight = 0;
  if (dronePos.terrainHeight !== undefined && dronePos.terrainHeight !== null) {
    groundHeight = Number(dronePos.terrainHeight);
  } else if (dronePos.lng && dronePos.lat) {
    const carto = Cesium.Cartographic.fromDegrees(dronePos.lng, dronePos.lat);
    groundHeight = viewer.scene.globe.getHeight(carto) || 0;
  }

  if (isRel) {
    let takeoffH = Number(props.takeoffPoint?.asl || props.takeoffPoint?.height || 0);
    if (takeoffH === 0 && props.waypoints && props.waypoints.length > 0) {
      const firstWp = props.waypoints[0];
      const firstCarto = Cesium.Cartographic.fromDegrees(Number(firstWp.lng), Number(firstWp.lat));
      takeoffH = (firstWp.terrainHeight !== undefined && firstWp.terrainHeight !== null)
        ? Number(firstWp.terrainHeight)
        : (viewer.scene.globe.getHeight(firstCarto) || groundHeight);
    }

    if (!takeoffH && props.takeoffPoint?.lng) {
      const cartoBase = Cesium.Cartographic.fromDegrees(props.takeoffPoint.lng, props.takeoffPoint.lat);
      takeoffH = viewer.scene.globe.getHeight(cartoBase) || 0;
      if (takeoffH) emit('update:takeoffHeight', takeoffH);
    }

    if (!takeoffH) {
      takeoffH = groundHeight || 0;
    }

    absAlt += takeoffH;
  } else if (isAGL || (dronePos.isRelative && !isRel)) {
    absAlt += groundHeight;
  }

  return { absAlt, groundHeight };
};

const buildFrustumData = (dronePos, gimbalAtt, focalLength, color, absAlt, groundHeight, Cesium) => {
  const specs = calculateFovFromFocalLength(focalLength);
  const frustum = markRaw(new Cesium.PerspectiveFrustum({
    fov: Cesium.Math.toRadians(specs.hfov),
    aspectRatio: specs.hfov / specs.vfov,
    near: 0.1,
    far: 1500
  }));
  const hpr = markRaw(new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(gimbalAtt.yaw),
    Cesium.Math.toRadians(gimbalAtt.pitch),
    0
  ));
  const orientation = markRaw(Cesium.Quaternion.fromHeadingPitchRoll(hpr));
  const modelMatrix = markRaw(Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(dronePos.lng, dronePos.lat, absAlt)
  ));
  const absoluteDronePos = { ...dronePos, alt: absAlt };
  const projectionPoints = calculateFOVProjection(absoluteDronePos, gimbalAtt, specs, groundHeight);
  const sideProjectionPoints = projectionPoints.length > 1
    ? projectionPoints.slice(0, -1)
    : projectionPoints;
  const cartesianGroundPoints = projectionPoints.map(p => Cesium.Cartesian3.fromDegrees(
    p.lng,
    p.lat,
    (viewerInstance.value.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(p.lng, p.lat)) || groundHeight) + 0.5
  ));
  const cartesianSidePoints = sideProjectionPoints.map(p => {
    const localH = viewerInstance.value.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(p.lng, p.lat)) || groundHeight;
    return Cesium.Cartesian3.fromDegrees(p.lng, p.lat, localH + 0.5);
  });

  return {
    frustum,
    orientation,
    modelMatrix,
    points: cartesianGroundPoints,
    rawPoints: cartesianSidePoints,
    appearance: markRaw(new Cesium.MaterialAppearance({
      material: Cesium.Material.fromType('Color', { color: Cesium.Color.fromCssColorString(color).withAlpha(0.15) }),
      flat: true,
      translucent: true
    })),
    lineAppearance: markRaw(new Cesium.PolylineColorAppearance({ translucent: true })),
    lineAttributes: markRaw({
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString(color).withAlpha(0.8))
    }),
    params: {
      position: { lng: dronePos.lng, lat: dronePos.lat, height: absAlt },
      hfov: specs.hfov,
      vfov: specs.vfov,
      heading: gimbalAtt.yaw,
      pitch: gimbalAtt.pitch,
      distance: 1200
    }
  };
};

const updateFov = async (dronePos, gimbalAtt, focalLength, previewMode = 'waypoint') => {
  if (!dronePos) return;
  pendingFovState.value = { dronePos, gimbalAtt, focalLength, previewMode };
  if (!viewerInstance.value || !cesiumInstance.value) return;
  const Cesium = cesiumInstance.value;
  const viewer = viewerInstance.value;
  fovPreviewMode.value = previewMode || 'waypoint';
  pendingFovState.value = null;
  const { absAlt, groundHeight } = resolveDroneAbsoluteAltitude(dronePos, viewer, Cesium);

  isFovVisible.value = true;
  wideFovData.value = { ...buildFrustumData(dronePos, gimbalAtt, 24, 'yellow', absAlt, groundHeight, Cesium), altitude: dronePos.alt, absAltitude: absAlt };
  zoomFovData.value = { ...buildFrustumData(dronePos, gimbalAtt, focalLength || 24, 'lime', absAlt, groundHeight, Cesium), altitude: dronePos.alt, absAltitude: absAlt };
  fovDronePosition.value = markRaw(Cesium.Cartesian3.fromDegrees(dronePos.lng, dronePos.lat, absAlt));
  virtualDronePosition.value = markRaw(Cesium.Cartesian3.fromDegrees(dronePos.lng, dronePos.lat, absAlt));
  virtualDroneYawRad.value = -((gimbalAtt?.yaw || 0) * Math.PI) / 180;
  virtualDroneColor.value = fovPreviewMode.value === 'virtual' ? '#00aaff' : '#00f2ff';
  centerPointRaw.value = calculateCenterPoint({ ...dronePos, alt: absAlt }, gimbalAtt, groundHeight);
  viewer.scene.requestRender();
};

const updateVirtualFlight = async (dronePos, gimbalAtt, focalLength) => {
  if (!dronePos) return;
  pendingVirtualFlightState.value = { dronePos, gimbalAtt, focalLength };
  if (!viewerInstance.value || !cesiumInstance.value) return;

  const Cesium = cesiumInstance.value;
  const viewer = viewerInstance.value;
  pendingVirtualFlightState.value = null;
  const { absAlt, groundHeight } = resolveDroneAbsoluteAltitude(dronePos, viewer, Cesium);

  virtualDroneVisible.value = true;
  virtualDronePosition.value = markRaw(Cesium.Cartesian3.fromDegrees(dronePos.lng, dronePos.lat, absAlt));
  virtualDroneYawRad.value = -((gimbalAtt?.yaw || 0) * Math.PI) / 180;
  virtualDroneColor.value = '#00aaff';
  virtualWideFovData.value = { ...buildFrustumData(dronePos, gimbalAtt, 24, '#00aaff', absAlt, groundHeight, Cesium), altitude: dronePos.alt, absAltitude: absAlt };
  virtualZoomFovData.value = { ...buildFrustumData(dronePos, gimbalAtt, focalLength || 24, '#00f2ff', absAlt, groundHeight, Cesium), altitude: dronePos.alt, absAltitude: absAlt };
  viewer.scene.requestRender();
};

const flyTo = (c) => {
  if (!viewerInstance.value) return;
  viewerInstance.value.camera.flyTo({ destination: cesiumInstance.value.Cartesian3.fromDegrees(c.lng, c.lat, viewerInstance.value.camera.positionCartographic.height) });
};

const getCurrentPose = () => {
  if (!viewerInstance.value) return null;
  const camera = viewerInstance.value.camera;
  const cartographic = cesiumInstance.value.Cartographic.fromCartesian(camera.positionWC || camera.position);
  const groundHeight = viewerInstance.value.scene.globe.getHeight(cartographic) || 0;
  return {
    position: {
      lng: cesiumInstance.value.Math.toDegrees(cartographic.longitude),
      lat: cesiumInstance.value.Math.toDegrees(cartographic.latitude),
      alt: cartographic.height
    },
    groundHeight,
    heading: cesiumInstance.value.Math.toDegrees(camera.heading),
    pitch: cesiumInstance.value.Math.toDegrees(camera.pitch),
    roll: cesiumInstance.value.Math.toDegrees(camera.roll)
  };
};

const resetTo2D = async () => {
  if (!viewerInstance.value || !cesiumInstance.value) return;
  if (mapMode.value === 'buildings') {
    mapMode.value = 'standard';
    await applyMapMode({ preservePreview: true });
  }
  if (!viewerInstance.value || viewerInstance.value.scene.mode === cesiumInstance.value.SceneMode.SCENE2D) return;
  await ensureScene2D();
  if (previewReady.value) updateRoutePreviewPosition(previewDistance);
};

const clearFov = () => {
  isFovVisible.value = false;
  wideFovData.value = { points: [], rawPoints: [] };
  zoomFovData.value = { points: [], rawPoints: [] };
  fovDronePosition.value = null;
  fovPreviewMode.value = 'idle';
  pendingFovState.value = null;
  centerPointRaw.value = null;
  viewerInstance.value?.scene?.requestRender?.();
};

const clearVirtualFlight = () => {
  virtualDroneVisible.value = false;
  virtualDronePosition.value = null;
  virtualDroneYawRad.value = 0;
  virtualWideFovData.value = { points: [], rawPoints: [] };
  virtualZoomFovData.value = { points: [], rawPoints: [] };
  pendingVirtualFlightState.value = null;
  viewerInstance.value?.scene?.requestRender?.();
};

// --- 5. Watchers ---
watch(() => props.waypoints, (newWps, oldWps) => {
  if (!viewerInstance.value || !cesiumInstance.value || !newWps?.length) return;
  const p = newWps[0];
  if (!p || !p.lng || !p.lat) return; // 关键安全检查

  const oldP = oldWps?.[0];
  const isInitialOrSwitch = !oldP || !oldP.lng || (Math.abs(oldP.lng - p.lng) > 0.0001 || Math.abs(oldP.lat - p.lat) > 0.0001);

  if (isInitialOrSwitch) {
    const viewer = viewerInstance.value;
    const Cesium = cesiumInstance.value;
    const is3D = sceneMode.value === 3;
    const firstWp = newWps[0];
    const refCarto = Cesium.Cartographic.fromDegrees(firstWp.lng, firstWp.lat);
    const groundHeight = viewer.scene.globe.getHeight(refCarto) || 0;
    const positions = newWps.map(wp => Cesium.Cartesian3.fromDegrees(wp.lng, wp.lat, groundHeight + (wp.height || 0)));
    const sphere = Cesium.BoundingSphere.fromPoints(positions);
    const centerCarto = Cesium.Cartographic.fromCartesian(sphere.center);
    const targetPitchDeg = is3D ? -15 : -90;
    const pitchRad = Cesium.Math.toRadians(targetPitchDeg);
    const range = Math.max(sphere.radius * (is3D ? 3.0 : 2.5), 1000);

    viewer.camera.flyToBoundingSphere(sphere, {
      offset: new Cesium.HeadingPitchRange(0, pitchRad, range),
      duration: 1.5
    });

    camera.value = {
      position: { lng: Cesium.Math.toDegrees(centerCarto.longitude), lat: Cesium.Math.toDegrees(centerCarto.latitude), height: range },
      heading: 0, pitch: targetPitchDeg, roll: 0
    };
  }
}, { deep: false });

watch(() => props.waypoints?.length, (newLen, oldLen) => {
  if (oldLen > 0 && newLen === 0 && sceneMode.value === 3 && mapMode.value !== 'buildings') {
    ensureScene2D();
  }
});

watch(
  () => props.waypoints
    .map((point) => {
      const pitch = getWaypointActionNumber(point, ACTION_TYPE.GIMBAL_PITCH, 'gimbalPitchRotateAngle');
      const yaw = getWaypointActionNumber(point, ACTION_TYPE.AIRCRAFT_YAW, 'aircraftYawAngle');
      const zoom = getWaypointActionNumber(point, ACTION_TYPE.ZOOM, 'zoomFactor');
      return [
        Number(point?.lng || 0).toFixed(8),
        Number(point?.lat || 0).toFixed(8),
        Number(point?.height || 0).toFixed(2),
        pitch ?? '',
        yaw ?? '',
        zoom ?? ''
      ].join(',');
    })
    .join('|') + `|${props.executeHeightMode}|${Number(props.takeoffPoint?.asl || props.takeoffPoint?.height || 0).toFixed(2)}`,
  (signature, previousSignature) => {
    if (previousSignature !== undefined && signature !== previousSignature && previewReady.value) {
      invalidateRoutePreview();
    }
  }
);

watch(() => props.routeType, () => {
  if (previewReady.value) invalidateRoutePreview();
});

watch(previewViewMode, () => {
  if (previewReady.value) updateRoutePreviewPosition(previewDistance);
});

// --- 6. Lifecycle ---
onBeforeUnmount(() => {
  mapSwitchSequence += 1;
  invalidateRoutePreview();
  removeBuildingTileset();
  clearFov();
  if (eventHandler.value) {
    try {
      if (!eventHandler.value.isDestroyed?.()) {
        eventHandler.value.destroy();
      }
    } catch (error) {
      console.warn('Failed to destroy Cesium event handler cleanly.', error);
    }
    eventHandler.value = null;
  }
  viewerInstance.value = null;
  cesiumInstance.value = null;
});

defineExpose({ updateFov, updateVirtualFlight, flyTo, getCurrentPose, resetTo2D, toggleSceneMode, sceneMode, mapMode, clearFov, clearVirtualFlight });
</script>
