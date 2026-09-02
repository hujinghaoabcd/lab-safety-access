const express = require('express');
const path = require('path');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');

const AVATAR_MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const inferAvatarMime = (file) => {
  const extension = path.extname(file?.originalname || '').toLowerCase();
  return AVATAR_MIME_BY_EXTENSION[extension] || null;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 2,
    parts: 3,
    fieldNameSize: 100
  },
  fileFilter: (_req, file, cb) => {
    const rawMime = String(file.mimetype || '').toLowerCase();
    const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;

    if (AVATAR_MIME_TYPES.has(rawMime) || AVATAR_MIME_TYPES.has(normalizedMime)) {
      return cb(null, true);
    }

    // Android、微信和部分系统相册可能把正常图片发送成
    // application/octet-stream 或空 MIME。此时仅在扩展名明确属于支持格式时放行，
    // 后续 controller 仍会按 JPEG/PNG/WebP 文件签名验证真实内容。
    if ((!rawMime || rawMime === 'application/octet-stream') && inferAvatarMime(file)) {
      return cb(null, true);
    }

    return cb(new Error('仅支持 JPG、PNG 或 WebP 图片'));
  }
});

const normalizeAvatarMime = (req, _res, next) => {
  if (!req.file) return next();

  const rawMime = String(req.file.mimetype || '').toLowerCase();
  if (rawMime === 'image/jpg') {
    req.file.mimetype = 'image/jpeg';
  } else if (!rawMime || rawMime === 'application/octet-stream') {
    req.file.mimetype = inferAvatarMime(req.file) || rawMime;
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
