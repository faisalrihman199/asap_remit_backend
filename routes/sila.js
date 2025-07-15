const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
  checkHandle,
  registerUser,
  requestKYC,
  linkBankDirect,
  linkBankViaPlaid,
  getAccountBalance,
  issueSila,
  checkKYC,
  getAccounts,
  getWallets,
  getTransactions,
  cancelTransaction,
  getUserWallet,
}=require('../controllers/silaController.js');



router.get('/check-handle',authMiddleware, checkHandle);
router.post('/register',authMiddleware, registerUser);
router.get('/request-kyc',authMiddleware, requestKYC);
router.get('/check-kyc',authMiddleware, checkKYC);
router.post('/link-account/direct',authMiddleware, linkBankDirect);
router.post('/link-account/plaid',authMiddleware, linkBankViaPlaid);
router.get('/accounts',authMiddleware, getAccounts);
router.get('/wallets',authMiddleware, getWallets);
router.get('/user-wallet',authMiddleware, getUserWallet);
router.get('/account-balance',authMiddleware, getAccountBalance);

// transactions 
router.post('/sila-transact',authMiddleware, issueSila);
router.get('/transactions',authMiddleware, getTransactions);
router.get('/transaction/cancel',authMiddleware, cancelTransaction);


module.exports = router;
