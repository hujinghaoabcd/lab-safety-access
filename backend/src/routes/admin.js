const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const adminController = require('../controllers/adminController');
const secureAdminController = require('../controllers/secureAdminController');
const secureExamAdminController = require('../controllers/secureExamAdminController');
const secureExportController = require('../controllers/secureExportController');
const secureQuestionController = require('../controllers/secureQuestionController');
const secureQuestionAssignmentController = require('../controllers/secureQuestionAssignmentController');
const secureDeletionController = require('../controllers/secureDeletionController');
const databaseMaintenanceController = require('../controllers/databaseMaintenanceController');
const bannerController = require('../controllers/bannerController');
const announcementController = require('../controllers/announcementController');
const learningController = require('../controllers/learningController');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

const memoryStorage = multer.memoryStorage();
const excelUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 5,
    parts: 6,
    fieldNameSize: 100,
    fieldSize: 64 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const acceptedMimeTypes = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream'
    ]);
    if (extension !== '.xlsx' || !acceptedMimeTypes.has(file.mimetype)) {
      return cb(new Error('仅支持 XLSX 文件'));
    }
    return cb(null, true);
  }
});

const learningStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'learning');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const baseName = path.basename(
      file.originalname || 'document',
      path.extname(file.originalname || '')
    );
    const safeName = baseName.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 80) || 'document';
    cb(null, `${safeName}_${Date.now()}.pdf`);
  }
});

const uploadLearningPdf = multer({
  storage: learningStorage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
    fields: 5,
    parts: 6,
    fieldNameSize: 100,
    fieldSize: 64 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (extension !== '.pdf' || !['application/pdf', 'application/octet-stream'].includes(file.mimetype)) {
      return cb(new Error('仅支持 PDF 文件'));
    }
    return cb(null, true);
  }
});

const validateUploadedPdfSignature = async (req, res, next) => {
  if (!req.file || !req.file.path) {
    return res.status(400).json({ code: 400, message: '请上传 PDF 文件', data: null });
  }

  let handle;
  try {
    handle = await fs.promises.open(req.file.path, 'r');
    const signature = Buffer.alloc(5);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    if (bytesRead !== signature.length || signature.toString('ascii') !== '%PDF-') {
      await handle.close();
      handle = null;
      await fs.promises.rm(req.file.path, { force: true });
      return res.status(400).json({
        code: 400,
        message: '文件内容不是有效的 PDF',
        data: null
      });
    }
    return next();
  } catch (err) {
    await fs.promises.rm(req.file.path, { force: true }).catch(() => {});
    return next(err);
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
};

router.post(
  '/login',
  createRateLimit({ windowMs: 15 * 60 * 1000, max: 8 }),
  secureAdminController.login
);

router.use(authMiddleware, requireRole('admin'));

router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/chart', adminController.getChartData);
router.get('/dashboard/recent-exams', adminController.getRecentExams);

router.get('/users', adminController.getUsers);
router.post('/users', secureAdminController.createUser);
router.delete('/users/batch', secureDeletionController.batchDeleteUsers);
router.post('/users/batch-delete', secureDeletionController.batchDeleteUsers);
router.post('/users/import', excelUpload.single('file'), secureAdminController.batchImportUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', secureDeletionController.deleteUser);
router.put('/users/:id/status', adminController.toggleUserStatus);
router.put('/users/:id/reset-password', secureAdminController.resetUserPassword);

router.get('/exams', adminController.getExams);
router.post('/exams', secureExamAdminController.createExam);
router.put('/exams/:id', secureExamAdminController.updateExam);
router.delete('/exams/:id', secureDeletionController.deleteExam);
router.put('/exams/:id/status', secureExamAdminController.toggleExamStatus);
router.get('/exams/:id/assignments', adminController.getExamAssignments);
router.put('/exams/:id/assignments', secureExamAdminController.updateExamAssignments);
router.get('/exams/:id/questions', adminController.getExamQuestions);
router.post(
  '/exams/:id/questions/config',
  secureQuestionAssignmentController.configExamQuestions
);
router.post(
  '/exams/:id/questions/auto-select',
  secureQuestionAssignmentController.autoSelectQuestions
);

router.get('/questions', adminController.getQuestions);
router.get('/questions/export', secureQuestionController.exportQuestions);
router.post(
  '/questions/import',
  excelUpload.single('file'),
  secureQuestionController.importQuestions
);
router.post('/questions', adminController.createQuestion);
router.delete('/questions/batch', secureDeletionController.batchDeleteQuestions);
router.post('/questions/batch-delete', secureDeletionController.batchDeleteQuestions);
router.put('/questions/:id', adminController.updateQuestion);
router.delete('/questions/:id', secureDeletionController.deleteQuestion);

router.get('/records', adminController.getRecords);
router.get('/records/export', secureExportController.exportRecords);
router.get('/records/:id', adminController.getRecordDetail);
router.delete('/records/:id', secureDeletionController.deleteRecord);

router.get('/certificates', adminController.getCertificates);
router.get('/certificates/export', secureExportController.exportCertificates);
router.post('/certificates', adminController.issueCertificate);
router.put('/certificates/:id/revoke', adminController.revokeCertificate);
router.put('/certificates/:id/reissue', adminController.reissueCertificate);

router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

router.get('/db/migrations', databaseMaintenanceController.migrationStatus);
router.get('/db/backups', databaseMaintenanceController.listBackups);
router.post('/db/backup', databaseMaintenanceController.createBackup);
router.post('/db/backup-clear', databaseMaintenanceController.createBackup);
router.post('/db/restore', databaseMaintenanceController.rejectOnlineRestore);

router.get('/departments', adminController.getDepartments);
router.post('/departments', adminController.createDepartment);
router.put('/departments/:id', adminController.updateDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);
router.get('/classes', adminController.getClasses);
router.post('/classes', adminController.createClass);
router.put('/classes/:id', adminController.updateClass);
router.delete('/classes/:id', adminController.deleteClass);

router.get('/banner', bannerController.getAllBanners);
router.post('/banner', bannerController.createBanner);
router.put('/banner/:id', bannerController.updateBanner);
router.delete('/banner/:id', bannerController.deleteBanner);

router.get('/announcement', announcementController.getAllAnnouncements);
router.post('/announcement', announcementController.createAnnouncement);
router.put('/announcement/:id', announcementController.updateAnnouncement);
router.delete('/announcement/:id', announcementController.deleteAnnouncement);

router.get('/learning-materials', learningController.adminGetList);
router.post('/learning-materials', learningController.adminCreate);
router.put('/learning-materials/:id', learningController.adminUpdate);
router.delete('/learning-materials/:id', learningController.adminDelete);
router.post('/learning-materials/batch-delete', learningController.adminBatchDelete);
router.post(
  '/learning-materials/upload',
  uploadLearningPdf.single('file'),
  validateUploadedPdfSignature,
  learningController.adminUploadPdf
);

module.exports = router;
