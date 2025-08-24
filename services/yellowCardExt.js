// services/yellowCardExt.js
const { v4: uuidv4 } = require('uuid');
const YC = require('./yellowCard');

const cache = {
  channels: new Map(),  // `${country}:${type}` -> channelId
  networks: new Map(),  // `${country}:${type}:${bank_code||''}` -> networkId
};

const channelMap = { bank: 'bank_transfer', momo: 'mobile_money' };

// ---------- helpers ----------

async function resolveChannelId({ channelId, country='NG', type='bank' }) {
  if (channelId) return channelId;
  const key = `${country}:${type}`;
  if (cache.channels.has(key)) return cache.channels.get(key);

  const { data } = await YC.get('/channels', { params: { country, status: 'active', type } });
  const list = data?.data || data?.channels || data || [];
  if (!Array.isArray(list) || !list.length) throw new Error('No active YC channels found');
  const id = list[0].id;
  cache.channels.set(key, id);
  return id;
}

async function resolveNetworkId({ networkId, country='NG', channelType='bank', channelId, bank_code, bank_name }) {
  if (networkId) return networkId;
  const key = `${country}:${channelType}:${bank_code || ''}`;
  if (cache.networks.has(key)) return cache.networks.get(key);

  const params = { country, status: 'active' };
  // NOTE: some tenants misbehave with channelId filter; we’ll prefer channel string
  params.channel = channelMap[channelType] || 'bank_transfer';

  const { data } = await YC.get('/networks', { params });
  const list = data?.data || data?.networks || data || [];
  if (!Array.isArray(list) || !list.length) throw new Error('No active YC networks found');

  const lc = s => (s || '').toString().toLowerCase();
  const hit =
    list.find(n => bank_code && (n.bankCode === bank_code || n.code === bank_code || n?.metadata?.bankCode === bank_code)) ||
    list.find(n => bank_name && lc(n.name).includes(lc(bank_name))) ||
    list.find(n => lc(n.name).includes('manual')) ||
    list[0];

  const id = hit.id || hit.networkId;
  if (!id) throw new Error('Could not resolve networkId');
  cache.networks.set(key, id);
  return id;
}

async function resolveBankAccountNG({ bankCode, accountNumber, networkId }) {
  // YC requires networkId here in NG
  const { data } = await YC.post('/details/bank', { bankCode, accountNumber, networkId });
  return data; // may include { accountName, ... }
}

// ---------- main (with fallback) ----------

/**
 * Tries /payments first (newer flow).
 * If YC returns 5xx / InternalServerError, falls back to /v1/payouts (classic flow).
 */
async function createPaymentSmart({
  amountUSD,
  localAmount,
  destCurrency,
  country = 'NG',
  channelType = 'bank',   // 'bank' | 'momo'
  reason = 'other',
  sender = {},            // { name, country, ... }
  beneficiary = {},       // bank: { name, account_number, bank_code?, bank_name? } | momo: { name, msisdn }
  channelId,
  networkId,
  sequenceId,
  forceAccept = true
}) {
  if (!sender.name || !sender.country) throw new Error('sender.name and sender.country are required');
  if (!beneficiary.name) throw new Error('beneficiary.name is required');
  if (channelType === 'bank' && !beneficiary.account_number) throw new Error('beneficiary.account_number is required for bank payouts');
  if (channelType === 'momo' && !beneficiary.msisdn) throw new Error('beneficiary.msisdn is required for momo payouts');
  if (amountUSD == null && localAmount == null) throw new Error('Provide amountUSD or localAmount');

  // 1) Channel (not used by /v1/payouts, but used by /payments)
  const finalChannelId = await resolveChannelId({ channelId, country, type: channelType });

  // 2) Network (needed for NG bank resolve + /payments destination)
  const finalNetworkId = await resolveNetworkId({
    networkId, country, channelType,
    bank_code: beneficiary.bank_code, bank_name: beneficiary.bank_name
  });

  // 3) NG bank resolve (best practice; some tenants require it)
  let resolvedName = beneficiary.name;
  if (channelType === 'bank' && country === 'NG' && beneficiary.bank_code && beneficiary.account_number) {
    const acc = await resolveBankAccountNG({
      bankCode: beneficiary.bank_code,
      accountNumber: beneficiary.account_number,
      networkId: finalNetworkId
    });
    resolvedName = acc?.accountName || resolvedName;
  }

  // 4) Try /payments (new flow)
  const paymentsBody = {
    sequenceId: sequenceId || uuidv4(),
    channelId: finalChannelId,
    reason,
    forceAccept,
    sender
  };
  if (amountUSD != null) paymentsBody.amount = Number(amountUSD);
  if (localAmount != null) paymentsBody.localAmount = Number(localAmount);
  if (destCurrency) paymentsBody.destinationCurrency = destCurrency;

  if (channelType === 'bank') {
    paymentsBody.destination = {
      accountType: 'bank',
      accountName: resolvedName,
      accountNumber: beneficiary.account_number,
      networkId: finalNetworkId,
      ...(beneficiary.bank_code ? { bankCode: beneficiary.bank_code } : {})
    };
  } else {
    paymentsBody.destination = {
      accountType: 'momo',
      accountName: resolvedName,
      accountNumber: beneficiary.msisdn,
      networkId: finalNetworkId
    };
  }

  try {
    const { data } = await YC.post('/payments', paymentsBody);
    return { data, via: 'payments' };
  } catch (e) {
    const yc = e?.response?.data;
    const status = e?.response?.status;
    const isInternal = status >= 500 || (yc?.code === 'InternalServerError');

    // If it’s not an internal YC issue, bubble it up
    if (!isInternal) {
      throw new Error(`YC /payments rejected: ${yc?.code || status} - ${yc?.message || e.message}`);
    }
  }

  // 5) Fallback: /v1/payouts (classic flow; no networkId required)
  const payoutsBody = {
    reference: `yc_${Date.now()}`,
    amount: Number(amountUSD ?? localAmount),
    // For payouts, explicitly set source/destination currencies + method
    source_currency: amountUSD != null ? 'USD' : (destCurrency || 'NGN'),
    destination_currency: destCurrency || 'NGN',
    payout_method: channelMap[channelType] || 'bank_transfer', // 'bank_transfer' | 'mobile_money'
    beneficiary: channelType === 'bank'
      ? {
          name: resolvedName,
          country,
          bank_code: beneficiary.bank_code,        // e.g., '044'
          account_number: beneficiary.account_number // e.g., '1111111111'
        }
      : {
          name: resolvedName,
          country,
          msisdn: beneficiary.msisdn
        }
  };

  const { data } = await YC.post('/v1/payouts', payoutsBody);
  return { data, via: 'payouts' };
}

async function getPaymentById(id) {
  // Works only for /payments flow. For /v1/payouts, you’d use /v1/payouts/:reference
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
