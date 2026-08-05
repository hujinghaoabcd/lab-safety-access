const express = require('express');
const router = express.Router();
const learningController = require('../controllers/learningController');
const { authMiddleware } = require('../middleware/auth');

// GET /api/learning/list - 获取学习资料列表
router.get('/list', authMiddleware, learningController.getList);

// GET /api/learning/proxy-pdf - PDF 代理接口（解决 CORS 问题）
// 注意：一定要放在 '/:id' 之前，否则会被当作 id 参数匹配
router.get('/proxy-pdf', authMiddleware, learningController.proxyPdf);

// POST /api/learning/progress - 记录学习进度
// 注意：POST 路由要放在 GET /:id 之前，避免被当作 id 参数
router.post('/progress', authMiddleware, learningController.recordProgress);

// POST /api/learning/duration - 记录学习时长
router.post('/duration', authMiddleware, learningController.recordDuration);

// GET /api/learning/:id - 获取学习资料详情
// 注意：动态路由要放在最后，避免匹配其他路由
router.get('/:id', authMiddleware, learningController.getDetail);

module.exports = router;

