import http from 'node:http';
import { generateKMZ } from '../src/utils/kmzGenerator.js';
import {
  getAircraftModelMeta,
  getV2CompatibleWaypointExportMeta
} from '../src/constants/aircraftModels.js';

const PORT = Number(process.env.WAYLINE_API_PORT || process.env.PORT || 8088);
const HOST = process.env.WAYLINE_API_HOST || '0.0.0.0';
const MAX_BODY_SIZE = 20 * 1024 * 1024;

const safeFilename = (value = 'wayline') => {
  const raw = String(value || 'wayline').trim();
  const sanitized = raw
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'wayline';
};

const jsonResponse = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
};

const fileResponse = async (res, blob, filename) => {
  const buffer = Buffer.from(await blob.arrayBuffer());
  res.writeHead(200, {
    'Content-Type': 'application/vnd.google-earth.kmz',
    'Content-Disposition': `attachment; filename="${safeFilename(filename)}.kmz"`,
    'Content-Length': buffer.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(buffer);
};

const readJsonBody = async (req) => {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_SIZE) {
      throw new Error('Request body too large');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const normalizeMissionConfig = (config = {}) => {
  const modelMeta = getAircraftModelMeta(config.aircraftModel);
  if (!modelMeta) return { ...config, routeType: 'waypoint' };

  return {
    ...config,
    routeType: 'waypoint',
    aircraftSeries: config.aircraftSeries || modelMeta.aircraftSeries,
    aircraftModel: modelMeta.id,
    ...getV2CompatibleWaypointExportMeta(config.aircraftModel)
  };
};

const normalizeRequest = (body = {}) => {
  const config = normalizeMissionConfig({
    ...(body.config || body.missionConfig || {}),
    ...(body.aircraftModel ? { aircraftModel: body.aircraftModel } : {})
  });

  return {
    missionName: body.missionName || config.missionName || 'wayline',
    config,
    waypoints: Array.isArray(body.waypoints) ? body.waypoints : []
  };
};

const parseUrl = (req) => new URL(req.url, `http://${req.headers.host || 'localhost'}`);

const handleGenerate = async (req, res) => {
  const body = normalizeRequest(await readJsonBody(req));

  if (body.waypoints.length === 0) {
    jsonResponse(res, 400, {
      code: 400,
      message: 'waypoints cannot be empty'
    });
    return;
  }

  const blob = await generateKMZ(body.config, body.waypoints, null);
  await fileResponse(res, blob, body.missionName);
};

const server = http.createServer(async (req, res) => {
  try {
    const url = parseUrl(req);

    if (req.method === 'OPTIONS') {
      jsonResponse(res, 204, {});
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      jsonResponse(res, 200, { code: 0, message: 'ok' });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/waylines/generate') {
      await handleGenerate(req, res);
      return;
    }

    jsonResponse(res, 404, { code: 404, message: 'Not Found' });
  } catch (error) {
    console.error('[wayline-api] request failed', error);
    jsonResponse(res, 500, {
      code: 500,
      message: error?.message || 'Internal Server Error'
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[wayline-api] listening on http://${HOST}:${PORT}`);
});
