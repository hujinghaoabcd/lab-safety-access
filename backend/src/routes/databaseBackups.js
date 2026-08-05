const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const secureAdminController = require('../controllers/secureAdminController');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));
router.get('/:filename', secureAdminController.downloadDatabaseBackup);

module.exports = router;
