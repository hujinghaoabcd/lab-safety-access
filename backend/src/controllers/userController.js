const { dbGet, dbRun } = require('../database/db');
const { success, error } = require('../utils/response');
const fs = require('fs');
const path = require('path');

/**
 * 获取用户信息
 */
const getProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      return error(res, '用户不存在', 404);
    }

    const { password, ...userInfo } = user;
    // 转换字段名
    userInfo.studentId = user.student_id;
    userInfo.createdAt = user.created_at;
    userInfo.updatedAt = user.updated_at;
    delete userInfo.student_id;
    delete userInfo.created_at;
    delete userInfo.updated_at;

    success(res, userInfo, '获取成功');
  } catch (err) {
    console.error('获取用户信息错误:', err);
    error(res, '获取用户信息失败', 500);
  }
};

/**
 * 更新用户信息
 */
const updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { phone, email, name, department } = req.body;

  try {
    const updateFields = [];
    const updateValues = [];

    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (department !== undefined) {
      updateFields.push('department = ?');
      updateValues.push(department);
    }

    if (updateFields.length === 0) {
      return error(res, '没有需要更新的字段', 400);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(userId);

    await dbRun(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    const { password, ...userInfo } = user;
    userInfo.studentId = user.student_id;
    userInfo.createdAt = user.created_at;
    userInfo.updatedAt = user.updated_at;
    delete userInfo.student_id;
    delete userInfo.created_at;
    delete userInfo.updated_at;

    success(res, userInfo, '更新成功');
  } catch (err) {
    console.error('更新用户信息错误:', err);
    error(res, '更新用户信息失败', 500);
  }
};

/**
 * 获取用户统计数据
 */
const getProfileStats = async (req, res) => {
  const userId = req.user.id;

  try {
    const examCountResult = await dbGet(
      'SELECT COUNT(*) as count FROM exam_records WHERE user_id = ?',
      [userId]
    );
    const passCountResult = await dbGet(
      "SELECT COUNT(DISTINCT exam_id) as count FROM exam_records WHERE user_id = ? AND status = '通过'",
      [userId]
    );
    const certCountResult = await dbGet(
      'SELECT COUNT(*) as count FROM certificates WHERE user_id = ? AND status = 1',
      [userId]
    );

    const stats = {
      examCount: examCountResult.count || 0,
      passCount: passCountResult.count || 0,
      certCount: certCountResult.count || 0,
    };

    success(res, stats, '获取统计数据成功');
  } catch (err) {
    console.error('获取用户统计数据错误:', err);
    error(res, '获取统计数据失败', 500);
  }
};

/**
 * 修改密码
 */
const changePassword = async (req, res) => {
  const userId = req.user.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return error(res, '请输入旧密码和新密码', 400);
  }

  if (oldPassword === newPassword) {
    return error(res, '新密码不能与旧密码相同', 400);
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      return error(res, '用户不存在', 404);
    }

    if (user.password !== oldPassword) {
      return error(res, '旧密码不正确', 400);
    }

    await dbRun(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPassword, userId]
    );

    success(res, null, '密码修改成功');
  } catch (err) {
    console.error('修改密码错误:', err);
    error(res, '修改密码失败', 500);
  }
};

/**
 * 修改头像（上传图片）
 */
const changeAvatar = async (req, res) => {
  const userId = req.user.id;
  const file = req.file;

  if (!file) {
    return error(res, '请上传头像文件', 400);
  }

  try {
    const uploadRoot = path.join(__dirname, '..', '..', 'uploads', 'avatars');
    await fs.promises.mkdir(uploadRoot, { recursive: true });

    const ext = path.extname(file.originalname || '') || '.jpg';
    const filename = `u${userId}_${Date.now()}${ext}`;
    const filepath = path.join(uploadRoot, filename);

    await fs.promises.writeFile(filepath, file.buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;

    await dbRun(
      'UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [avatarUrl, userId]
    );

    success(res, { avatar: avatarUrl }, '头像更新成功');
  } catch (err) {
    console.error('修改头像错误:', err);
    error(res, '修改头像失败', 500);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getProfileStats,
  changePassword,
  changeAvatar
};

