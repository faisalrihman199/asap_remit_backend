const express = require('express');
const router = express.Router();
const { plaidController } = require('../controllers');

router.post('/link-token', plaidController.createLinkToken);
router.get('/public-token', plaidController.createPublicToken);
router.post('/exchange-token', plaidController.exchangePublicToken);
router.post('/accounts', plaidController.getAccounts);
router.post('/processor-token', plaidController.createProcessorToken);

module.exports = router;
