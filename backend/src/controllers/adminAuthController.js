const { generateToken } = require('../middleware/auth');
const { setSessionCookie, clearSessionCookie } = require('../utils/sessionCookie');
const { safeEqualText } = require('../utils/password');
const { success, error } = require('../utils/response');

const ADMIN_SESSION_SECONDS = 4 * 60 * 60;

const login = (req, res) => {
  const { username, password } = req.body || {};
  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredUsername || !configuredPassword) {
    return error(res, '管理员账号尚未在服务器环境变量中配置', 503);
  }

  const valid = safeEqualText(username || '', configuredUsername)
    && safeEqualText(password || '', configuredPassword);
  if (!valid) return error(res, '用户名或密码错误', 401);

  const userInfo = {
    id: 'admin',
    username: configuredUsername,
    name: process.env.ADMIN_DISPLAY_NAME || '系统管理员',
    role: 'admin'
  };
  const token = generateToken(userInfo, { expiresIn: '4h' });
  setSessionCookie(res, 'admin', token, { maxAgeSeconds: ADMIN_SESSION_SECONDS });

  return success(res, { userInfo }, '登录成功');
};

const logout = (_req, res) => {
  clearSessionCookie(res, 'admin');
  return success(res, null, '登出成功');
};

const session = (req, res) => success(res, {
  userInfo: {
    id: req.user.id,
    username: req.user.username,
    name: req.user.name,
    role: req.user.role
  }
}, '会话有效');

module.exports = {
  login,
  logout,
  session
};
