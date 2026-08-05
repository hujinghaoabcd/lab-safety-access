const { dbQuery, dbGet, withTransaction } = require('../database/db');
const { success, error } = require('../utils/response');

const pagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '10', 10) || 10));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

const optionalText = (value, label, maxLength) => {
  if (value === undefined) return undefined;
  const text = String(value ?? '').trim();
  if (text.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  return text || null;
};

const getUsers = async (req, res) => {
  try {
    const { page, pageSize, offset } = pagination(req.query);
    const where = ['1=1'];
    const params = [];
    const keyword = String(req.query.keyword || '').trim();
    const department = String(req.query.department || '').trim();
    const className = String(req.query.class || '').trim();
    const status = String(req.query.status ?? '').trim();

    if (keyword) {
      where.push('(name LIKE ? OR student_id LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (department) {
      where.push('department = ?');
      params.push(department);
    }
    if (className) {
      where.push('class = ?');
      params.push(className);
    }
    if (status !== '') {
      if (!['0', '1'].includes(status)) return error(res, '用户状态参数无效', 400);
      where.push('status = ?');
      params.push(Number(status));
    }

    const count = await dbGet(
      `SELECT COUNT(*) AS count FROM users WHERE ${where.join(' AND ')}`,
      params
    );
    const rows = await dbQuery(
      `SELECT id, student_id AS studentId, name, department, class,
              phone, email, status, created_at AS createTime
         FROM users
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return success(res, {
      list: rows,
      total: Number(count.count || 0),
      page,
      pageSize
    });
  } catch (err) {
    console.error('获取用户列表错误:', err);
    return error(res, '获取用户列表失败', 500);
  }
};

const validateOrganization = async (tx, department, className) => {
  if (!department && className) throw new Error('设置班级时必须同时设置院系');
  if (!department) return;

  const departmentRow = await tx.get('SELECT id FROM departments WHERE name = ?', [department]);
  if (!departmentRow) throw new Error('院系不存在');
  if (className) {
    const classRow = await tx.get(
      'SELECT id FROM classes WHERE department_id = ? AND name = ?',
      [departmentRow.id, className]
    );
    if (!classRow) throw new Error('班级不属于所选院系或不存在');
  }
};

const updateUser = async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(userId) || userId <= 0) return error(res, '用户 ID 无效', 400);

  try {
    const result = await withTransaction(async (tx) => {
      const current = await tx.get('SELECT * FROM users WHERE id = ?', [userId]);
      if (!current) {
        const notFound = new Error('用户不存在');
        notFound.status = 404;
        throw notFound;
      }

      const studentId = optionalText(req.body && req.body.studentId, '学号', 100);
      const name = optionalText(req.body && req.body.name, '姓名', 100);
      const department = optionalText(req.body && req.body.department, '院系', 200);
      const className = optionalText(req.body && req.body.class, '班级', 200);
      const phone = optionalText(req.body && req.body.phone, '手机号', 30);
      const email = optionalText(req.body && req.body.email, '邮箱', 254);

      if (studentId === null) throw new Error('学号不能为空');
      if (name === null) throw new Error('姓名不能为空');
      if (phone && !/^[0-9+()\-\s]{5,30}$/.test(phone)) throw new Error('手机号格式无效');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('邮箱格式无效');

      const nextDepartment = department === undefined ? current.department : department;
      const nextClass = className === undefined ? current.class : className;
      if (department !== undefined || className !== undefined) {
        await validateOrganization(tx, nextDepartment, nextClass);
      }

      const fields = [];
      const values = [];
      for (const [column, value] of [
        ['student_id', studentId],
        ['name', name],
        ['department', department],
        ['class', className],
        ['phone', phone],
        ['email', email]
      ]) {
        if (value !== undefined) {
          fields.push(`${column} = ?`);
          values.push(value);
        }
      }
      if (!fields.length) throw new Error('没有需要更新的字段');

      fields.push('updated_at = CURRENT_TIMESTAMP');
      await tx.run(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        [...values, userId]
      );
      await tx.run(
        `INSERT INTO operation_audit_logs
          (actor_type, actor_id, action, target_type, target_id, outcome, ip)
         VALUES ('admin', ?, 'user.update', 'user', ?, 'success', ?)`,
        [String(req.user.id), String(userId), String(req.ip || '').slice(0, 100) || null]
      );

      return tx.get(
        `SELECT id, student_id AS studentId, name, department, class,
                phone, email, status, created_at AS createTime
           FROM users WHERE id = ?`,
        [userId]
      );
    });

    return success(res, result, '更新成功');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    if (/不能为空|不存在|不属于|没有需要|不能超过|格式无效/.test(err.message || '')) {
      return error(res, err.message, 400);
    }
    if (/UNIQUE constraint/.test(err.message || '')) return error(res, '学号已存在', 409);
    console.error('更新用户错误:', err);
    return error(res, '更新用户失败', 500);
  }
};

const toggleUserStatus = async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(userId) || userId <= 0) return error(res, '用户 ID 无效', 400);

  try {
    const result = await withTransaction(async (tx) => {
      const user = await tx.get('SELECT id, status FROM users WHERE id = ?', [userId]);
      if (!user) {
        const notFound = new Error('用户不存在');
        notFound.status = 404;
        throw notFound;
      }
      const status = Number(user.status) === 1 ? 0 : 1;
      await tx.run(
        'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, userId]
      );
      await tx.run(
        `INSERT INTO operation_audit_logs
          (actor_type, actor_id, action, target_type, target_id, outcome, detail, ip)
         VALUES ('admin', ?, 'user.status', 'user', ?, 'success', ?, ?)`,
        [
          String(req.user.id),
          String(userId),
          JSON.stringify({ status }),
          String(req.ip || '').slice(0, 100) || null
        ]
      );
      return { status };
    });
    return success(res, result, result.status === 1 ? '已启用' : '已禁用');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    console.error('切换用户状态错误:', err);
    return error(res, '操作失败', 500);
  }
};

module.exports = {
  getUsers,
  updateUser,
  toggleUserStatus,
  pagination,
  validateOrganization
};
