const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminController = require('../controllers/adminController');
const bannerController = require('../controllers/bannerController');
const announcementController = require('../controllers/announcementController');
const learningController = require('../controllers/learningController');

// 通用内存上传（如 Excel、数据库备份等）
const upload = multer({ storage: multer.memoryStorage() });

// 学习资料 PDF 上传专用存储：保存到 uploads/learning 目录
const learningStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'learning');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    const baseName = path.basename(file.originalname, ext);
    const safeName = baseName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const timestamp = Date.now();
    cb(null, `${safeName}_${timestamp}${ext}`);
  }
});

const uploadLearningPdf = multer({
  storage: learningStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 最大 50MB
  }
});

// 管理员登录
router.post('/login', adminController.login);

// 仪表盘统计
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/chart', adminController.getChartData);
router.get('/dashboard/recent-exams', adminController.getRecentExams);

// 用户管理
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
// 兼容旧版批量删除（DELETE /users/batch）与新版（POST /users/batch-delete）
router.delete('/users/batch', adminController.batchDeleteUsers);
router.post('/users/batch-delete', adminController.batchDeleteUsers);
router.post('/users/import', upload.single('file'), adminController.batchImportUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/status', adminController.toggleUserStatus);
router.put('/users/:id/reset-password', adminController.resetUserPassword);

// 考试管理
router.get('/exams', adminController.getExams);
router.post('/exams', adminController.createExam);
router.put('/exams/:id', adminController.updateExam);
router.delete('/exams/:id', adminController.deleteExam);
router.put('/exams/:id/status', adminController.toggleExamStatus);
router.get('/exams/:id/assignments', adminController.getExamAssignments);
router.put('/exams/:id/assignments', adminController.updateExamAssignments);
// 考试题目配置
router.get('/exams/:id/questions', adminController.getExamQuestions);
router.post('/exams/:id/questions/config', adminController.configExamQuestions);
router.post('/exams/:id/questions/auto-select', adminController.autoSelectQuestions);

// 题库管理
router.get('/questions', adminController.getQuestions);
router.post('/questions', adminController.createQuestion);
router.put('/questions/:id', adminController.updateQuestion);
router.delete('/questions/:id', adminController.deleteQuestion);
// 题目批量删除（DELETE + POST 兼容）
router.delete('/questions/batch', adminController.batchDeleteQuestions);
router.post('/questions/batch-delete', adminController.batchDeleteQuestions);
router.get('/questions/export', adminController.exportQuestions);
router.post('/questions/import', upload.single('file'), adminController.importQuestions);

// 考试记录
router.get('/records', adminController.getRecords);
router.get('/records/:id', adminController.getRecordDetail);
router.get('/records/export', adminController.exportRecords);
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

// 数据库维护（超级管理员）
router.post('/db/backup-clear', adminController.backupAndClearDatabase);
router.post('/db/restore', upload.single('file'), adminController.restoreDatabase);

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
