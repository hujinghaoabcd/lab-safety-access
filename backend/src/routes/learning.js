const express = require('express');
const router = express.Router();
const learningController = require('../controllers/learningController');
const secureLearningController = require('../controllers/secureLearningController');
const { authMiddleware } = require('../middleware/auth');

router.get('/list', authMiddleware, learningController.getList);
router.get('/proxy-pdf', authMiddleware, secureLearningController.proxyPdf);
router.post('/progress', authMiddleware, secureLearningController.recordProgress);
router.post('/duration', authMiddleware, secureLearningController.recordDuration);
router.get('/:id', authMiddleware, learningController.getDetail);

module.exports = router;
