const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/outPayout.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Orchestrated payout (user wallet -> company wallet -> Yellow Card)
router.post('/out-payouts', authMiddleware, ctrl.orchestratePayout);

// Optional: check status later if you move to async jobs
router.get('/out-payouts/:id', authMiddleware, ctrl.getOutPayoutStatus);

module.exports = router;
