const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');

// H5前端接口（无需认证）
router.get('/current', announcementController.getAnnouncements);

// 后台管理接口（需要认证）
router.get('/', announcementController.getAllAnnouncements);
router.post('/', announcementController.createAnnouncement);
router.put('/:id', announcementController.updateAnnouncement);
router.delete('/:id', announcementController.deleteAnnouncement);

module.exports = router;

