const { dbQuery, dbGet, withTransaction } = require('../database/db');
const { success, error } = require('../utils/response');

class OrganizationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const validName = (value, label) => {
  const name = String(value ?? '').trim();
  if (!name) throw new OrganizationError(`${label}不能为空`);
  if (name.length > 200) throw new OrganizationError(`${label}不能超过 200 个字符`);
  return name;
};

const pageParams = (query) => {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '10', 10) || 10));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

const writeAudit = (tx, req, action, targetType, targetId, detail) => tx.run(
  `INSERT INTO operation_audit_logs
    (actor_type, actor_id, action, target_type, target_id, outcome, detail, ip)
   VALUES ('admin', ?, ?, ?, ?, 'success', ?, ?)`,
  [
    String(req.user.id),
    action,
    targetType,
    String(targetId),
    detail ? JSON.stringify(detail) : null,
    String(req.ip || '').slice(0, 100) || null
  ]
);

const getDepartments = async (req, res) => {
  try {
    const { page, pageSize, offset } = pageParams(req.query);
    const keyword = String(req.query.keyword || '').trim();
    const where = keyword ? 'WHERE d.name LIKE ?' : '';
    const params = keyword ? [`%${keyword}%`] : [];
    const count = await dbGet(
      `SELECT COUNT(*) AS count FROM departments d ${where}`,
      params
    );
    const rows = await dbQuery(
      `SELECT d.id, d.name, d.created_at AS createTime,
              COUNT(DISTINCT c.id) AS classCount,
              COUNT(DISTINCT u.id) AS userCount
         FROM departments d
         LEFT JOIN classes c ON c.department_id = d.id
         LEFT JOIN users u ON u.department = d.name
         ${where}
        GROUP BY d.id, d.name, d.created_at
        ORDER BY d.id DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    return success(res, {
      list: rows.map((row) => ({
        ...row,
        classCount: Number(row.classCount || 0),
        userCount: Number(row.userCount || 0)
      })),
      total: Number(count.count || 0),
      page,
      pageSize
    });
  } catch (err) {
    console.error('获取院系列表错误:', err);
    return error(res, '获取院系列表失败', 500);
  }
};

const createDepartment = async (req, res) => {
  try {
    const name = validName(req.body && req.body.name, '院系名称');
    const result = await withTransaction(async (tx) => {
      const inserted = await tx.run('INSERT INTO departments(name) VALUES (?)', [name]);
      await writeAudit(tx, req, 'department.create', 'department', inserted.lastID, { name });
      return tx.get(
        'SELECT id, name, created_at AS createTime FROM departments WHERE id = ?',
        [inserted.lastID]
      );
    });
    return success(res, result, '创建成功');
  } catch (err) {
    if (/UNIQUE constraint/.test(err.message || '')) return error(res, '院系名称已存在', 409);
    if (err instanceof OrganizationError) return error(res, err.message, err.status);
    console.error('创建院系错误:', err);
    return error(res, '创建院系失败', 500);
  }
};

const updateDepartment = async (req, res) => {
  const departmentId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(departmentId) || departmentId <= 0) return error(res, '院系 ID 无效', 400);

  try {
    const name = validName(req.body && req.body.name, '院系名称');
    const result = await withTransaction(async (tx) => {
      const current = await tx.get('SELECT id, name FROM departments WHERE id = ?', [departmentId]);
      if (!current) throw new OrganizationError('院系不存在', 404);
      if (current.name !== name) {
        await tx.run(
          'UPDATE departments SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [name, departmentId]
        );
        await tx.run(
          'UPDATE users SET department = ?, updated_at = CURRENT_TIMESTAMP WHERE department = ?',
          [name, current.name]
        );
        await tx.run(
          'UPDATE exam_assignments SET department = ? WHERE department = ?',
          [name, current.name]
        );
      }
      await writeAudit(tx, req, 'department.update', 'department', departmentId, {
        previousName: current.name,
        name
      });
      return tx.get(
        'SELECT id, name, created_at AS createTime FROM departments WHERE id = ?',
        [departmentId]
      );
    });
    return success(res, result, '更新成功');
  } catch (err) {
    if (/UNIQUE constraint/.test(err.message || '')) return error(res, '院系名称已存在', 409);
    if (err instanceof OrganizationError) return error(res, err.message, err.status);
    console.error('更新院系错误:', err);
    return error(res, '更新院系失败', 500);
  }
};

const deleteDepartment = async (req, res) => {
  const departmentId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(departmentId) || departmentId <= 0) return error(res, '院系 ID 无效', 400);

  try {
    await withTransaction(async (tx) => {
      const department = await tx.get('SELECT id, name FROM departments WHERE id = ?', [departmentId]);
      if (!department) throw new OrganizationError('院系不存在', 404);
      const [classes, users, assignments] = await Promise.all([
        tx.get('SELECT COUNT(*) AS count FROM classes WHERE department_id = ?', [departmentId]),
        tx.get('SELECT COUNT(*) AS count FROM users WHERE department = ?', [department.name]),
        tx.get('SELECT COUNT(*) AS count FROM exam_assignments WHERE department = ?', [department.name])
      ]);
      const usage = {
        classes: Number(classes.count || 0),
        users: Number(users.count || 0),
        assignments: Number(assignments.count || 0)
      };
      if (usage.classes || usage.users || usage.assignments) {
        throw new OrganizationError(
          `院系仍被 ${usage.classes} 个班级、${usage.users} 名用户和 ${usage.assignments} 条考试范围使用`,
          409
        );
      }
      await tx.run('DELETE FROM departments WHERE id = ?', [departmentId]);
      await writeAudit(tx, req, 'department.delete', 'department', departmentId, {
        name: department.name
      });
    });
    return success(res, null, '删除成功');
  } catch (err) {
    if (err instanceof OrganizationError) return error(res, err.message, err.status);
    console.error('删除院系错误:', err);
    return error(res, '删除院系失败', 500);
  }
};

const getClasses = async (req, res) => {
  try {
    const { page, pageSize, offset } = pageParams(req.query);
    const where = ['1=1'];
    const params = [];
    const departmentIdText = String(req.query.departmentId || '').trim();
    const keyword = String(req.query.keyword || '').trim();

    if (departmentIdText) {
      const departmentId = Number.parseInt(departmentIdText, 10);
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return error(res, '院系 ID 参数无效', 400);
      }
      where.push('c.department_id = ?');
      params.push(departmentId);
    }
    if (keyword) {
      where.push('c.name LIKE ?');
      params.push(`%${keyword}%`);
    }

    const count = await dbGet(
      `SELECT COUNT(*) AS count FROM classes c WHERE ${where.join(' AND ')}`,
      params
    );
    const rows = await dbQuery(
      `SELECT c.id, c.department_id AS departmentId,
              d.name AS departmentName, c.name,
              c.created_at AS createTime,
              (SELECT COUNT(*) FROM users u
                WHERE u.department = d.name AND u.class = c.name) AS userCount
         FROM classes c
         JOIN departments d ON d.id = c.department_id
        WHERE ${where.join(' AND ')}
        ORDER BY c.id DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    return success(res, {
      list: rows.map((row) => ({ ...row, userCount: Number(row.userCount || 0) })),
      total: Number(count.count || 0),
      page,
      pageSize
    });
  } catch (err) {
    console.error('获取班级列表错误:', err);
    return error(res, '获取班级列表失败', 500);
  }
};

const createClass = async (req, res) => {
  try {
    const departmentId = Number.parseInt(req.body && req.body.departmentId, 10);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      throw new OrganizationError('请选择所属院系');
    }
    const name = validName(req.body && req.body.name, '班级名称');
    const result = await withTransaction(async (tx) => {
      const department = await tx.get('SELECT id, name FROM departments WHERE id = ?', [departmentId]);
      if (!department) throw new OrganizationError('所属院系不存在', 404);
      const inserted = await tx.run(
        'INSERT INTO classes(department_id, name) VALUES (?, ?)',
        [departmentId, name]
      );
      await writeAudit(tx, req, 'class.create', 'class', inserted.lastID, {
        departmentId,
        departmentName: department.name,
        name
      });
      return tx.get(
        `SELECT c.id, c.department_id AS departmentId, d.name AS departmentName,
                c.name, c.created_at AS createTime
           FROM classes c JOIN departments d ON d.id = c.department_id
          WHERE c.id = ?`,
        [inserted.lastID]
      );
    });
    return success(res, result, '创建成功');
  } catch (err) {
    if (/UNIQUE constraint/.test(err.message || '')) return error(res, '该院系下班级名称已存在', 409);
    if (err instanceof OrganizationError) return error(res, err.message, err.status);
    console.error('创建班级错误:', err);
    return error(res, '创建班级失败', 500);
  }
};

