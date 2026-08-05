const express = require('express');
const router = express.Router();
const wrongbookController = require('../controllers/wrongbookController');
const { authMiddleware } = require('../middleware/auth');

// GET /api/wrongbook/list - 获取错题列表
router.get('/list', authMiddleware, wrongbookController.getList);

// DELETE /api/wrongbook/:id - 删除错题
router.delete('/:id', authMiddleware, wrongbookController.remove);

module.exports = router;

