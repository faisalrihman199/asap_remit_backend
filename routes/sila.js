const express = require('express');
const router = express.Router();
const { silaController } = require('../controllers');

router.post('/link_sila_account', silaController.linkSilaAccount);
router.post('/get_wallets', silaController.getWallets);
router.post('/send_money', silaController.sendMoney);

module.exports = router;
