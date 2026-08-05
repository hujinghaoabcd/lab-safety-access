const express = require('express');
const router = express.Router();
const qualificationController = require('../controllers/qualificationController');
const { authMiddleware } = require('../middleware/auth');

// GET /api/qualification/status - 获取准入状态
router.get('/status', authMiddleware, qualificationController.getStatus);

// GET /api/qualification/certificate - 获取证书列表
router.get('/certificate', authMiddleware, qualificationController.getCertificates);

module.exports = router;

