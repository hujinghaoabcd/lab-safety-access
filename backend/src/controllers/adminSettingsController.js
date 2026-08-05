const { dbGet, withTransaction } = require('../database/db');
const { success, error } = require('../utils/response');

const DEFAULT_SETTINGS = Object.freeze({
  basic: Object.freeze({
    siteName: '实验室安全教育考试系统',
    siteDesc: '中国科学院大学生命科学学院实验室安全教育考试平台',
    adminEmail: 'admin@ucas.ac.cn',
    recordNo: ''
  }),
  cert: Object.freeze({
    issuer: '中国科学院大学生命科学学院',
    validDays: 365,
    autoIssue: true
  }),
  security: Object.freeze({
    loginAttempts: 5,
    lockDuration: 30,
    passwordMinLength: 8,
    passwordComplexity: true,
    sessionTimeout: 120
  }),
  contact: Object.freeze({
    phone: '010-12345678',
    email: 'lab-safety@ucas.edu.cn',
    address: '中国科学院大学玉泉路校区'
  })
});

const text = (value, label, maxLength, { required = false } = {}) => {
  const normalized = String(value ?? '').trim();
  if (required && !normalized) throw new Error(`${label}不能为空`);
  if (normalized.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  return normalized;
};

const integer = (value, label, min, max) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < min || normalized > max) {
    throw new Error(`${label}必须是 ${min}–${max} 的整数`);
  }
  return normalized;
};

const boolean = (value, label) => {
  if (typeof value !== 'boolean') throw new Error(`${label}必须是布尔值`);
  return value;
};

const email = (value, label) => {
  const normalized = text(value, label, 254);
  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error(`${label}格式无效`);
  }
  return normalized;
};

const validators = {
  basic: (data) => ({
    siteName: text(data.siteName, '站点名称', 100, { required: true }),
    siteDesc: text(data.siteDesc, '站点说明', 500),
    adminEmail: email(data.adminEmail, '管理员邮箱'),
    recordNo: text(data.recordNo, '备案号', 100)
  }),
  cert: (data) => ({
    issuer: text(data.issuer, '证书颁发机构', 200, { required: true }),
    validDays: integer(data.validDays, '证书有效天数', 1, 3650),
    autoIssue: boolean(data.autoIssue, '自动发证开关')
  }),
  security: (data) => ({
    loginAttempts: integer(data.loginAttempts, '登录失败次数', 1, 20),
    lockDuration: integer(data.lockDuration, '锁定时长', 1, 1440),
    passwordMinLength: integer(data.passwordMinLength, '密码最小长度', 8, 128),
    passwordComplexity: boolean(data.passwordComplexity, '密码复杂度开关'),
    sessionTimeout: integer(data.sessionTimeout, '会话超时', 5, 1440)
  }),
  contact: (data) => ({
    phone: text(data.phone, '联系电话', 50),
    email: email(data.email, '联系邮箱'),
    address: text(data.address, '联系地址', 300)
  })
};

const loadSettingSection = async (key, getter = dbGet) => {
  const defaults = DEFAULT_SETTINGS[key];
  if (!defaults) throw new Error('无效的设置类型');
  const row = await getter('SELECT value FROM system_settings WHERE key = ?', [key]);
  if (!row || !row.value) return { ...defaults };
  try {
    const stored = JSON.parse(row.value);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { ...defaults };
    return { ...defaults, ...stored };
  } catch (_) {
    return { ...defaults };
  }
};

const getSettings = async (_req, res) => {
  try {
    const result = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      result[key] = await loadSettingSection(key);
    }
    return success(res, result);
  } catch (err) {
    console.error('获取系统设置失败:', err);
    return error(res, '获取系统设置失败', 500);
  }
};

const updateSettings = async (req, res) => {
  const type = String(req.body && req.body.type || '').trim();
  const validator = validators[type];
  if (!validator) return error(res, '无效的设置类型', 400);
  if (!req.body || !req.body.data || typeof req.body.data !== 'object' || Array.isArray(req.body.data)) {
    return error(res, '设置数据无效', 400);
  }

  try {
    const result = await withTransaction(async (tx) => {
      const current = await loadSettingSection(type, (sql, params) => tx.get(sql, params));
      const allowedKeys = new Set(Object.keys(DEFAULT_SETTINGS[type]));
      const unknownKeys = Object.keys(req.body.data).filter((key) => !allowedKeys.has(key));
      if (unknownKeys.length) throw new Error(`不支持的设置字段：${unknownKeys.join(', ')}`);

      const next = validator({ ...current, ...req.body.data });
      await tx.run(
        `INSERT INTO system_settings(key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
        [type, JSON.stringify(next)]
      );
      await tx.run(
        `INSERT INTO operation_audit_logs
          (actor_type, actor_id, action, target_type, target_id, outcome, detail, ip)
         VALUES ('admin', ?, 'settings.update', 'settings', ?, 'success', ?, ?)`,
        [
          String(req.user.id),
          type,
          JSON.stringify({ changedKeys: Object.keys(req.body.data) }),
          String(req.ip || '').slice(0, 100) || null
        ]
      );
      return next;
    });
    return success(res, result, '设置已保存');
  } catch (err) {
    if (/不能为空|不能超过|必须|格式无效|不支持/.test(err.message || '')) {
      return error(res, err.message, 400);
    }
    console.error('更新系统设置失败:', err);
    return error(res, '更新系统设置失败', 500);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  loadSettingSection,
  DEFAULT_SETTINGS,
  validators
};
