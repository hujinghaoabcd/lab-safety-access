const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminController = require('../controllers/adminController');
const secureAdminController = require('../controllers/secureAdminController');
const bannerController = require('../controllers/bannerController');
const announcementController = require('../controllers/announcementController');
const learningController = require('../controllers/learningController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

const memoryStorage = multer.memoryStorage();
const excelUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!['.xlsx', '.xls'].includes(extension)) {
      return cb(new Error('仅支持 XLSX 或 XLS 文件'));
    }
    return cb(null, true);
  }
});

const databaseUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!['.db', '.sqlite', '.sqlite3'].includes(extension)) {
      return cb(new Error('仅支持 SQLite 数据库文件'));
    }
    return cb(null, true);
  }
});

const validateSQLiteFile = (req, res, next) => {
  if (!req.file || req.file.buffer.length < 16) {
    return res.status(400).json({ code: 400, message: '数据库文件无效' });
  }
  const header = req.file.buffer.subarray(0, 16).toString('binary');
  if (header !== 'SQLite format 3\u0000') {
    return res.status(400).json({ code: 400, message: '文件不是有效的 SQLite 数据库' });
  }
  return next();
};

// 学习资料 PDF 上传专用存储：保存到 uploads/learning 目录
const learningStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'learning');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const baseName = path.basename(file.originalname || 'document', path.extname(file.originalname || ''));
    const safeName = baseName.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 80) || 'document';
    cb(null, `${safeName}_${Date.now()}.pdf`);
  }
});

const uploadLearningPdf = multer({
  storage: learningStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (extension !== '.pdf' || !['application/pdf', 'application/octet-stream'].includes(file.mimetype)) {
      return cb(new Error('仅支持 PDF 文件'));
    }
    return cb(null, true);
  }
});

// 管理员登录是唯一公开的后台接口。
router.post(
  '/login',
  createRateLimit({ windowMs: 15 * 60 * 1000, max: 8 }),
  secureAdminController.login
);

// 此后的所有后台接口必须持有 role=admin 的有效 JWT。
router.use(authMiddleware, requireRole('admin'));

// 仪表盘统计
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/chart', adminController.getChartData);
router.get('/dashboard/recent-exams', adminController.getRecentExams);

// 用户管理
router.get('/users', adminController.getUsers);
router.post('/users', secureAdminController.createUser);
router.delete('/users/batch', adminController.batchDeleteUsers);
router.post('/users/batch-delete', adminController.batchDeleteUsers);
router.post('/users/import', excelUpload.single('file'), secureAdminController.batchImportUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/status', adminController.toggleUserStatus);
router.put('/users/:id/reset-password', secureAdminController.resetUserPassword);

// 考试管理
router.get('/exams', adminController.getExams);
router.post('/exams', adminController.createExam);
router.put('/exams/:id', adminController.updateExam);
router.delete('/exams/:id', adminController.deleteExam);
router.put('/exams/:id/status', adminController.toggleExamStatus);
router.get('/exams/:id/assignments', adminController.getExamAssignments);
router.put('/exams/:id/assignments', adminController.updateExamAssignments);
router.get('/exams/:id/questions', adminController.getExamQuestions);
router.post('/exams/:id/questions/config', adminController.configExamQuestions);
router.post('/exams/:id/questions/auto-select', adminController.autoSelectQuestions);

// 题库管理
router.get('/questions', adminController.getQuestions);
router.get('/questions/export', adminController.exportQuestions);
router.post('/questions/import', excelUpload.single('file'), adminController.importQuestions);
router.post('/questions', adminController.createQuestion);
router.delete('/questions/batch', adminController.batchDeleteQuestions);
router.post('/questions/batch-delete', adminController.batchDeleteQuestions);
router.put('/questions/:id', adminController.updateQuestion);
router.delete('/questions/:id', adminController.deleteQuestion);

// 考试记录：静态 export 路由必须放在 /:id 之前。
router.get('/records', adminController.getRecords);
router.get('/records/export', adminController.exportRecords);
router.get('/records/:id', adminController.getRecordDetail);
router.delete('/records/:id', adminController.deleteRecord);

// 证书管理
router.get('/certificates', adminController.getCertificates);
router.get('/certificates/export', adminController.exportCertificates);
router.post('/certificates', adminController.issueCertificate);
router.put('/certificates/:id/revoke', adminController.revokeCertificate);
router.put('/certificates/:id/reissue', adminController.reissueCertificate);

// 系统设置
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// 数据库维护（管理员令牌 + SQLite 文件头校验）
router.post('/db/backup-clear', adminController.backupAndClearDatabase);
router.post(
  '/db/restore',
  databaseUpload.single('file'),
  validateSQLiteFile,
  adminController.restoreDatabase
);

// 院系/班级管理
router.get('/departments', adminController.getDepartments);
router.post('/departments', adminController.createDepartment);
router.put('/departments/:id', adminController.updateDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);
router.get('/classes', adminController.getClasses);
router.post('/classes', adminController.createClass);
router.put('/classes/:id', adminController.updateClass);
router.delete('/classes/:id', adminController.deleteClass);

// 跑马灯管理
router.get('/banner', bannerController.getAllBanners);
router.post('/banner', bannerController.createBanner);
router.put('/banner/:id', bannerController.updateBanner);
router.delete('/banner/:id', bannerController.deleteBanner);

// 公告管理
router.get('/announcement', announcementController.getAllAnnouncements);
router.post('/announcement', announcementController.createAnnouncement);
router.put('/announcement/:id', announcementController.updateAnnouncement);
router.delete('/announcement/:id', announcementController.deleteAnnouncement);

// 学习资料管理
router.get('/learning-materials', learningController.adminGetList);
router.post('/learning-materials', learningController.adminCreate);
router.put('/learning-materials/:id', learningController.adminUpdate);
router.delete('/learning-materials/:id', learningController.adminDelete);
router.post('/learning-materials/batch-delete', learningController.adminBatchDelete);
router.post(
  '/learning-materials/upload',
  uploadLearningPdf.single('file'),
  learningController.adminUploadPdf
);

module.exports = router;
