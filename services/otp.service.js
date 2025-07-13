const speakeasy = require('speakeasy');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const template = require('./template');

const OTP_SECRET_SALT = process.env.OTP_SECRET_SALT || 'my_otp_salt';
const OTP_EXPIRY_MINUTES = 5;
const STEP_SECONDS = OTP_EXPIRY_MINUTES * 60;

const usedOtps = new Set(); // Cache of used OTPs for temporary invalidation

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

function getSecret(identifier) {
  return `${identifier}-${OTP_SECRET_SALT}`;
}

// Send OTP
exports.sendOTP = async (identifier, method = 'email') => {
  const secret = getSecret(identifier);

  const token = speakeasy.totp({
    secret,
    encoding: 'ascii',
    step: STEP_SECONDS,
  });
  console.log("OTP is :", token);
  

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

  return { success: true, message: 'OTP sent successfully.' };
};

// Verify OTP
exports.verifyOtp = (identifier, token) => {
  const secret = getSecret(identifier);
  const tokenKey = `${identifier}-${token}`;

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
    setTimeout(() => usedOtps.delete(tokenKey), OTP_EXPIRY_MINUTES * 60 * 1000); // Auto cleanup
    return { success: true, message: 'OTP verified successfully.' };
  }

  const currentToken = speakeasy.totp({
    secret,
    encoding: 'ascii',
    step: STEP_SECONDS,
  });

  if (currentToken === token) {
    return { success: false, message: 'OTP has expired.' };
  }

  return { success: false, message: 'Invalid OTP.' };
};
