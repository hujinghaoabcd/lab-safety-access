const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/user/profile - 获取用户信息
router.get('/profile', authMiddleware, userController.getProfile);

// PUT /api/user/profile - 更新用户信息
router.put('/profile', authMiddleware, userController.updateProfile);

// GET /api/user/profile/stats - 获取用户统计数据
router.get('/profile/stats', authMiddleware, userController.getProfileStats);

// PUT /api/user/profile/password - 修改密码
router.put('/profile/password', authMiddleware, userController.changePassword);

// POST /api/user/profile/avatar - 上传/修改头像
router.post(
  '/profile/avatar',
  authMiddleware,
  upload.single('avatar'),
  userController.changeAvatar
);

module.exports = router;

