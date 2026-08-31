const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

router.post(
  '/login',
  createRateLimit({ windowMs: 15 * 60 * 1000, max: 8 }),
  adminAuthController.login
);
router.post('/logout', adminAuthController.logout);
router.get(
  '/session',
  authMiddleware,
  requireRole('admin'),
  adminAuthController.session
);

module.exports = router;
