const express = require('express');
const router = express.Router();

// Health check route
router.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Sila + PLaid APIs are healthy 🎯' });
});

// Sila & Plaid routes
router.use('/sila',require('./sila'));
router.use('/plaid',require('./plaid'));
router.use('/otp',require('./otp'));
router.use('/auth',require('./auth'));

module.exports = router;
