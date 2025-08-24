// services/yellowCardExt.js
const { v4: uuidv4 } = require('uuid');
const YC = require('./yellowCard');

// in-memory caches to reduce roundtrips
const cache = {
  channels: new Map(),   // key: `${country}:${type}` -> channelId
  networks: new Map(),   // key: `${country}:${type}:${bank_code||''}` -> networkId
};

const channelMap = { bank: 'bank_transfer', momo: 'mobile_money' };

// ---- helpers -----------------------------------------------------

async function resolveChannelId({ country='NG', type='bank', channelId }) {
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

async function resolveNetworkId({ country='NG', channelType='bank', channelId, bank_code, bank_name }) {
  const key = `${country}:${channelType}:${bank_code || ''}`;
  if (cache.networks.has(key)) return cache.networks.get(key);

  const params = { country, status: 'active' };
  if (channelId) params.channelId = channelId;
  else params.channel = channelMap[channelType] || 'bank_transfer';

  const { data } = await YC.get('/networks', { params });
  const list = data?.data || data?.networks || data || [];
  if (!Array.isArray(list) || !list.length) throw new Error('No active YC networks found');

  const lc = s => (s || '').toString().toLowerCase();
  const hit =
    list.find(n => bank_code && (n.bankCode === bank_code || n.code === bank_code || n?.metadata?.bankCode === bank_code)) ||
    list.find(n => bank_name && lc(n.name).includes(lc(bank_name))) ||
    list.find(n => lc(n.name).includes('manual')) ||   // sandbox often has "Manual Input"
    list[0];

  const id = hit.id || hit.networkId;
  if (!id) throw new Error('Could not resolve networkId');
  cache.networks.set(key, id);
  return id;
}

// Nigeria-only: verify the account before sending (YC requires it for NG)
async function resolveBankAccountNG({ bankCode, accountNumber }) {
  const { data } = await YC.post('/details/bank', { bankCode, accountNumber });
  // response typically includes accountName / matches, we just bubble it up
  return data;
}

// ---- main --------------------------------------------------------

async function createPaymentSmart({
  amountUSD,              // or use localAmount
  localAmount,
  destCurrency,           // e.g., 'NGN'
  country = 'NG',
  channelType = 'bank',   // 'bank' | 'momo'
  reason = 'other',
  sender = {},            // MUST include { name, country }
  beneficiary = {},       // bank: { name, account_number, bank_code?, bank_name? } | momo: { name, msisdn }
  channelId,
  sequenceId,
  forceAccept = true
}) {
  // 1) channel
  const finalChannelId = await resolveChannelId({ country, type: channelType, channelId });

  // 2) validate inputs
  if (!sender.name || !sender.country) throw new Error('sender.name and sender.country are required');
  if (!beneficiary.name) throw new Error('beneficiary.name is required');
  if (channelType === 'bank' && !beneficiary.account_number) throw new Error('beneficiary.account_number is required for bank payouts');
  if (channelType === 'momo' && !beneficiary.msisdn) throw new Error('beneficiary.msisdn is required for momo payouts');
  if (amountUSD == null && localAmount == null) throw new Error('Provide amountUSD or localAmount');

  // 3) NG bank: resolve account (YC requires this step for Nigeria)
  let resolvedName = beneficiary.name;
  if (channelType === 'bank' && country === 'NG' && beneficiary.bank_code && beneficiary.account_number) {
    try {
      const acc = await resolveBankAccountNG({
        bankCode: beneficiary.bank_code,
        accountNumber: beneficiary.account_number,
      });
      // if YC returns an account name, prefer it (optional)
      resolvedName = acc?.accountName || resolvedName;
    } catch (e) {
      // don’t hard fail here; bubble the YC error to caller
      throw new Error(`Bank resolve failed: ${e?.response?.data?.message || e.message}`);
    }
  }

  // 4) network
  const finalNetworkId = await resolveNetworkId({
    country,
    channelType,
    channelId: finalChannelId,
    bank_code: beneficiary.bank_code,
    bank_name: beneficiary.bank_name
  });

  // 5) assemble body (matches YC "Submit Payment Request")
  //    Required: sequenceId, channelId, reason, sender, amount|localAmount, destination{...}, optional forceAccept
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

  // 6) submit
  try {
    const { data } = await YC.post('/payments', body);
    return data; // { id, status, ... }
  } catch (e) {
    // include YC response to help you debug
    const yc = e?.response?.data;
    throw new Error(`YC /payments failed: ${yc?.code || e.code || 'ERR'} - ${yc?.message || e.message}`);
  }
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
