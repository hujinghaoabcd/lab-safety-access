const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { dbGet, dbRun, withTransaction, DB_PATH } = require('../database/db');
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

const normalizeText = (value, label, maxLength, { required = false } = {}) => {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error(`${label}不能为空`);
  if (text.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  return text || null;
};

const normalizeUserRow = (row) => {
  const studentId = normalizeText(row.studentId ?? row['学号'] ?? row.student_id, '学号', 100, { required: true });
  const name = normalizeText(row.name ?? row['姓名'], '姓名', 100, { required: true });
  const department = normalizeText(row.department ?? row['院系'], '院系', 200);
  const className = normalizeText(row.class ?? row['班级'], '班级', 200);
  const phone = normalizeText(row.phone ?? row['手机号'], '手机号', 30);
  const email = normalizeText(row.email ?? row['邮箱'], '邮箱', 254);
  const suppliedPassword = String(row.password ?? row['密码'] ?? '').trim();

  if (phone && !/^[0-9+()\-\s]{5,30}$/.test(phone)) throw new Error('手机号格式无效');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('邮箱格式无效');
  if (suppliedPassword) validatePassword(suppliedPassword);

  return {
    studentId,
    name,
    department,
    className,
    phone,
    email,
    suppliedPassword
  };
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
  if (!valid) return error(res, '用户名或密码错误', 401);

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
    const normalized = normalizeUserRow({
      ...req.body,
      password: req.body && req.body.password
    });
    if (!normalized.suppliedPassword) {
      return error(res, '初始密码为必填项', 400);
    }

    const passwordHash = await hashPassword(normalized.suppliedPassword);
    const result = await dbRun(
      `INSERT INTO users (student_id, name, password, department, class, phone, email, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        normalized.studentId,
        normalized.name,
        passwordHash,
        normalized.department,
        normalized.className,
        normalized.phone,
        normalized.email
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
    if (/不能为空|不能超过|格式无效|密码长度/.test(err.message || '')) {
      return error(res, err.message, 400);
    }
    if (/UNIQUE constraint/.test(err.message || '')) {
      return error(res, '学号已存在', 409);
    }
    console.error('创建用户错误:', err);
    return error(res, '创建用户失败', 500);
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const requestedPassword = req.body && req.body.password;
    const newPassword = requestedPassword || getDefaultUserPassword();
    if (!newPassword) {
      return error(res, '生产环境必须配置 DEFAULT_USER_PASSWORD，或在请求中提供新密码', 500);
    }

    validatePassword(String(newPassword));
    const passwordHash = await hashPassword(String(newPassword));
    const result = await dbRun(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, req.params.id]
    );
    if (!result.changes) return error(res, '用户不存在', 404);

    return success(res, {
      temporaryPassword: requestedPassword ? undefined : newPassword,
      mustChangePassword: true
    }, '密码已安全重置');
  } catch (err) {
    if (/密码长度/.test(err.message || '')) return error(res, err.message, 400);
    console.error('重置密码错误:', err);
    return error(res, '重置密码失败', 500);
  }
};

exports.batchImportUsers = async (req, res) => {
  if (!req.file) return error(res, '请上传 Excel 文件', 400);

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    if (!data.length) return error(res, 'Excel 文件为空', 400);
    if (data.length > 5000) return error(res, '单次最多导入 5000 名用户', 400);

    const defaultPassword = getDefaultUserPassword();
    const results = { success: 0, updated: 0, failed: 0, errors: [] };

    await withTransaction(async (tx) => {
      for (let i = 0; i < data.length; i += 1) {
        try {
          const normalized = normalizeUserRow(data[i]);
          const existing = await tx.get(
            'SELECT id FROM users WHERE student_id = ?',
            [normalized.studentId]
          );

          if (existing) {
            if (normalized.suppliedPassword) {
              const passwordHash = await hashPassword(normalized.suppliedPassword);
              await tx.run(
                `UPDATE users SET name = ?, password = ?, department = ?, class = ?,
                 phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ?`,
                [
                  normalized.name,
                  passwordHash,
                  normalized.department,
                  normalized.className,
                  normalized.phone,
                  normalized.email,
                  normalized.studentId
                ]
              );
            } else {
              await tx.run(
                `UPDATE users SET name = ?, department = ?, class = ?, phone = ?,
                 email = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ?`,
                [
                  normalized.name,
                  normalized.department,
                  normalized.className,
                  normalized.phone,
                  normalized.email,
                  normalized.studentId
                ]
              );
            }
            results.updated += 1;
          } else {
            const initialPassword = normalized.suppliedPassword || defaultPassword;
            if (!initialPassword) {
              throw new Error('未提供密码，且服务器未配置 DEFAULT_USER_PASSWORD');
            }
            validatePassword(initialPassword);
            const passwordHash = await hashPassword(initialPassword);
            await tx.run(
              `INSERT INTO users (student_id, name, password, department, class, phone, email, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                normalized.studentId,
                normalized.name,
                passwordHash,
                normalized.department,
                normalized.className,
                normalized.phone,
                normalized.email
              ]
            );
            results.success += 1;
          }
        } catch (rowError) {
          results.failed += 1;
          results.errors.push(`第 ${i + 2} 行：${rowError.message}`);
        }
      }
    });

    return success(
      res,
      results,
      `导入完成：新增 ${results.success} 条，更新 ${results.updated} 条，失败 ${results.failed} 条`
    );
  } catch (err) {
    console.error('批量导入用户错误:', err);
    return error(res, '批量导入失败', 500);
  }
};

exports.downloadDatabaseBackup = async (req, res) => {
  const filename = path.basename(String(req.params.filename || ''));
  if (!/^lab_safety_(?:backup|before_restore)_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.db$/.test(filename)) {
    return error(res, '备份文件名无效', 400);
  }

  const backupDirectory = path.join(path.dirname(DB_PATH), 'backups');
  const filePath = path.join(backupDirectory, filename);

  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return error(res, '备份文件不存在', 404);
    res.setHeader('Cache-Control', 'no-store');
    return res.download(filePath, filename);
  } catch (err) {
    if (err.code === 'ENOENT') return error(res, '备份文件不存在', 404);
    console.error('下载数据库备份失败:', err);
    return error(res, '下载数据库备份失败', 500);
  }
};

exports.normalizeUserRow = normalizeUserRow;
