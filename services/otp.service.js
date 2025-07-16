const speakeasy = require('speakeasy');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const template = require('./template');
const crypto = require('crypto');

const OTP_EXPIRY_MINUTES = 5;
const STEP_SECONDS = OTP_EXPIRY_MINUTES * 60;

const usedOtps = new Set();
const otpSecrets = new Map(); // Store { identifier -> secret }

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const twilioClient = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Generate a secure random secret
function generateRandomSecret() {
  return crypto.randomBytes(20).toString('hex'); // 40-character secret
}

// Send OTP
exports.sendOTP = async (identifier, method = 'email') => {
  const secret = generateRandomSecret();
  otpSecrets.set(identifier, secret); // Save secret for verification

  const token = speakeasy.totp({
    secret,
    encoding: 'ascii',
    step: STEP_SECONDS,
  });

  console.log('OTP is:', token);

  if (method === 'email') {
    await transporter.sendMail({
      from: `"OTP Service" <${process.env.EMAIL_USER}>`,
      to: identifier,
      subject: 'Your OTP Code',
      html: template.getEmailTemplate(token),
    });
  } else if (method === 'phone') {
    await twilioClient.messages.create({
      body: template.getSmsTemplate(token),
      from: process.env.TWILIO_PHONE,
      to: identifier,
    });
  }

  // Cleanup secret after expiry
  setTimeout(() => otpSecrets.delete(identifier), OTP_EXPIRY_MINUTES * 60 * 1000);

  return { success: true, message: 'OTP sent successfully.' };
};

// Verify OTP
exports.verifyOtp = (identifier, token) => {
  const secret = otpSecrets.get(identifier);
  const tokenKey = `${identifier}-${token}`;

  if (!secret) {
    return { success: false, message: 'No OTP sent or it expired.' };
  }

  if (usedOtps.has(tokenKey)) {
    return { success: false, message: 'OTP already used.' };
  }

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'ascii',
    token,
    step: STEP_SECONDS,
    window: 1,
  });

  if (verified) {
    usedOtps.add(tokenKey);
    setTimeout(() => usedOtps.delete(tokenKey), OTP_EXPIRY_MINUTES * 60 * 1000);
    return { success: true, message: 'OTP verified successfully.' };
  }

  return { success: false, message: 'Invalid or expired OTP.' };
};
