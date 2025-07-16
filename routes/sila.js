const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const upload = multer();
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
  userHandleKey,
  uploadKYCDocuments,
  startAdvancedKYC,
  getKYCVerification,
}=require('../controllers/silaController.js');



router.post('/kyc/documents',authMiddleware, upload.any(), uploadKYCDocuments);
router.get('/kyc/advance',authMiddleware, startAdvancedKYC);
router.get('/kyc/advance-verification',authMiddleware, getKYCVerification);
router.get('/check-handle',authMiddleware, checkHandle);
router.get('/user-handle-key',authMiddleware,userHandleKey);
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
