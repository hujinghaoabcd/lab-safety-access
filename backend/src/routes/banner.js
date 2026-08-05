const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

// H5前端接口（无需认证）
router.get('/list', bannerController.getBanners);

// 后台管理接口（需要认证）
router.get('/', bannerController.getAllBanners);
router.post('/', bannerController.createBanner);
router.put('/:id', bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;

