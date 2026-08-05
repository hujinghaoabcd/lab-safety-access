const { dbGet } = require('../database/db');
const { generateToken } = require('../middleware/auth');
const { success, error } = require('../utils/response');

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
      'SELECT * FROM users WHERE student_id = ? AND password = ? AND status = 1',
      [username, password]
    );

    if (!user) {
      return error(res, '用户名或密码错误', 401);
    }

    const token = generateToken({
      id: user.id,
      username: user.student_id,
      name: user.name
    });

    const userInfo = {
      id: user.id,
      name: user.name,
      studentId: user.student_id,
      department: user.department,
      avatar: null
    };

    success(res, { token, userInfo }, '登录成功');
  } catch (err) {
    console.error('登录错误:', err);
    error(res, '登录失败，请稍后重试', 500);
  }
};

/**
 * 用户登出
 */
const logout = (req, res) => {
  success(res, null, '登出成功');
};

module.exports = {
  login,
  logout
};

