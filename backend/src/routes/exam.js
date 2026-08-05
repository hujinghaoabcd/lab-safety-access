const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { authMiddleware } = require('../middleware/auth');

// GET /api/exam/list - 获取考试列表
router.get('/list', authMiddleware, examController.getList);

// GET /api/exam/:id - 获取考试详情
router.get('/:id', authMiddleware, examController.getDetail);

// POST /api/exam/start - 开始考试
router.post('/start', authMiddleware, examController.startExam);

// POST /api/exam/submit - 提交考试
router.post('/submit', authMiddleware, examController.submitExam);

module.exports = router;

