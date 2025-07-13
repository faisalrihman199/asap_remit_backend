const otpService = require('../services/otp.service');

exports.requestOtp = async (req, res) => {
  try {
    const { email, phone } = req.body;

    const identifier = email || phone;
    const method = email ? 'email' : phone ? 'phone' : null;

    if (!identifier || !method) {
      return res.status(400).json({ success: false, message: 'Email or phone is required.' });
    }

    const result = await otpService.sendOTP(identifier, method);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
  }
};

exports.verifyOTP = (req, res) => {
  try {
    const { email, phone, otp } = req.body;

    const identifier = email || phone;
    if (!identifier || !otp) {
      return res.status(400).json({ success: false, message: 'Identifier and token are required.' });
    }

    const result = otpService.verifyOtp(identifier, otp);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
  }
};
