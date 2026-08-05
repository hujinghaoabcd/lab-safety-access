const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/db');
const { getJwtSecret } = require('./middleware/auth');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const learningRoutes = require('./routes/learning');
const examRoutes = require('./routes/exam');
const recordsRoutes = require('./routes/records');
const wrongbookRoutes = require('./routes/wrongbook');
const qualificationRoutes = require('./routes/qualification');
const adminRoutes = require('./routes/admin');
const databaseBackupRoutes = require('./routes/databaseBackups');
const bannerRoutes = require('./routes/banner');
const announcementRoutes = require('./routes/announcement');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === 'production';

const validateProductionConfiguration = () => {
  getJwtSecret();

  if (isProduction) {
    const required = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'DEFAULT_USER_PASSWORD'];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) {
      throw new Error(`生产环境缺少必要变量: ${missing.join(', ')}`);
    }
    if (process.env.DEFAULT_USER_PASSWORD.length < 8) {
      throw new Error('DEFAULT_USER_PASSWORD 至少需要 8 位');
    }
  }
};

validateProductionConfiguration();

if (isProduction) {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const allowedOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !isProduction || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const uploadsPath = path.join(__dirname, '..', 'uploads');
const uploadStaticOptions = {
  dotfiles: 'deny',
  fallthrough: true,
  index: false,
  maxAge: isProduction ? '1h' : 0
};
app.use('/uploads', express.static(uploadsPath, uploadStaticOptions));
app.use('/api/uploads', express.static(uploadsPath, uploadStaticOptions));

app.use((req, res, next) => {
  const startTime = Date.now();
  logger.http(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    queryKeys: Object.keys(req.query || {})
  });

  res.on('finish', () => {
    logger.http(`${req.method} ${req.path} ${res.statusCode}`, {
      statusCode: res.statusCode,
      durationMs: Date.now() - startTime,
      ip: req.ip
    });
  });

  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/wrongbook', wrongbookRoutes);
app.use('/api/qualification', qualificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/db-backups', databaseBackupRoutes);
app.use('/api/banner', bannerRoutes);
app.use('/api/announcement', announcementRoutes);

const healthResponse = (_req, res) => {
  res.json({
    code: 0,
    message: 'OK',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
};
app.get('/health', healthResponse);
app.get('/api/health', healthResponse);

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: 'API 接口不存在'
  });
});

app.use((err, req, res, _next) => {
  logger.error('请求处理错误', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  if (err && (err.name === 'MulterError' || /仅支持|文件过大/.test(err.message || ''))) {
    return res.status(400).json({
      code: 400,
      message: err.code === 'LIMIT_FILE_SIZE' ? '上传文件超过大小限制' : err.message
    });
  }

  return res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    error: isProduction ? undefined : err.message
  });
});

initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      logger.info('服务器启动成功', {
        port: PORT,
        env: process.env.NODE_ENV || 'development'
      });
    });
  })
  .catch((err) => {
    logger.error('数据库初始化失败，服务未启动', {
      error: err.message,
      stack: err.stack
    });
    process.exitCode = 1;
  });

module.exports = app;
