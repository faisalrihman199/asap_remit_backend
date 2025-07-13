import sila from '../services/silaSDK.js';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import axios from 'axios';
// const models = require('../models'); 

// Configure Sila
sila.configure({
    key: '7ddbe59d1424ce53f72cdbc3bf166d1e1cd55902586f290e0e088cd6f9f93ab1', // Add your private key here. USE ENV VARIABLE
    handle: 'asapremit-sandbox-2', // Add your app handle here
})
sila.setEnvironment('sandbox');

// Helper Functions
const generateValidSSN = () => {
  const area = String(Math.ceil(Math.random() * 898)).padStart(3, '0');
  const group = String(Math.ceil(Math.random() * 98)).padStart(2, '0');
  const serial = String(Math.ceil(Math.random() * 9998)).padStart(4, '0');
  return `${area}-${group}-${serial}`;
};

const plaidToken = async () => {
  try {
    const response = await axios.post('https://sandbox.plaid.com/link/item/create', {
      public_key: process.env.PLAID_CLIENT_ID,
      initial_products: ['transactions'],
      institution_id: 'ins_109508',
      credentials: { username: 'user_good', password: 'pass_good' },
    });
    const { public_token: token, accounts } = response.data;
    return { token, accountId: accounts?.[0]?.account_id };
  } catch (error) {
    console.error('Plaid error:', error);
    return {};
  }
};

export const checkHandle = async (req, res) => {
  try {
    const { handle } = req.query;
    const response = await sila.checkHandle(handle);
    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};




export const registerUser = async (req, res) => {
  try {
    const {
      firstName, lastName, address, city, state, zip,
      phone, email, dob, handle,
    } = req.body;

    // ✅ Generate wallet
    const wallet = sila.generateWallet();

    const user = new sila.User();
    Object.assign(user, {
      firstName, lastName, address, city, state, zip,
      phone, email, dateOfBirth: dob, cryptoAddress: wallet.address,
      ssn: generateValidSSN(), handle,
    });

    // ✅ REQUIRED: attach wallet
    user.wallet = wallet;

    const response = await sila.register(user);

    // ✅ Return wallet info for follow-up steps
    res.status(response.statusCode).json({
      ...response.data,
      wallet: {
        address: wallet.address,
        privateKey: wallet.privateKey,
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const requestKYC = async (req, res) => {
  try {
    const { handle, privateKey } = req.body;
    const response = await sila.requestKYC(handle, privateKey);
    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const checkKYC = async (req, res) => {
  try {
    const { handle, privateKey } = req.body;
    const response = await sila.checkKYC(handle, privateKey);
    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const linkBankDirect = async (req, res) => {
  try {
    const { handle, privateKey, accountNumber, routingNumber, accountName } = req.body;
    const response = await sila.linkAccountDirect(handle, privateKey, accountNumber, routingNumber, accountName);
    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const linkBankViaPlaid = async (req, res) => {
  try {
    const { handle, privateKey, accountName, processorToken, withAccountId = false } = req.body;

    let publicToken = processorToken;
    let accountId;

    if (!publicToken) {
      const plaid = await plaidToken();
      publicToken = plaid.token;
      accountId = plaid.accountId;
    }

    const response = await sila.linkAccount(
      handle,
      privateKey,
      publicToken,
      accountName,
      withAccountId ? accountId : undefined
    );

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    console.error('Link Bank via Plaid error:', err.message);
    res.status(500).json({ error: err.message });
  }
};



export const getAccounts = async (req, res) => {
  try {
    const { handle, privateKey } = req.body;
    const response = await sila.getAccounts(handle, privateKey);
    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getAccountBalance = async (req, res) => {
  try {
    const { handle, privateKey, accountName } = req.body;
    const response = await sila.getAccountBalance(handle, privateKey, accountName);
    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const issueSila = async (req, res) => {
  try {
    const {
      amount,
      handle,
      privateKey,
      accountName,
      descriptor,
      businessUuid,
      processingType,
      cardName,
      source_id,
      destination_id,
      transaction_idempotency_id,
    } = req.body;

    const response = await sila.issueSila(
      amount,
      handle,
      privateKey,
      accountName,
      descriptor,
      businessUuid,
      processingType,
      cardName,
      source_id,
      destination_id,
      transaction_idempotency_id || undefined
    );

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    console.error('Issue Sila Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

