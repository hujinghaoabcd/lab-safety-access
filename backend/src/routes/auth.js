const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { createRateLimit } = require('../middleware/rateLimit');

router.post(
  '/login',
  createRateLimit({ windowMs: 15 * 60 * 1000, max: 12 }),
  authController.login
);
// Logout is intentionally idempotent and does not require a valid JWT. This
// lets the server clear an expired or otherwise invalid HttpOnly cookie.
router.post('/logout', authController.logout);

module.exports = router;
