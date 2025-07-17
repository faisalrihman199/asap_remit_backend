import sila from '../services/silaSDK.js';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import axios from 'axios';
import models from '../models/index.js';


// Configure Sila
sila.configure({
  key: process.env.SILA_PRIVATE_KEY,
  handle: process.env.SILA_APP_HANDLE,
});
sila.setEnvironment(process.env.SILA_ENV || 'sandbox');


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

    const userId = req.user.uid;

    // ✅ Generate wallet
    const wallet = sila.generateWallet();
    const ssn = generateValidSSN();

    // ✅ Create Sila User object
    const user = new sila.User();
    Object.assign(user, {
      firstName,
      lastName,
      address,
      city,
      state,
      zip,
      phone,
      email,
      dateOfBirth: dob,
      cryptoAddress: wallet.address,
      ssn,
      handle,
    });
    user.wallet = wallet;

    // ✅ Register on Sila
    const response = await sila.register(user);

    if (response.data.success) {
      await models.SilaUser.create({
        user_id: userId,
        userHandle: handle,
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        state,
        zip,
        dob,
        ssn,
        cryptoAddress: wallet.address,
        privateKey: wallet.privateKey,
        walletNickname: 'default',
        accountName: null,
        kycStatus: 'not_requested',
        bankLinkStatus: 'unlinked',
        lastSilaReferenceId: response.data.sila_reference_id || null,
      });
    }

    res.status(response.statusCode).json({
      ...response.data,
      wallet: {
        address: wallet.address,
        privateKey: wallet.privateKey,
      }
    });

  } catch (err) {
    console.error('RegisterUser error:', err);
    res.status(500).json({ error: err.message });
  }
};
export const startAdvancedKYC = async (req, res) => {
  try {
    const userId = req.user.uid;
    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const { userHandle, privateKey } = silaUser;

    // 🔁 Trigger Advanced KYC using /kyc
    const response = await sila.initiateAdvancedKYC(userHandle, privateKey);

    if (response.status === 'SUCCESS') {
      await silaUser.update({ kycStatus: 'pending' });
    }

    return res.status(200).json({ result: response });
  } catch (error) {
    console.error('Advanced KYC Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
export const getKYCVerification = async (req, res) => {
  try {
    const userId = req.user.uid;
    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) return res.status(404).json({ error: 'Sila user not found.' });

    const { userHandle, privateKey } = silaUser;

    const verificationUuid = req.query.verification_uuid || null;
    
    

    const result = await sila.getKYCVerification(userHandle, privateKey, verificationUuid);

    res.status(result.statusCode).json(result.data);
  } catch (err) {
    console.error('getKYCVerification error:', err);
    res.status(500).json({ error: err.message });
  }
};
export const ListDocuments = async (req, res) => {
  try {
    const userId = req.user.uid;
    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) return res.status(404).json({ error: 'Sila user not found.' });

    const { userHandle, privateKey } = silaUser;
    const result = await sila.listDocuments(userHandle, privateKey);
    res.status(result.statusCode).json(result.data);
  } catch (err) {
    console.error('List Dosc error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const uploadKYCDocuments = async (req, res) => {
  try {
    const userId = req.user.uid;
    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const { userHandle, privateKey } = silaUser;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }
    const {verification_uuid} =req.body;
    // 👇 Build documents array using correct buffer and metadata format
    const documents = req.files.map((file) => {
      const { fieldname, originalname, mimetype, buffer } = file;

      return {
        name: fieldname.charAt(0).toUpperCase() + fieldname.slice(1),   // e.g. "Passport"
        filename: originalname,                                         // e.g. "passport.jpg"
        mimeType: mimetype,                                             // e.g. "image/jpeg"
        documentType: fieldname,                                        
        description: `Auto-uploaded ${fieldname}`,                      // Optional
        fileBuffer: buffer,                                             // Required for hash
        fileObject: {                                                   // 💥 Key Fix: pass wrapped object
          buffer,
          filename: originalname,
          contentType: mimetype
        }
      };
    });
    console.log("Just before");

    // ✅ Upload to Sila using same tested logic
    const result = await sila.uploadDocuments(userHandle, privateKey, documents,verification_uuid);

    if (!result.data || result.data.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Document upload failed', details: result });
    }

    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('uploadUserDocuments error:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const resumeVerification = async (req, res) => {
  try {
    const userId = req.user.uid;

    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });
    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const { userHandle, privateKey } = silaUser;
    const { verification_uuid, update, doc_ids = [] } = req.body;

    if (!verification_uuid || !update) {
      return res.status(400).json({ error: 'verification_uuid and update are required.' });
    }

    const result = await sila.resumeKYC(
      userHandle,
      privateKey,
      verification_uuid,
      update,
      doc_ids
    );

    res.status(result.statusCode).json(result.data);
  } catch (err) {
    console.error('resumeVerification error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const requestKYC = async (req, res) => {
  try {
    const userId = req.user.uid;

    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const { userHandle, privateKey } = silaUser;
    const response = await sila.requestKYC(userHandle, privateKey);

    if (response.data.status === 'SUCCESS') {
      await silaUser.update({ kycStatus: 'pending' });
    }

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    console.error('requestKYC error:', err);
    res.status(500).json({ error: err.message });
  }
};


export const checkKYC = async (req, res) => {
  try {
    const userId = req.user.uid;

    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const { userHandle, privateKey } = silaUser;

    const response = await sila.checkKYC(userHandle, privateKey);

    if (response.data.status === 'SUCCESS' && response.data.message?.includes('passed')) {
      await silaUser.update({ kycStatus: 'passed' });
    }

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    console.error('checkKYC error:', err);
    res.status(500).json({ error: err.message });
  }
};



export const linkBankDirect = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { accountNumber, routingNumber, accountName } = req.body;

    if (!accountNumber || !routingNumber || !accountName) {
      return res.status(400).json({ error: 'accountNumber, routingNumber, and accountName are required.' });
    }

    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const { userHandle, privateKey } = silaUser;

    const response = await sila.linkAccountDirect(
      userHandle,
      privateKey,
      accountNumber,
      routingNumber,
      accountName
    );

    if (response.data.status === 'SUCCESS') {
      await silaUser.update({ bankLinkStatus: 'linked', accountName });
    }

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    console.error('linkBankDirect error:', err);
    res.status(500).json({ error: err.message });
  }
};


export const linkBankViaPlaid = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { processorToken, accountName } = req.body;

    if (!processorToken || !accountName) {
      return res.status(400).json({ error: 'processorToken and accountName are required.' });
    }

    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const { userHandle, privateKey } = silaUser;

    const response = await sila.linkAccount(
      userHandle,
      privateKey,
      processorToken,
      accountName,
      undefined,
      'processor' // important to mark this as a processor token
    );

    if (response.data.status === 'SUCCESS') {
      await silaUser.update({ bankLinkStatus: 'linked', accountName });
    }

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    console.error('linkBankViaPlaid error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getAccounts = async (req, res) => {
  try {
    const userId = req.user.uid;

    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });
    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const response = await sila.getAccounts(silaUser.userHandle, silaUser.privateKey);
    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



export const getAccountBalance = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { accountName } = req.query;

    if (!accountName) {
      return res.status(400).json({ error: 'accountName is required in query.' });
    }

    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });
    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const response = await sila.getAccountBalance(
      silaUser.userHandle,
      silaUser.privateKey,
      accountName
    );

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getWallets = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { walletId } = req.query;
    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });
    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }
    const filters = {
      uuid: walletId
    }
    const response = await sila.getWallets(
      silaUser.userHandle,
      silaUser.privateKey,
      filters
    );

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getUserWallet = async (req, res) => {
  try {
    const userId = req.user.uid;
    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });
    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const response = await sila.getWallet(
      silaUser.userHandle,
      silaUser.privateKey
    );

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const userHandleKey = async (req, res) => {
  try {
    const userId = req.user.uid;
    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });
    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const response = {
      handle: silaUser.userHandle,
      key: silaUser.privateKey
    };

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//transactions

export const issueSila = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { amount, accountName, source_id, destination_id } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Valid amount is required.' });
    }

    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const transaction_idempotency_id = uuidv4(); // Ensures no duplicate processing

    const response = await sila.issueSila(
      parseInt(amount),
      silaUser.userHandle,
      silaUser.privateKey,
      accountName || silaUser.accountName || 'default',
      undefined, // descriptor
      undefined, // business_uuid
      undefined, // processing_type
      undefined, // cardName
      source_id, // source_id
      destination_id, // destination_id
      transaction_idempotency_id
    );

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const userId = req.user.uid;

    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const response = await sila.getTransactions(
      silaUser.userHandle,
      silaUser.privateKey,

    );

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const cancelTransaction = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { transactionId } = req.query;

    const silaUser = await models.SilaUser.findOne({ where: { user_id: userId } });

    if (!silaUser) {
      return res.status(404).json({ error: 'Sila user not found.' });
    }

    const response = await sila.cancelTransaction(
      silaUser.userHandle,
      silaUser.privateKey,
      transactionId
    );

    res.status(response.statusCode).json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

