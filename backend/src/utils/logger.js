/**
 * 日志模块
 * 
 * 使用 winston 提供统一的日志记录功能
 * - 支持不同日志级别（error, warn, info, debug）
 * - 同时输出到控制台和文件
 * - 自动按日期分割日志文件
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// 日志目录
const LOG_DIR = path.join(__dirname, '../../logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 控制台输出格式（开发环境更友好）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// 创建 logger 实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'lab-safety-api' },
  transports: [
    // 错误日志单独文件
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    })
  ],
  // 异常处理
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'exceptions.log')
    })
  ],
  // 未捕获的 Promise 拒绝
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'rejections.log')
    })
  ]
});

// 开发环境同时输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// 导出便捷方法
module.exports = {
  // 错误日志
  error: (message, ...args) => logger.error(message, ...args),
  
  // 警告日志
  warn: (message, ...args) => logger.warn(message, ...args),
  
  // 信息日志
  info: (message, ...args) => logger.log('info', message, ...args),
  
  // 调试日志
  debug: (message, ...args) => logger.debug(message, ...args),
  
  // HTTP 请求日志
  http: (message, ...args) => logger.info(`[HTTP] ${message}`, ...args),
  
  // 数据库操作日志
  db: (message, ...args) => logger.debug(`[DB] ${message}`, ...args),
  
  // 原始 logger 实例（用于高级用法）
  logger
};

