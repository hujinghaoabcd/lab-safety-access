const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('仅支持 JPG、PNG 或 WebP 图片'));
    }
    return cb(null, true);
  }
});

const normalizeAvatarMime = (req, _res, next) => {
  // 少数 Android 文件选择器把普通 JPEG 标成 image/jpg。
  // 后续签名校验统一按标准 image/jpeg 处理。
  if (req.file && req.file.mimetype === 'image/jpg') {
    req.file.mimetype = 'image/jpeg';
  }
  next();
};

router.get('/profile', authMiddleware, userController.getProfile);
router.get('/contact', authMiddleware, userController.getContactInfo);
router.put('/profile', authMiddleware, userController.updateProfile);
router.get('/profile/stats', authMiddleware, userController.getProfileStats);
router.put('/profile/password', authMiddleware, userController.changePassword);
router.post(
  '/profile/avatar',
  authMiddleware,
  upload.single('avatar'),
  normalizeAvatarMime,
  userController.changeAvatar
);

module.exports = router;
