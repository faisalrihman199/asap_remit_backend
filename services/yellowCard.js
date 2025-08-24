// services/yellowCard.js
const axios = require('axios');
const crypto = require('crypto');

const baseURL =
  process.env.YC_BASE_URL || 'https://sandbox.api.yellowcard.io/business';

const API_KEY =
  process.env.YC_API_KEY || '32e20a2563bd3cc9b7120dfd05f39148';
const API_SECRET =
  process.env.YC_API_SECRET || '1ad5f97bcc843e5c91b0cebe55fd20bef0bda03a0353b30da2c270848e55695a';

if (!API_KEY || !API_SECRET) {
  throw new Error('Missing YC_API_KEY / YC_API_SECRET for Yellow Card client');
}

const YC = axios.create({ baseURL });

// small helpers to be compatible with Axios v1’s AxiosHeaders
function setHdr(cfg, key, val) {
  if (!cfg.headers) cfg.headers = {};
  if (typeof cfg.headers.set === 'function') cfg.headers.set(key, val);
  else cfg.headers[key] = val;
}
function getHdr(cfg, key) {
  if (!cfg?.headers) return undefined;
  if (typeof cfg.headers.get === 'function') return cfg.headers.get(key);
  return cfg.headers[key];
}

YC.interceptors.request.use((config) => {
  // 1) normalize URL to always start with '/'
  if (config.url && !/^https?:\/\//i.test(config.url) && !config.url.startsWith('/')) {
    config.url = '/' + config.url;
  }

  // 2) compute exact path to sign: include '/business', exclude query
  const ts = new Date().toISOString();
  const basePath = new URL(baseURL).pathname.replace(/\/$/, ''); // '/business'
  const rawUrl = config.url || '/';
  const relPath = rawUrl.split('?')[0]; // strip query for signing
  const pathToSign = (relPath.startsWith(basePath) ? relPath : basePath + relPath);
  const method = (config.method || 'GET').toUpperCase();

  let message = `${ts}${pathToSign}${method}`;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const bodyStr = config.data ? JSON.stringify(config.data) : '';
    const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('base64');
    message += bodyHash;
    if (!getHdr(config, 'Content-Type')) setHdr(config, 'Content-Type', 'application/json');
  }

  const sig = crypto.createHmac('sha256', API_SECRET).update(message).digest('base64');

  // 3) set headers in a way Axios v1 won’t drop
  setHdr(config, 'X-YC-Timestamp', ts);
  setHdr(config, 'Authorization', `YcHmacV1 ${API_KEY}:${sig}`);

  // Optional debug: set DEBUG_YC=1 in env to log outgoing headers (redacted)
  if (process.env.DEBUG_YC === '1') {
    const auth = getHdr(config, 'Authorization') || getHdr(config, 'authorization');
    const xyc  = getHdr(config, 'X-YC-Timestamp') || getHdr(config, 'x-yc-timestamp');
    console.log('[YC] →', method, config.url, {
      hasAuth: Boolean(auth),
      hasTimestamp: Boolean(xyc),
      contentType: getHdr(config, 'Content-Type') || getHdr(config, 'content-type'),
    });
  }

  return config;
});

// Nice-to-have: friendlier message if Cloudflare blocks you
YC.interceptors.response.use(
  r => r,
  err => {
    const res = err?.response;
    const isHtml403 = res?.status === 403 &&
      typeof res?.data === 'string' &&
      res?.headers?.['content-type']?.includes('text/html');
    if (isHtml403) {
      const ray = /Ray ID:\s*<strong[^>]*>([^<]+)/i.exec(res.data)?.[1] || 'unknown';
      const ip  = /id="cf-footer-ip">([^<]+)/i.exec(res.data)?.[1] || 'unknown';
      err.message = `Yellow Card WAF blocked this IP (${ip}). Cloudflare Ray ID: ${ray}. Ask YC to allowlist this IP for sandbox.`;
    }
    return Promise.reject(err);
  }
);

module.exports = YC;
