const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');

// Public student-facing endpoint. All management endpoints live under
// /api/admin/announcement and are protected by the administrator router.
router.get('/current', announcementController.getAnnouncements);

module.exports = router;
