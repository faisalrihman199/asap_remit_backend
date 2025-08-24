// services/yellowCardExt.js
const { v4: uuidv4 } = require('uuid');
const YC = require('./yellowCard');

/** Try to get an active channelId (bank payouts) for a country.
 *  Order: provided -> env -> fetch from /channels. */
async function resolveChannelId({ channelId, country = 'NG', type = 'bank' }) {
  if (channelId) return channelId;
  if (process.env.YC_DEFAULT_BANK_CHANNEL_ID && type === 'bank') {
    return process.env.YC_DEFAULT_BANK_CHANNEL_ID;
  }
  if (process.env.YC_DEFAULT_MOMO_CHANNEL_ID && type === 'momo') {
    return process.env.YC_DEFAULT_MOMO_CHANNEL_ID;
  }
  // fetch from YC (requires your IP to be allowlisted)
  const { data } = await YC.get('/channels', { params: { country, status: 'active', type } });
  const list = data?.data || data?.channels || data || [];
  if (!Array.isArray(list) || !list.length) {
    throw new Error('No active Yellow Card channels for given filter');
  }
  return list[0].id;
}

/** Optional network resolver: only needed if your use-case requires networkId. */
async function resolveNetworkId({ networkId, country = 'NG', channel = 'bank_transfer' }) {
  if (networkId) return networkId;
  if (process.env.YC_DEFAULT_NETWORK_ID) return process.env.YC_DEFAULT_NETWORK_ID;
  const { data } = await YC.get('/networks', { params: { country, channel, status: 'active' } });
  const list = data?.data || data?.networks || data || [];
  if (!Array.isArray(list) || !list.length) {
    throw new Error('No active Yellow Card networks for given filter');
  }
  return list[0].id || list[0].networkId;
}

/** Create payout (Submit Payment Request).
 *  Required: channelId, reason, sender, sequenceId; destination: bank or momo. */
async function createPaymentSmart({
  amountUSD,
  localAmount,
  destCurrency,
  country = 'NG',
  channelType = 'bank',            // 'bank' | 'momo'
  reason = 'other',
  sender = {},
  beneficiary = {},                // { name, account_number, bank_code, msisdn? }
  channelId,                       // optional; auto if missing
  networkId,                       // optional; auto if needed
  sequenceId,                      // optional; auto if missing
  forceAccept = true
}) {
  // Resolve channel
  const finalChannelId = await resolveChannelId({ channelId, country, type: channelType });

  // Basic validations
  if (!sender.name || !sender.country) throw new Error('sender.name and sender.country are required.');
  if (!beneficiary.name) throw new Error('beneficiary.name is required.');
  if (channelType === 'bank' && !beneficiary.account_number) throw new Error('beneficiary.account_number is required for bank payouts.');
  if (channelType === 'momo' && !beneficiary.msisdn) throw new Error('beneficiary.msisdn is required for momo payouts.');

  // Optionally resolve networkId only if you don’t pass bank_code
  let finalNetworkId = networkId;
  if (channelType === 'bank' && !beneficiary.bank_code && !finalNetworkId) {
    finalNetworkId = await resolveNetworkId({ country });
  }

  // Build body
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
      ...(beneficiary.bank_code ? { bankCode: beneficiary.bank_code } : {}),
      ...(finalNetworkId ? { networkId: finalNetworkId } : {})
    };
  } else {
    body.destination = {
      accountType: 'momo',
      accountName: beneficiary.name,
      accountNumber: beneficiary.msisdn,
      ...(finalNetworkId ? { networkId: finalNetworkId } : {})
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
  resolveNetworkId
};
