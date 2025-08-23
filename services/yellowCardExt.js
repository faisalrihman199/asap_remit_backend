// services/yellowCardExt.js
const YC = require('./yellowCard');

// Optional: discover a bank networkId for a country.
// If you ALREADY know a networkId, pass it directly and skip this.
async function resolveNetworkId({ country, bank_code, network_name }) {
  // Try by channel=bank_transfer (common for bank payouts)
  const { data } = await YC.get('/networks', { params: { country, channel: 'bank_transfer', status: 'active' } });
  const list = data?.data || data?.networks || data || [];
  // Match by bank_code or fuzzy name
  const hit = list.find(n =>
    (bank_code && (n.bankCode === bank_code || n.code === bank_code)) ||
    (network_name && (n.name || '').toLowerCase().includes(network_name.toLowerCase()))
  ) || list[0]; // fallback to first active network if nothing matched (sandbox often has a "Manual Input" one)
  if (!hit) throw new Error('No active YC network found for given country/channel');
  return hit.id || hit.networkId;
}

// Create a payment (payout/disbursement). Use amount in USD or use localAmount instead.
async function createPayment({ amountUSD, destCurrency, beneficiary, networkId, forceAccept = true }) {
  const finalNetworkId = networkId || await resolveNetworkId({
    country: beneficiary.country,
    bank_code: beneficiary.bank_code,
    network_name: beneficiary.bank_name
  });

  const body = {
    reference: `yc_${Date.now()}`,     // your unique reference (idempotent)
    amount: Number(amountUSD),         // or use `localAmount` if you prefer destination currency exact
    destinationCurrency: destCurrency, // e.g. 'NGN'
    forceAccept,                       // sandbox: skip separate accept call
    destination: {
      accountName: beneficiary.name,
      accountNumber: beneficiary.account_number, // '1111111111' usually succeeds in sandbox
      accountType: 'bank',
      networkId: finalNetworkId
    }
  };

  const { data } = await YC.post('/payments', body);
  return data; // expect { id, status, ... }
}

async function getPaymentById(id) {
  const { data } = await YC.get(`/payments/${encodeURIComponent(id)}`);
  const status = (data?.status || '').toLowerCase();
  return { raw: data, status };
}

module.exports = { createPayment, getPaymentById };
