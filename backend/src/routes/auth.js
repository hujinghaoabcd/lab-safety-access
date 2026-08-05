const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/login - 用户登录
router.post('/login', authController.login);

// POST /api/auth/logout - 用户登出
router.post('/logout', authController.logout);

module.exports = router;

