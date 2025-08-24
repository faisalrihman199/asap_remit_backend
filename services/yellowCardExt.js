// services/yellowCardExt.js
const { v4: uuidv4 } = require('uuid');
const YC = require('./yellowCard');

// tiny in-memory cache so we don’t hit /networks every time
const netCache = new Map(); // key = `${country}:${channelType}:${bank_code || ''}`

// channelType → YC channel query value
const channelMap = {
  bank: 'bank_transfer',
  momo: 'mobile_money',
};

// 1) Find an active channelId (req → env → GET /channels)
async function resolveChannelId({ channelId, country = 'NG', type = 'bank' }) {
  if (channelId) return channelId;

  // optional env fallback (not required)
  if (type === 'bank' && process.env.YC_DEFAULT_BANK_CHANNEL_ID) return process.env.YC_DEFAULT_BANK_CHANNEL_ID;
  if (type === 'momo' && process.env.YC_DEFAULT_MOMO_CHANNEL_ID) return process.env.YC_DEFAULT_MOMO_CHANNEL_ID;

  const { data } = await YC.get('/channels', { params: { country, status: 'active', type } });
  const list = data?.data || data?.channels || data || [];
  if (!Array.isArray(list) || !list.length) throw new Error('No active Yellow Card channels for the given filter.');
  return list[0].id;
}

// 2) Always resolve a networkId (no env needed). We’ll try best match by bank_code/name.
async function resolveNetworkId({ country = 'NG', channelType = 'bank', channelId, bank_code, bank_name }) {
  const cacheKey = `${country}:${channelType}:${bank_code || ''}`;
  if (netCache.has(cacheKey)) return netCache.get(cacheKey);

  const params = { country, status: 'active' };
  // Prefer channelId filter when available; otherwise map channelType → channel
  if (channelId) params.channelId = channelId;
  else params.channel = channelMap[channelType] || 'bank_transfer';

  const { data } = await YC.get('/networks', { params });
  const list = data?.data || data?.networks || data || [];
  if (!Array.isArray(list) || !list.length) throw new Error('No active Yellow Card networks for the given filter.');

  const lc = (s) => (s || '').toString().toLowerCase();
  let hit =
    list.find(n => bank_code && (n.bankCode === bank_code || n.code === bank_code || n?.metadata?.bankCode === bank_code)) ||
    list.find(n => bank_name && lc(n.name).includes(lc(bank_name))) ||
    list.find(n => lc(n.name).includes('manual')) || // sandbox often has a “Manual Input” entry
    list[0];

  const id = hit.id || hit.networkId;
  if (!id) throw new Error('Could not resolve a networkId from /networks.');
  netCache.set(cacheKey, id);
  return id;
}

// 3) Build & create payment — ALWAYS includes destination.networkId
async function createPaymentSmart({
  amountUSD,
  localAmount,
  destCurrency,
  country = 'NG',
  channelType = 'bank',           // 'bank' | 'momo'
  reason = 'other',
  sender = {},                    // { name, country, ... }
  beneficiary = {},               // bank: { name, account_number, bank_code?, bank_name? } | momo: { name, msisdn }
  channelId,
  sequenceId,
  forceAccept = true
}) {
  // Resolve channel first
  const finalChannelId = await resolveChannelId({ channelId, country, type: channelType });

  // Validate basics
  if (!sender.name || !sender.country) throw new Error('sender.name and sender.country are required.');
  if (!beneficiary.name) throw new Error('beneficiary.name is required.');
  if (channelType === 'bank' && !beneficiary.account_number) throw new Error('beneficiary.account_number is required for bank payouts.');
  if (channelType === 'momo' && !beneficiary.msisdn) throw new Error('beneficiary.msisdn is required for momo payouts.');
  if (amountUSD == null && localAmount == null) throw new Error('Provide amountUSD or localAmount.');

  // Resolve networkId (no env needed)
  const finalNetworkId = await resolveNetworkId({
    country,
    channelType,
    channelId: finalChannelId,
    bank_code: beneficiary.bank_code,
    bank_name: beneficiary.bank_name
  });

  // Assemble YC body
  const body = {
    sequenceId: sequenceId || uuidv4(),
    channelId: finalChannelId,
    reason,
    forceAccept,
    sender
  };
  if (amountUSD != null) body.amount = Number(amountUSD);
  if (localAmount != null) body.localAmount = Number(localAmount);
  if (destCurrency) body.destinationCurrency = destCurrency;

  if (channelType === 'bank') {
    body.destination = {
      accountType: 'bank',
      accountName: beneficiary.name,
      accountNumber: beneficiary.account_number,
      networkId: finalNetworkId,
      ...(beneficiary.bank_code ? { bankCode: beneficiary.bank_code } : {})
    };
  } else {
    body.destination = {
      accountType: 'momo',
      accountName: beneficiary.name,
      accountNumber: beneficiary.msisdn,
      networkId: finalNetworkId
    };
  }

  const { data } = await YC.post('/payments', body);
  return data; // { id, status, ... }
}

async function getPaymentById(id) {
  const { data } = await YC.get(`/payments/${encodeURIComponent(id)}`);
  const status = (data?.status || '').toLowerCase();
  return { raw: data, status };
}

module.exports = {
  createPaymentSmart,
  getPaymentById,
  resolveChannelId,
  resolveNetworkId,
};
