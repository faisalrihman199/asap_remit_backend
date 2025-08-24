// services/yellowCardExt.js
const { v4: uuidv4 } = require('uuid');
const YC = require('./yellowCard');

// tiny caches
const cache = {
  channels: new Map(),  // `${country}:${type}` -> channelId
  networks: new Map(),  // `${country}:${type}:${bank_code||''}` -> networkId
};

const channelMap = { bank: 'bank_transfer', momo: 'mobile_money' };

// 1) Channel
async function resolveChannelId({ channelId, country='NG', type='bank' }) {
  if (channelId) return channelId;
  const key = `${country}:${type}`;
  if (cache.channels.has(key)) return cache.channels.get(key);

  const { data } = await YC.get('/channels', { params: { country, status: 'active', type } });
  const list = data?.data || data?.channels || data || [];
  if (!Array.isArray(list) || !list.length) throw new Error('No active Yellow Card channels found');
  const id = list[0].id;
  cache.channels.set(key, id);
  return id;
}

// 2) Network (always resolve; NG bank flows need it)
async function resolveNetworkId({ networkId, country='NG', channelType='bank', channelId, bank_code, bank_name }) {
  if (networkId) return networkId;
  const key = `${country}:${channelType}:${bank_code || ''}`;
  if (cache.networks.has(key)) return cache.networks.get(key);

  const params = { country, status: 'active' };
  if (channelId) params.channelId = channelId;
  else params.channel = channelMap[channelType] || 'bank_transfer';

  const { data } = await YC.get('/networks', { params });
  const list = data?.data || data?.networks || data || [];
  if (!Array.isArray(list) || !list.length) throw new Error('No active Yellow Card networks found');

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

// 3) NG bank resolve (now includes networkId)
async function resolveBankAccountNG({ bankCode, accountNumber, networkId }) {
  // YC requires networkId in request body for NG account resolution
  const { data } = await YC.post('/details/bank', { bankCode, accountNumber, networkId });
  return data; // often includes accountName, etc.
}

// 4) Main: create payment
async function createPaymentSmart({
  amountUSD,
  localAmount,
  destCurrency,
  country = 'NG',
  channelType = 'bank',   // 'bank' | 'momo'
  reason = 'other',
  sender = {},            // must include { name, country }
  beneficiary = {},       // bank: { name, account_number, bank_code?, bank_name? } | momo: { name, msisdn }
  channelId,
  networkId,
  sequenceId,
  forceAccept = true
}) {
  // validations
  if (!sender.name || !sender.country) throw new Error('sender.name and sender.country are required');
  if (!beneficiary.name) throw new Error('beneficiary.name is required');
  if (channelType === 'bank' && !beneficiary.account_number) throw new Error('beneficiary.account_number is required for bank payouts');
  if (channelType === 'momo' && !beneficiary.msisdn) throw new Error('beneficiary.msisdn is required for momo payouts');
  if (amountUSD == null && localAmount == null) throw new Error('Provide amountUSD or localAmount');

  // 1) channel
  const finalChannelId = await resolveChannelId({ channelId, country, type: channelType });

  // 2) network (resolve BEFORE bank-verify so we can pass it)
  const finalNetworkId = await resolveNetworkId({
    networkId, country, channelType, channelId: finalChannelId,
    bank_code: beneficiary.bank_code, bank_name: beneficiary.bank_name
  });

  // 3) NG bank resolve (if applicable)
  let resolvedName = beneficiary.name;
  if (channelType === 'bank' && country === 'NG' && beneficiary.bank_code && beneficiary.account_number) {
    try {
      const acc = await resolveBankAccountNG({
        bankCode: beneficiary.bank_code,
        accountNumber: beneficiary.account_number,
        networkId: finalNetworkId,
      });
      resolvedName = acc?.accountName || resolvedName;
    } catch (e) {
      const yc = e?.response?.data;
      throw new Error(`Bank resolve failed: ${yc?.message || e.message}`);
    }
  }

  // 4) assemble YC body
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
      accountName: resolvedName,
      accountNumber: beneficiary.account_number,
      networkId: finalNetworkId,
      ...(beneficiary.bank_code ? { bankCode: beneficiary.bank_code } : {})
    };
  } else {
    body.destination = {
      accountType: 'momo',
      accountName: resolvedName,
      accountNumber: beneficiary.msisdn,
      networkId: finalNetworkId
    };
  }

  // 5) submit
  const { data } = await YC.post('/payments', body);
  return data;
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
