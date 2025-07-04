// services/sila.service.js
const { ethers } = require('ethers');
const Sila = require('@silamoney/sdk').default;
require('dotenv').config();

// Configure Sila app credentials
const config = {
  handle: process.env.SILA_APP_HANDLE,
  key: process.env.SILA_PRIVATE_KEY
};

Sila.configure(config);
// For production:
// Sila.disableSandbox();
// Sila.setEnvironment('PROD');

/**
 * Generate a new Ethereum wallet key pair (public & private)
 */
exports.generateWalletKeys = () => {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
};

/**
 * Link a bank account using Plaid + Sila
 * Requires user's wallet private key and plaid details
 */
exports.linkAccount = async ({ user_handle, private_key, provider_token, account_name, account_id, plaid_token_type }) => {
  try {
    const response = await Sila.linkAccount(
      user_handle,
      private_key,
      provider_token,
      account_name || 'default',
      account_id,
      plaid_token_type
    );
    return response;
  } catch (error) {
    throw new Error(`Sila linkAccount error: ${error.message}`);
  }
};

/**
 * Get wallets linked to a user
 */
exports.getWallets = async ({ user_handle }) => {
  try {
    const response = await Sila.getWallets(user_handle);
    return response;
  } catch (error) {
    throw new Error(`Sila getWallets error: ${error.message}`);
  }
};

/**
 * Transfer Sila between wallets
 */
exports.sendMoney = async ({ user_handle, amount, source_id, destination_id, route_selection_behavior, private_key }) => {
  try {
    const response = await Sila.transferSila(
      user_handle,
      {
        amount,
        sourceId: source_id,
        destinationId: destination_id,
        processingType: route_selection_behavior || 'STANDARD_ACH'
      },
      private_key
    );
    return response;
  } catch (error) {
    throw new Error(`Sila transferSila error: ${error.message}`);
  }
};
