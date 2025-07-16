const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const otpService = require('../services/otp.service');
const { generateToken } = require('../services/jwt.service');
const { Op } = require('sequelize');

exports.signup = async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, password, otp } = req.body;

    let otpResult = { success: false };


    if (email) {
      otpResult = otpService.verifyOtp(email, otp);
    }
    if (!otpResult.success && phoneNumber) {
      otpResult = otpService.verifyOtp(phoneNumber, otp);
    }

    if (!otpResult.success) {
      return res.status(400).json({ error: otpResult.message || 'Invalid or expired OTP' });
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email },
          { phoneNumber }
        ]
      }
    });
    if (existingUser) {
      return res.status(409).json({ error: 'Email or Phone Number already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email,
      phoneNumber,
      password: hashedPassword
    });

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        uid: user.uid,
        email: user.email,
        phoneNumber: user.phoneNumber,
        fullName: user.fullName,
        role: user.role
      }
    });

  } catch (err) {
    next(err);
  }
};
exports.deleteUserByEmail = async (req, res, next) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.destroy();

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
};


exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({ success: true, token, user: { uid: user.uid, email, phoneNumber: user.phoneNumber, fullName: user.fullName, role: user.role } });
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }

    const otpResult = otpService.verifyOtp(email, otp);

    if (!otpResult.success) {
      return res.status(400).json({ error: otpResult.message || 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    await user.save();

    return res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    next(err);
  }
};


exports.changePassword = async (req, res, next) => {
  try {
    console.log("User is :", req.user);

    const user = req.user;
    const checkUser = await User.findByPk(user.uid)
    const { oldPassword, newPassword } = req.body;

    if (!(await bcrypt.compare(oldPassword, checkUser.password))) {
      return res.status(401).json({ error: 'Old password is incorrect' });
    }

    checkUser.password = await bcrypt.hash(newPassword, 10);
    await checkUser.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};


exports.getUserInfo = async (req, res, next) => {
  try {
    const uid = req.user.uid;

    const user = await User.findOne({ where: { uid } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { password, ...safeUser } = user.toJSON();
    res.json({ success: true, user: safeUser });

  } catch (err) {
    next(err);
  }
};

exports.checkUsernameAvailability = async (req, res, next) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const existingUser = await User.findOne({ where: { username } });

    if (existingUser) {
      return res.status(200).json({ available: false, message: 'Username is already taken.' });
    } else {
      return res.status(200).json({ available: true, message: 'Username is available.' });
    }
  } catch (err) {
    next(err);
  }
};


