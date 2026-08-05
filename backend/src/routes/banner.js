const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

// Public student-facing endpoint. All management endpoints live under
// /api/admin/banner and are protected by the administrator router.
router.get('/list', bannerController.getBanners);

module.exports = router;
