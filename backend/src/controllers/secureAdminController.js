const XLSX = require('xlsx');
const { dbGet, dbRun } = require('../database/db');
const { generateToken } = require('../middleware/auth');
const {
  hashPassword,
  safeEqualText,
  validatePassword
} = require('../utils/password');
const { success, error } = require('../utils/response');

const getDefaultUserPassword = () => {
  const configured = process.env.DEFAULT_USER_PASSWORD;
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return 'ChangeMe123!';
  return null;
};

exports.login = (req, res) => {
  const { username, password } = req.body || {};
  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredUsername || !configuredPassword) {
    return error(res, '管理员账号尚未在服务器环境变量中配置', 503);
  }

  const valid = safeEqualText(username || '', configuredUsername)
    && safeEqualText(password || '', configuredPassword);

  if (!valid) {
    return error(res, '用户名或密码错误', 401);
  }

  const token = generateToken({
    id: 'admin',
    username: configuredUsername,
    name: process.env.ADMIN_DISPLAY_NAME || '系统管理员',
    role: 'admin'
  }, { expiresIn: '4h' });

  return success(res, {
    token,
    userInfo: {
      id: 'admin',
      username: configuredUsername,
      name: process.env.ADMIN_DISPLAY_NAME || '系统管理员',
      role: 'admin'
    }
  }, '登录成功');
};

exports.createUser = async (req, res) => {
  try {
    const {
      studentId,
      name,
      password,
      department,
      class: className,
      phone,
      email
    } = req.body || {};

    if (!studentId || !name || !password) {
      return error(res, '学号、姓名和初始密码为必填项', 400);
    }

    validatePassword(String(password));
    const passwordHash = await hashPassword(String(password));
    const result = await dbRun(
      `INSERT INTO users (student_id, name, password, department, class, phone, email, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        String(studentId).trim(),
        String(name).trim(),
        passwordHash,
        department || null,
        className || null,
        phone || null,
        email || null
      ]
    );

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [result.lastID]);
    return success(res, {
      id: user.id,
      studentId: user.student_id,
      name: user.name,
      department: user.department,
      class: user.class,
      phone: user.phone,
      email: user.email,
      status: user.status,
      createTime: user.created_at
    }, '创建成功');
  } catch (err) {
    if (err.message && err.message.includes('密码长度')) {
      return error(res, err.message, 400);
    }
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return error(res, '学号已存在', 400);
    }
    console.error('创建用户错误:', err);
    return error(res, '创建用户失败', 500);
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedPassword = req.body && req.body.password;
    const newPassword = requestedPassword || getDefaultUserPassword();

    if (!newPassword) {
      return error(res, '生产环境必须配置 DEFAULT_USER_PASSWORD，或在请求中提供新密码', 500);
    }

    validatePassword(String(newPassword));
    const passwordHash = await hashPassword(String(newPassword));
    const result = await dbRun(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, id]
    );

    if (!result.changes) {
      return error(res, '用户不存在', 404);
    }

    return success(res, {
      temporaryPassword: requestedPassword ? undefined : newPassword,
      mustChangePassword: true
    }, '密码已安全重置');
  } catch (err) {
    if (err.message && err.message.includes('密码长度')) {
      return error(res, err.message, 400);
    }
    console.error('重置密码错误:', err);
    return error(res, '重置密码失败', 500);
  }
};

exports.batchImportUsers = async (req, res) => {
  if (!req.file) {
    return error(res, '请上传 Excel 文件', 400);
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!data.length) {
      return error(res, 'Excel 文件为空', 400);
    }
    if (data.length > 5000) {
      return error(res, '单次最多导入 5000 名用户', 400);
    }

    const defaultPassword = getDefaultUserPassword();
    const results = { success: 0, updated: 0, failed: 0, errors: [] };

    await dbRun('BEGIN IMMEDIATE TRANSACTION');
    try {
      for (let i = 0; i < data.length; i += 1) {
        const row = data[i];
        const studentId = String(row['学号'] || row.student_id || '').trim();
        const name = String(row['姓名'] || row.name || '').trim();
        const department = String(row['院系'] || row.department || '').trim() || null;
        const className = String(row['班级'] || row.class || '').trim() || null;
        const phone = String(row['手机号'] || row.phone || '').trim() || null;
        const email = String(row['邮箱'] || row.email || '').trim() || null;
        const suppliedPassword = String(row['密码'] || row.password || '').trim();

        if (!studentId || !name) {
          results.failed += 1;
          results.errors.push(`第 ${i + 2} 行：学号和姓名为必填项`);
          continue;
        }

        try {
          const existing = await dbGet(
            'SELECT id FROM users WHERE student_id = ?',
            [studentId]
          );

          if (existing) {
            if (suppliedPassword) {
              validatePassword(suppliedPassword);
              const passwordHash = await hashPassword(suppliedPassword);
              await dbRun(
                `UPDATE users SET name = ?, password = ?, department = ?, class = ?,
                 phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ?`,
                [name, passwordHash, department, className, phone, email, studentId]
              );
            } else {
              await dbRun(
                `UPDATE users SET name = ?, department = ?, class = ?, phone = ?,
                 email = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ?`,
                [name, department, className, phone, email, studentId]
              );
            }
            results.updated += 1;
          } else {
            const initialPassword = suppliedPassword || defaultPassword;
            if (!initialPassword) {
              throw new Error('未提供密码，且服务器未配置 DEFAULT_USER_PASSWORD');
            }
            validatePassword(initialPassword);
            const passwordHash = await hashPassword(initialPassword);
            await dbRun(
              `INSERT INTO users (student_id, name, password, department, class, phone, email, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
              [studentId, name, passwordHash, department, className, phone, email]
            );
            results.success += 1;
          }
        } catch (rowError) {
          results.failed += 1;
          results.errors.push(`第 ${i + 2} 行：${rowError.message}`);
        }
      }
      await dbRun('COMMIT');
    } catch (transactionError) {
      await dbRun('ROLLBACK');
      throw transactionError;
    }

    return success(
      res,
      results,
      `导入完成：新增 ${results.success} 条，更新 ${results.updated} 条，失败 ${results.failed} 条`
    );
  } catch (err) {
    try { await dbRun('ROLLBACK'); } catch (_) {}
    console.error('批量导入用户错误:', err);
    return error(res, '批量导入失败', 500);
  }
};
