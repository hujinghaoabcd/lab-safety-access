const { dbGet, dbRun } = require('../database/db');
const { generateToken } = require('../middleware/auth');
const { setSessionCookie, clearSessionCookie } = require('../utils/sessionCookie');
const { hashPassword, isHashedPassword, verifyPassword } = require('../utils/password');
const { success, error } = require('../utils/response');

const STUDENT_SESSION_SECONDS = 8 * 60 * 60;

/**
 * 用户登录
 */
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return error(res, '请输入用户名和密码', 400);
  }

  try {
    const user = await dbGet(
      'SELECT * FROM users WHERE student_id = ? AND status = 1',
      [String(username).trim()]
    );

    if (!user || !(await verifyPassword(String(password), user.password))) {
      return error(res, '用户名或密码错误', 401);
    }

    // Existing databases may still contain legacy plaintext passwords. After
    // the first successful login, transparently migrate that row to scrypt.
    if (!isHashedPassword(user.password)) {
      const passwordHash = await hashPassword(String(password));
      await dbRun(
        'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [passwordHash, user.id]
      );
    }

    const token = generateToken({
      id: user.id,
      username: user.student_id,
      name: user.name,
      role: 'student'
    }, { expiresIn: '8h' });
    setSessionCookie(res, 'student', token, {
      maxAgeSeconds: STUDENT_SESSION_SECONDS,
      secure: req.secure
    });

    const userInfo = {
      id: user.id,
      name: user.name,
      studentId: user.student_id,
      department: user.department,
      avatar: user.avatar || null
    };

    // JWT deliberately does not appear in the JSON body. Browser JavaScript
    // cannot read the HttpOnly session cookie even if a page XSS occurs.
    return success(res, { userInfo }, '登录成功');
  } catch (err) {
    console.error('登录错误:', err);
    return error(res, '登录失败，请稍后重试', 500);
  }
};

/**
 * 用户登出
 */
const logout = (req, res) => {
  clearSessionCookie(res, 'student', { secure: req.secure });
  return success(res, null, '登出成功');
};

module.exports = {
  login,
  logout
};
