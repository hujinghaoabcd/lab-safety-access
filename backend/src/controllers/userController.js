const { dbGet, dbRun } = require('../database/db');
const { success, error } = require('../utils/response');
const { hashPassword, verifyPassword, validatePassword } = require('../utils/password');
const { loadSettingSection } = require('./adminSettingsController');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROFILE_SELECT = `
  SELECT id, student_id, name, department, class, phone, email, avatar,
         status, created_at, updated_at
    FROM users
   WHERE id = ?`;

const serializeUser = (user) => ({
  id: user.id,
  studentId: user.student_id,
  name: user.name,
  department: user.department,
  class: user.class,
  phone: user.phone,
  email: user.email,
  avatar: user.avatar || null,
  status: user.status,
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

const normalizeOptionalText = (value, maxLength) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text.length > maxLength) throw new Error(`字段长度不能超过 ${maxLength} 个字符`);
  return text || null;
};

const validateEmail = (email) => {
  if (!email) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('邮箱格式无效');
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await dbGet(PROFILE_SELECT, [req.user.id]);
    if (!user) return error(res, '用户不存在', 404);
    return success(res, serializeUser(user), '获取成功');
  } catch (err) {
    console.error('获取用户信息错误:', err);
    return error(res, '获取用户信息失败', 500);
  }
};

const getContactInfo = async (_req, res) => {
  try {
    const [contact, cert] = await Promise.all([
      loadSettingSection('contact'),
      loadSettingSection('cert')
    ]);
    return success(res, {
      contact,
      cert: { issuer: cert.issuer }
    }, '获取成功');
  } catch (err) {
    console.error('获取学生端公共设置错误:', err);
    return error(res, '获取学生端公共设置失败', 500);
  }
};

const identityFieldChanged = (body, user) => {
  const comparisons = [
    ['name', user.name],
    ['department', user.department],
    ['class', user.class],
    ['studentId', user.student_id],
    ['student_id', user.student_id]
  ];
  for (const [field, currentValue] of comparisons) {
    if (body[field] !== undefined
        && String(body[field] ?? '').trim() !== String(currentValue ?? '').trim()) {
      return true;
    }
  }
  if (body.status !== undefined && Number(body.status) !== Number(user.status)) {
    return true;
  }
  return false;
};

/**
 * Students may update contact fields only. For compatibility, the existing
 * mobile/desktop forms may echo unchanged identity fields; those values are
 * ignored. Any actual identity or assignment-scope change is rejected.
 */
