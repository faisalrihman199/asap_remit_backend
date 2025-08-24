// services/yellowCard.js
const axios = require('axios');
const crypto = require('crypto');

// If you load dotenv elsewhere, keep this commented.
// require('dotenv').config();

// --- CONFIG ---
// For sandbox testing you can hardcode; otherwise use envs.
const baseURL =
  process.env.YC_BASE_URL ||
  'https://sandbox.api.yellowcard.io/business';

const API_KEY =
  process.env.YC_API_KEY || '32e20a2563bd3cc9b7120dfd05f39148';

const API_SECRET =
  process.env.YC_API_SECRET || '1ad5f97bcc843e5c91b0cebe55fd20bef0bda03a0353b30da2c270848e55695a';

if (!API_KEY || !API_SECRET) {
  throw new Error('Missing YC_API_KEY / YC_API_SECRET (or test hardcodes) for Yellow Card client');
}

const YC = axios.create({ baseURL });

// Build EXACT path to sign: must include '/business', exclude query string
YC.interceptors.request.use((config) => {
  const ts = new Date().toISOString();
  const method = (config.method || 'GET').toUpperCase();

  const basePath = new URL(baseURL).pathname.replace(/\/$/, ''); // '/business'
  const rawUrl = config.url || '';

  // Derive request path whether relative or absolute
  let reqPath;
  if (/^https?:\/\//i.test(rawUrl)) {
    reqPath = new URL(rawUrl).pathname;
  } else {
    reqPath = rawUrl.split('?')[0];
    if (!reqPath.startsWith('/')) reqPath = '/' + reqPath;
  }

  const pathToSign =
    (reqPath === basePath || reqPath.startsWith(basePath + '/'))
      ? reqPath
      : basePath + reqPath;

  let message = `${ts}${pathToSign}${method}`;
  if (method === 'POST' || method === 'PUT') {
    const bodyStr = config.data ? JSON.stringify(config.data) : '';
    const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('base64');
    message += bodyHash;
    if (!config.headers['Content-Type']) config.headers['Content-Type'] = 'application/json';
  }

  const sig = crypto.createHmac('sha256', API_SECRET).update(message).digest('base64');

  config.headers['X-YC-Timestamp'] = ts;
  config.headers.Authorization = `YcHmacV1 ${API_KEY}:${sig}`;
  return config;
});

// Optional: better message when your IP hits Cloudflare WAF
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
    throw err;
  }
);

module.exports = YC;
