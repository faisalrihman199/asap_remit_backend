const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/signup', authController.signup);
router.delete('/delete', authController.deleteUserByEmail);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/change-password', authMiddleware, authController.changePassword);
router.get('/user-info', authMiddleware, authController.getUserInfo);
router.get('/check-username', authController.checkUsernameAvailability);

module.exports = router;
