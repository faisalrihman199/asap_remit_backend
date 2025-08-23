// services/yellowCard.js
const axios = require('axios');
const crypto = require('crypto');

const baseURL = process.env.YC_BASE_URL
  || (process.env.YC_ENV === 'sandbox'
      ? 'https://sandbox.api.yellowcard.io/business'
      : 'https://api.yellowcard.io/business');

const YC = axios.create({ baseURL });

// Build the EXACT path to sign: '/business/...'; no query string
YC.interceptors.request.use((config) => {
  const ts = new Date().toISOString();
  const basePath = new URL(baseURL).pathname.replace(/\/$/, '');   // '/business'
  const raw = config.url || '';
  const relPath = raw.split('?')[0];                               // remove query for signing
  const pathToSign = basePath + (relPath.startsWith('/') ? relPath : `/${relPath}`);
  const method = (config.method || 'GET').toUpperCase();

  let message = `${ts}${pathToSign}${method}`;
  if (method === 'POST' || method === 'PUT') {
    const bodyStr = config.data ? JSON.stringify(config.data) : '';
    const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('base64');
    message += bodyHash;
    if (!config.headers['Content-Type']) config.headers['Content-Type'] = 'application/json';
  }

  const sig = crypto.createHmac('sha256', process.env.YC_API_SECRET).update(message).digest('base64');

  config.headers['X-YC-Timestamp'] = ts;
  config.headers.Authorization = `YcHmacV1 ${process.env.YC_API_KEY}:${sig}`;
  return config;
});

module.exports = YC;