const updateProfile = async (req, res) => {
  try {
    const body = req.body || {};
    const currentUser = await dbGet(PROFILE_SELECT, [req.user.id]);
    if (!currentUser) return error(res, '用户不存在', 404);
    if (identityFieldChanged(body, currentUser)) {
      return error(res, '姓名、学号、院系和班级只能由管理员修改', 403);
    }

    const updateFields = [];
    const updateValues = [];

    if (body.phone !== undefined) {
      const phone = normalizeOptionalText(body.phone, 30);
      if (phone && !/^[0-9+()\-\s]{5,30}$/.test(phone)) {
        return error(res, '手机号格式无效', 400);
      }
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (body.email !== undefined) {
      const email = normalizeOptionalText(body.email, 254);
      validateEmail(email);
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    if (!updateFields.length) return error(res, '没有需要更新的字段', 400);

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(req.user.id);
    const result = await dbRun(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    if (!result.changes) return error(res, '用户不存在', 404);

    const user = await dbGet(PROFILE_SELECT, [req.user.id]);
    return success(res, serializeUser(user), '更新成功');
  } catch (err) {
    if (/格式无效|字段长度/.test(err.message || '')) {
      return error(res, err.message, 400);
    }
    console.error('更新用户信息错误:', err);
    return error(res, '更新用户信息失败', 500);
  }
};

const getProfileStats = async (req, res) => {
  try {
    const [examCountResult, passCountResult, certCountResult] = await Promise.all([
      dbGet('SELECT COUNT(*) AS count FROM exam_records WHERE user_id = ?', [req.user.id]),
      dbGet(
        "SELECT COUNT(DISTINCT exam_id) AS count FROM exam_records WHERE user_id = ? AND status = '通过'",
        [req.user.id]
      ),
      dbGet(
        'SELECT COUNT(*) AS count FROM certificates WHERE user_id = ? AND status = 1',
        [req.user.id]
      )
    ]);

    return success(res, {
      examCount: Number(examCountResult.count || 0),
      passCount: Number(passCountResult.count || 0),
      certCount: Number(certCountResult.count || 0)
    }, '获取统计数据成功');
  } catch (err) {
    console.error('获取用户统计数据错误:', err);
    return error(res, '获取统计数据失败', 500);
  }
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return error(res, '请输入旧密码和新密码', 400);
  if (String(oldPassword) === String(newPassword)) {
    return error(res, '新密码不能与旧密码相同', 400);
  }

  try {
    validatePassword(String(newPassword));
    const user = await dbGet('SELECT id, password FROM users WHERE id = ?', [req.user.id]);
    if (!user) return error(res, '用户不存在', 404);
    if (!(await verifyPassword(String(oldPassword), user.password))) {
      return error(res, '旧密码不正确', 400);
    }

    const passwordHash = await hashPassword(String(newPassword));
    await dbRun(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, req.user.id]
    );
    return success(res, null, '密码修改成功');
  } catch (err) {
    if (err.message && err.message.includes('密码长度')) {
      return error(res, err.message, 400);
    }
    console.error('修改密码错误:', err);
    return error(res, '密码修改失败', 500);
  }
};

/**
 * Detect the real image type from file bytes instead of trusting multipart
 * MIME metadata. Android/WeChat/system galleries sometimes label a valid PNG
 * as image/jpeg (or vice versa), which used to trigger a false "format does
 * not match content" rejection.
 */
const detectImageMime = (buffer) => {
  if (!Buffer.isBuffer(buffer)) return null;

  if (buffer.length >= 3
      && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= pngSignature.length
      && buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
    return 'image/png';
  }

  if (buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }

  return null;
};

const matchesImageSignature = (buffer, mimetype) => {
  const normalizedMime = mimetype === 'image/jpg' ? 'image/jpeg' : mimetype;
  return detectImageMime(buffer) === normalizedMime;
};

const removeManagedAvatar = async (avatarUrl, uploadRoot) => {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) return;
  const filename = path.basename(avatarUrl);
  const filePath = path.join(uploadRoot, filename);
  if (path.dirname(filePath) !== uploadRoot) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('删除旧头像失败:', err.message);
  }
};

const changeAvatar = async (req, res) => {
  const file = req.file;
  if (!file) return error(res, '请上传头像文件', 400);

  // File.type / multipart mimetype is advisory only. The real file signature is
  // the source of truth, so supported images are accepted even when a mobile
  // browser labels their MIME type incorrectly.
  const detectedMime = detectImageMime(file.buffer);
  if (!detectedMime) {
    return error(res, '无法识别头像图片内容，请选择 JPG、PNG 或 WebP 图片', 400);
  }
  file.mimetype = detectedMime;

  const uploadRoot = path.join(__dirname, '..', '..', 'uploads', 'avatars');
  const extensionByMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };
  const filename = `u${req.user.id}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${extensionByMime[detectedMime]}`;
  const filepath = path.join(uploadRoot, filename);

  try {
    const currentUser = await dbGet('SELECT avatar FROM users WHERE id = ?', [req.user.id]);
    if (!currentUser) return error(res, '用户不存在', 404);

    await fs.promises.mkdir(uploadRoot, { recursive: true });
    await fs.promises.writeFile(filepath, file.buffer, { flag: 'wx', mode: 0o640 });
    const avatarUrl = `/uploads/avatars/${filename}`;

    try {
      await dbRun(
        'UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [avatarUrl, req.user.id]
      );
    } catch (dbError) {
      await fs.promises.unlink(filepath).catch(() => {});
      throw dbError;
    }

    await removeManagedAvatar(currentUser.avatar, uploadRoot);
    return success(res, { avatar: avatarUrl }, '头像更新成功');
  } catch (err) {
    console.error('修改头像错误:', err);
    return error(res, '修改头像失败', 500);
  }
};

module.exports = {
  getProfile,
  getContactInfo,
  updateProfile,
  getProfileStats,
  changePassword,
  changeAvatar,
  detectImageMime,
  matchesImageSignature,
  identityFieldChanged
};