const updateClass = async (req, res) => {
  const classId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(classId) || classId <= 0) return error(res, '班级 ID 无效', 400);

  try {
    const departmentId = Number.parseInt(req.body && req.body.departmentId, 10);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      throw new OrganizationError('请选择所属院系');
    }
    const name = validName(req.body && req.body.name, '班级名称');
    const result = await withTransaction(async (tx) => {
      const current = await tx.get(
        `SELECT c.id, c.department_id AS departmentId, c.name,
                d.name AS departmentName
           FROM classes c JOIN departments d ON d.id = c.department_id
          WHERE c.id = ?`,
        [classId]
      );
      if (!current) throw new OrganizationError('班级不存在', 404);
      const nextDepartment = await tx.get('SELECT id, name FROM departments WHERE id = ?', [departmentId]);
      if (!nextDepartment) throw new OrganizationError('所属院系不存在', 404);

      const users = await tx.get(
        'SELECT COUNT(*) AS count FROM users WHERE department = ? AND class = ?',
        [current.departmentName, current.name]
      );
      const assignments = await tx.get(
        `SELECT COUNT(*) AS count FROM exam_assignments
          WHERE department = ? AND class = ?`,
        [current.departmentName, current.name]
      );
      const inUse = Number(users.count || 0) + Number(assignments.count || 0) > 0;
      if (departmentId !== Number(current.departmentId) && inUse) {
        throw new OrganizationError('班级已被用户或考试范围使用，不能移动到其他院系', 409);
      }

      await tx.run(
        `UPDATE classes
            SET department_id = ?, name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [departmentId, name, classId]
      );
      if (current.name !== name) {
        await tx.run(
          `UPDATE users SET class = ?, updated_at = CURRENT_TIMESTAMP
            WHERE department = ? AND class = ?`,
          [name, current.departmentName, current.name]
        );
        await tx.run(
          `UPDATE exam_assignments SET class = ?
            WHERE department = ? AND class = ?`,
          [name, current.departmentName, current.name]
        );
      }
      await writeAudit(tx, req, 'class.update', 'class', classId, {
        previousDepartmentId: current.departmentId,
        previousName: current.name,
        departmentId,
        name
      });
      return tx.get(
        `SELECT c.id, c.department_id AS departmentId, d.name AS departmentName,
                c.name, c.created_at AS createTime
           FROM classes c JOIN departments d ON d.id = c.department_id
          WHERE c.id = ?`,
        [classId]
      );
    });
    return success(res, result, '更新成功');
  } catch (err) {
    if (/UNIQUE constraint/.test(err.message || '')) return error(res, '该院系下班级名称已存在', 409);
    if (err instanceof OrganizationError) return error(res, err.message, err.status);
    console.error('更新班级错误:', err);
    return error(res, '更新班级失败', 500);
  }
};

const deleteClass = async (req, res) => {
  const classId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(classId) || classId <= 0) return error(res, '班级 ID 无效', 400);

  try {
    await withTransaction(async (tx) => {
      const current = await tx.get(
        `SELECT c.id, c.name, d.name AS departmentName
           FROM classes c JOIN departments d ON d.id = c.department_id
          WHERE c.id = ?`,
        [classId]
      );
      if (!current) throw new OrganizationError('班级不存在', 404);
      const [users, assignments] = await Promise.all([
        tx.get(
          'SELECT COUNT(*) AS count FROM users WHERE department = ? AND class = ?',
          [current.departmentName, current.name]
        ),
        tx.get(
          `SELECT COUNT(*) AS count FROM exam_assignments
            WHERE department = ? AND class = ?`,
          [current.departmentName, current.name]
        )
      ]);
      if (Number(users.count || 0) || Number(assignments.count || 0)) {
        throw new OrganizationError(
          `班级仍被 ${Number(users.count || 0)} 名用户和 ${Number(assignments.count || 0)} 条考试范围使用`,
          409
        );
      }
      await tx.run('DELETE FROM classes WHERE id = ?', [classId]);
      await writeAudit(tx, req, 'class.delete', 'class', classId, {
        departmentName: current.departmentName,
        name: current.name
      });
    });
    return success(res, null, '删除成功');
  } catch (err) {
    if (err instanceof OrganizationError) return error(res, err.message, err.status);
    console.error('删除班级错误:', err);
    return error(res, '删除班级失败', 500);
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  validName
};
