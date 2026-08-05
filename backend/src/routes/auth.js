const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

router.post(
  '/login',
  createRateLimit({ windowMs: 15 * 60 * 1000, max: 12 }),
  authController.login
);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
