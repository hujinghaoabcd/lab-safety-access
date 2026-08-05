const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { initDatabase } = require('./database/db');
const logger = require('./utils/logger');

// 导入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const learningRoutes = require('./routes/learning');
const examRoutes = require('./routes/exam');
const recordsRoutes = require('./routes/records');
const wrongbookRoutes = require('./routes/wrongbook');
const qualificationRoutes = require('./routes/qualification');
const adminRoutes = require('./routes/admin');
const bannerRoutes = require('./routes/banner');
const announcementRoutes = require('./routes/announcement');

const app = express();
const PORT = process.env.PORT || 4000;

// 初始化数据库
initDatabase().catch(err => {
  logger.error('数据库初始化失败', { error: err.message, stack: err.stack });
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 文件上传配置（供部分路由复用）
const upload = multer({ storage: multer.memoryStorage() });
app.locals.upload = upload;

// 静态资源：头像等上传文件
const uploadsPath = path.join(__dirname, '..', 'uploads');
// 直接访问（如 http://localhost:4000/uploads/avatars/xxx.png）
app.use('/uploads', express.static(uploadsPath));
// 通过前端代理访问（如 http://localhost:3000/api/uploads/avatars/xxx.png）
app.use('/api/uploads', express.static(uploadsPath));

// 静态资源：数据库备份文件（仅管理端使用）
const backupsPath = path.join(__dirname, '..', 'data', 'backups');
app.use('/api/db-backups', express.static(backupsPath));

// 请求日志中间件
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // 记录请求开始
  logger.http(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    query: req.query
  });
  
  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.http(`${req.method} ${req.path} ${res.statusCode}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  
  next();
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/wrongbook', wrongbookRoutes);
app.use('/api/qualification', qualificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/banner', bannerRoutes);
app.use('/api/announcement', announcementRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    code: 0,
    message: 'OK',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: 'API 接口不存在'
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  logger.error('请求处理错误', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  logger.info('服务器启动成功', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    apiUrl: `http://localhost:${PORT}/api`
  });
});

module.exports = app;

