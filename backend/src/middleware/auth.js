const jwt = require('jsonwebtoken');

const JWT_SECRET = 'lab-safety-access-secret-key-2024';

/**
 * JWT 认证中间件
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 401,
      message: '未提供有效的认证令牌'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      code: 401,
      message: '认证令牌无效或已过期'
    });
  }
};

/**
 * 生成 JWT Token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = {
  authMiddleware,
  generateToken,
  JWT_SECRET
};

