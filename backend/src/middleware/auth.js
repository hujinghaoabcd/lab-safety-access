const jwt = require('jsonwebtoken');
const { getCookieSessionToken } = require('../utils/sessionCookie');

const DEVELOPMENT_SECRET = 'development-only-change-me';
const NON_TOKENS = new Set(['null', 'undefined', 'cookie-session']);

const getJwtSecret = () => {
  const configuredSecret = process.env.JWT_SECRET;

  if (configuredSecret && configuredSecret.length >= 32) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须配置至少 32 位的 JWT_SECRET');
  }

  return DEVELOPMENT_SECRET;
};

const getRequestToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice('Bearer '.length).trim();
    if (bearerToken && !NON_TOKENS.has(bearerToken.toLowerCase())) return bearerToken;
  }
  return getCookieSessionToken(req);
};

/**
 * JWT 认证中间件。
 *
 * 浏览器优先使用 HttpOnly Cookie；Bearer Token 继续保留给脚本、测试和
 * 兼容客户端，因此迁移不会破坏现有 API 调用方式。
 */
const authMiddleware = (req, res, next) => {
  const token = getRequestToken(req);

  if (!token) {
    return res.status(401).json({
      code: 401,
      message: '未提供有效的认证令牌'
    });
  }

  try {
    req.user = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: 'lab-safety-access'
    });
    next();
  } catch (error) {
    return res.status(401).json({
      code: 401,
      message: '认证令牌无效或已过期'
    });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      code: 403,
      message: '没有权限执行此操作'
    });
  }
  next();
};

/**
 * 生成 JWT Token
 */
const generateToken = (payload, options = {}) => jwt.sign(
  payload,
  getJwtSecret(),
  {
    algorithm: 'HS256',
    issuer: 'lab-safety-access',
    expiresIn: options.expiresIn || '8h'
  }
);

module.exports = {
  authMiddleware,
  requireRole,
  generateToken,
  getJwtSecret,
  getRequestToken
};
