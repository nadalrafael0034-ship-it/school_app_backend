const express = require('express');
const router = express.Router();
const { login, getMe, changePassword, saveFcmToken } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
router.post('/fcm-token', protect, saveFcmToken);

module.exports = router;
