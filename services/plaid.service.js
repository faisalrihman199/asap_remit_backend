// Placeholder for Plaid service logic
// services/plaid.service.js
const plaid = require('plaid');
const configuration = new plaid.Configuration({
  basePath: plaid.PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET
    }
  }
});

const client = new plaid.PlaidApi(configuration);

exports.createLinkToken = async (userId) => {
  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Plaid + Sila App',
    products: ['auth'],
    country_codes: ['US'],
    language: 'en',
    redirect_uri: process.env.PLAID_REDIRECT_URI || undefined
  });
  return response.data.link_token;
};

exports.exchangePublicToken = async (publicToken) => {
  const response = await client.itemPublicTokenExchange({ public_token: publicToken });
  return response.data;
};

exports.getAccounts = async (accessToken) => {
  const response = await client.accountsGet({ access_token: accessToken });
  return response.data.accounts;
};

exports.createProcessorToken = async (accessToken, accountId) => {
  const response = await client.processorTokenCreate({
    access_token: accessToken,
    account_id: accountId,
    processor: 'sila_money'
  });
  return response.data.processor_token;
};

exports.createSandboxPublicToken = async () => {
  const response = await client.sandboxPublicTokenCreate({
    institution_id: 'ins_109508', // First Platypus Bank (Sandbox)
    initial_products: ['auth']
  });
  return response.data.public_token;
};