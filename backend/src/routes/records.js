const express = require('express');
const router = express.Router();
const recordsController = require('../controllers/recordsController');
const { authMiddleware } = require('../middleware/auth');

// GET /api/records/list - 获取考试记录列表
router.get('/list', authMiddleware, recordsController.getList);

// GET /api/records/ranking - 获取成绩排行榜
router.get('/ranking', authMiddleware, recordsController.getRanking);

// GET /api/records/:id - 获取考试记录详情
router.get('/:id', authMiddleware, recordsController.getDetail);

module.exports = router;

