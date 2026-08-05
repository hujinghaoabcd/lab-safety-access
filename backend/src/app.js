const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  initDatabase,
  checkDatabase,
  closeDatabase
} = require('./database/db');
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

const isProduction = () => process.env.NODE_ENV === 'production';

const validateProductionConfiguration = () => {
  getJwtSecret();

  if (!isProduction()) return;

  const required = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'DEFAULT_USER_PASSWORD'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`生产环境缺少必要变量: ${missing.join(', ')}`);
  }
  if (process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error('ADMIN_PASSWORD 至少需要 12 位');
  }
  if (process.env.DEFAULT_USER_PASSWORD.length < 8) {
    throw new Error('DEFAULT_USER_PASSWORD 至少需要 8 位');
  }
};

const createApp = () => {
  const app = express();

  if (isProduction()) {
    app.set('trust proxy', 1);
  }
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  });

  const allowedOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || !isProduction() || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS_ORIGIN_DENIED'));
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '2mb' }));

  const uploadsPath = path.join(__dirname, '..', 'uploads');
  const uploadStaticOptions = {
    dotfiles: 'deny',
    fallthrough: true,
    index: false,
    maxAge: isProduction() ? '1h' : 0,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
    }
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
  // Compatibility alias for early phase-2 clients; both routes require admin JWT.
  app.use('/api/database-backups', databaseBackupRoutes);
  app.use('/api/banner', bannerRoutes);
  app.use('/api/announcement', announcementRoutes);

  const healthResponse = async (_req, res) => {
    try {
      const databaseHealthy = await checkDatabase();
      if (!databaseHealthy) throw new Error('database check failed');
      return res.json({
        code: 0,
        message: 'OK',
        data: {
          status: 'healthy',
          database: 'ready',
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      logger.error('健康检查失败', { error: err.message });
      return res.status(503).json({
        code: 503,
        message: 'Service Unavailable',
        data: { status: 'unhealthy', database: 'unavailable' }
      });
    }
  };
  app.get('/health', healthResponse);
  app.get('/api/health', healthResponse);

  app.use((req, res) => {
    res.status(404).json({ code: 404, message: 'API 接口不存在', data: null });
  });

  app.use((err, req, res, _next) => {
    if (err && err.message === 'CORS_ORIGIN_DENIED') {
      return res.status(403).json({ code: 403, message: '请求来源不被允许', data: null });
    }
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ code: 400, message: '请求 JSON 格式无效', data: null });
    }
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ code: 413, message: '请求内容超过大小限制', data: null });
    }

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
        message: err.code === 'LIMIT_FILE_SIZE' ? '上传文件超过大小限制' : err.message,
        data: null
      });
    }

    return res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      error: isProduction() ? undefined : err.message
    });
  });

  return app;
};

const startServer = async ({ port = Number(process.env.PORT || 4000) } = {}) => {
  validateProductionConfiguration();
  await initDatabase();
  const app = createApp();

  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, '0.0.0.0', () => resolve(listener));
    listener.once('error', reject);
  });

  const address = server.address();
  logger.info('服务器启动成功', {
    port: typeof address === 'object' && address ? address.port : port,
    env: process.env.NODE_ENV || 'development'
  });

  return { app, server };
};

if (require.main === module) {
  startServer().then(({ server }) => {
    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info('收到关闭信号', { signal });

      const forceTimer = setTimeout(() => process.exit(1), 10_000);
      forceTimer.unref();

      server.close(async () => {
        try {
          await closeDatabase();
          clearTimeout(forceTimer);
          process.exit(0);
        } catch (err) {
          logger.error('关闭数据库失败', { error: err.message });
          process.exit(1);
        }
      });
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  }).catch((err) => {
    logger.error('服务启动失败', { error: err.message, stack: err.stack });
    process.exitCode = 1;
  });
}

module.exports = {
  createApp,
  startServer,
  validateProductionConfiguration
};
