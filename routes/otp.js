const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');

// Send OTP (accepts either email or phone)
router.post('/send', otpController.requestOtp);

// Verify OTP
router.post('/verify', otpController.verifyOTP);

module.exports = router;
