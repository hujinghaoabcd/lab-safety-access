const { success, error } = require('../utils/response');
const { db, dbQuery, dbRun, dbGet, DB_PATH } = require('../database/db');
const fs = require('fs');
const path = require('path');

// ============ 登录 ============
exports.login = (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'ucas1234') {
    return success(res, {
      token: 'admin_token_' + Date.now(),
      userInfo: {
        id: 1,
        username: 'admin',
        name: '系统管理员',
        role: 'admin'
      }
    }, '登录成功');
  }
  
  return error(res, '用户名或密码错误', 401);
};

// ============ 仪表盘 ============
exports.getDashboardStats = async (req, res) => {
  try {
    const userCount = await dbGet('SELECT COUNT(*) as count FROM users WHERE status = 1');
    const examCount = await dbGet('SELECT COUNT(*) as count FROM exams WHERE status = 1');
    const questionCount = await dbGet('SELECT COUNT(*) as count FROM questions');
    const today = new Date().toISOString().split('T')[0];
    const todayExamCount = await dbGet(
      "SELECT COUNT(*) as count FROM exam_records WHERE DATE(submit_time) = ?",
      [today]
    );
    const passRecords = await dbGet(
      "SELECT COUNT(*) as count FROM exam_records WHERE status = '通过'"
    );
    const totalRecords = await dbGet('SELECT COUNT(*) as count FROM exam_records');
    const passRate = totalRecords.count > 0 
      ? ((passRecords.count / totalRecords.count) * 100).toFixed(1) + '%'
      : '0%';

    success(res, {
      userCount: userCount.count,
      examCount: examCount.count,
      questionCount: questionCount.count,
      todayExamCount: todayExamCount.count,
      passRate: passRate
    });
  } catch (err) {
    console.error('获取统计数据错误:', err);
    error(res, '获取统计数据失败', 500);
  }
};

exports.getChartData = async (req, res) => {
  try {
    // 近7天考试趋势
    const dates = [];
    const values = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const formatted = `${date.getMonth() + 1}-${date.getDate()}`;
      dates.push(formatted);
      
      const count = await dbGet(
        "SELECT COUNT(*) as count FROM exam_records WHERE DATE(submit_time) = ?",
        [dateStr]
      );
      values.push(count.count);
    }

    // 题目分类分布（通用安全/化学安全/生物安全/辐射安全/电气安全）
    const distribution = await dbQuery(`
      WITH cats(name) AS (
        SELECT '通用安全' UNION ALL SELECT '化学安全' UNION ALL SELECT '生物安全' UNION ALL SELECT '辐射安全' UNION ALL SELECT '电气安全' UNION ALL SELECT '消防安全'
      ), cnt AS (
        SELECT category AS name, COUNT(*) AS value FROM questions GROUP BY category
      )
      SELECT c.name, COALESCE(t.value, 0) AS value
      FROM cats c
      LEFT JOIN cnt t ON t.name = c.name
      ORDER BY c.name
    `);

    success(res, {
      trend: {
        dates: dates,
        values: values
      },
      distribution: distribution.map(d => ({
        name: d.name,
        value: d.value
      }))
    });
  } catch (err) {
    console.error('获取图表数据错误:', err);
    error(res, '获取图表数据失败', 500);
  }
};

exports.getRecentExams = async (req, res) => {
  try {
    const records = await dbQuery(`
      SELECT 
        er.id,
        u.student_id as studentId,
        u.name as studentName,
        e.name as examName,
        er.score,
        er.status,
        er.duration,
        er.submit_time as submitTime
      FROM exam_records er
      JOIN users u ON er.user_id = u.id
      JOIN exams e ON er.exam_id = e.id
      ORDER BY er.submit_time DESC
      LIMIT 5
    `);

    success(res, records);
  } catch (err) {
    console.error('获取最近考试记录错误:', err);
    error(res, '获取最近考试记录失败', 500);
  }
};

// ============ 用户管理 ============
exports.getUsers = async (req, res) => {
  try {
    const { keyword, department, class: className, status, page = 1, pageSize = 10 } = req.query;
    
    let sql = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (keyword) {
      sql += ' AND (name LIKE ? OR student_id LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (department) {
      sql += ' AND department = ?';
      params.push(department);
    }
    if (className) {
      sql += ' AND class = ?';
      params.push(className);
    }
    if (status !== undefined && status !== '') {
      sql += ' AND status = ?';
      params.push(parseInt(status));
    }

    // 先获取总数
    let countSql = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
    const countParams = [];
    if (keyword) {
      countSql += ' AND (name LIKE ? OR student_id LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (department) {
      countSql += ' AND department = ?';
      countParams.push(department);
    }
    if (className) {
      countSql += ' AND class = ?';
      countParams.push(className);
    }
    if (status !== undefined && status !== '') {
      countSql += ' AND status = ?';
      countParams.push(parseInt(status));
    }
    const total = await dbGet(countSql, countParams);
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (page - 1) * pageSize);

    const list = await dbQuery(sql, params);
    
    success(res, {
      list: list.map(u => ({
        id: u.id,
        studentId: u.student_id,
        name: u.name,
        department: u.department,
        class: u.class,
        phone: u.phone,
        email: u.email,
        status: u.status,
        createTime: u.created_at
      })),
      total: total.count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    console.error('获取用户列表错误:', err);
    error(res, '获取用户列表失败', 500);
  }
};

exports.createUser = async (req, res) => {
  try {
    const { studentId, name, password, department, class: className, phone, email } = req.body;
    
    const result = await dbRun(
      `INSERT INTO users (student_id, name, password, department, class, phone, email, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [studentId, name, password, department, className, phone, email]
    );

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [result.lastID]);
    success(res, {
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
    if (err.message.includes('UNIQUE constraint')) {
      error(res, '学号已存在', 400);
    } else {
      console.error('创建用户错误:', err);
      error(res, '创建用户失败', 500);
    }
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, name, department, class: className, phone, email } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (studentId) {
      updateFields.push('student_id = ?');
      updateValues.push(studentId);
    }
    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (department) {
      updateFields.push('department = ?');
      updateValues.push(department);
    }
    if (className) {
      updateFields.push('class = ?');
      updateValues.push(className);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await dbRun(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [id]);
    success(res, {
      id: user.id,
      studentId: user.student_id,
      name: user.name,
      department: user.department,
      class: user.class,
      phone: user.phone,
      email: user.email,
      status: user.status,
      createTime: user.created_at
    }, '更新成功');
  } catch (err) {
    console.error('更新用户错误:', err);
    error(res, '更新用户失败', 500);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('删除用户请求:', id);
    
    // 检查用户是否存在
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return error(res, '用户不存在', 404);
    }
    
    // 先删除关联数据（按依赖顺序，忽略不存在的错误）
    try {
      await dbRun('DELETE FROM wrong_questions WHERE user_id = ?', [id]);
    } catch (err) {
      console.log('删除错题本数据:', err.message);
    }
    
    try {
      await dbRun('DELETE FROM learning_progress WHERE user_id = ?', [id]);
    } catch (err) {
      console.log('删除学习进度数据:', err.message);
    }
    
    try {
      await dbRun('DELETE FROM certificates WHERE user_id = ?', [id]);
    } catch (err) {
      console.log('删除证书数据:', err.message);
    }
    
    try {
      await dbRun('DELETE FROM exam_records WHERE user_id = ?', [id]);
    } catch (err) {
      console.log('删除考试记录数据:', err.message);
    }
    
    // 最后删除用户
    await dbRun('DELETE FROM users WHERE id = ?', [id]);
    
    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除用户错误:', err);
    error(res, '删除用户失败: ' + (err.message || '未知错误'), 500);
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return error(res, '用户不存在', 404);
    }

    const newStatus = user.status === 1 ? 0 : 1;
    await dbRun('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
    
    success(res, { status: newStatus }, newStatus === 1 ? '已启用' : '已禁用');
  } catch (err) {
    console.error('切换用户状态错误:', err);
    error(res, '操作失败', 500);
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const newPassword = '123456';
    await dbRun('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newPassword, id]);
    success(res, { newPassword }, '密码已重置为 123456');
  } catch (err) {
    console.error('重置密码错误:', err);
    error(res, '重置密码失败', 500);
  }
};

// 批量删除用户
exports.batchDeleteUsers = async (req, res) => {
  try {
    console.log('批量删除请求:', req.body);
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return error(res, '请选择要删除的用户', 400);
    }

    // 先删除关联数据（按依赖顺序，忽略不存在的错误）
    const placeholders = ids.map(() => '?').join(',');
    
    try {
      await dbRun(`DELETE FROM wrong_questions WHERE user_id IN (${placeholders})`, ids);
    } catch (err) {
      console.log('批量删除错题本数据:', err.message);
    }
    
    try {
      await dbRun(`DELETE FROM learning_progress WHERE user_id IN (${placeholders})`, ids);
    } catch (err) {
      console.log('批量删除学习进度数据:', err.message);
    }
    
    try {
      await dbRun(`DELETE FROM certificates WHERE user_id IN (${placeholders})`, ids);
    } catch (err) {
      console.log('批量删除证书数据:', err.message);
    }
    
    try {
      await dbRun(`DELETE FROM exam_records WHERE user_id IN (${placeholders})`, ids);
    } catch (err) {
      console.log('批量删除考试记录数据:', err.message);
    }
    
    // 最后删除用户
    await dbRun(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
    
    success(res, { deletedCount: ids.length }, `成功删除 ${ids.length} 个用户`);
  } catch (err) {
    console.error('批量删除用户错误:', err);
    error(res, '批量删除失败: ' + (err.message || '未知错误'), 500);
  }
};


// 批量导入用户
exports.batchImportUsers = async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请上传Excel文件', 400);
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return error(res, 'Excel文件为空', 400);
    }

    const results = {
      success: 0,
      failed: 0,
      updated: 0,
      errors: [],
      updatedRows: [] // 记录被覆盖的行
    };

    await dbRun('BEGIN TRANSACTION');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const studentId = String(row['学号'] || row['student_id'] || row['学号'] || '').trim();
      const name = String(row['姓名'] || row['name'] || '').trim();
      const department = String(row['院系'] || row['department'] || '').trim();
      const className = String(row['班级'] || row['class'] || '').trim();
      const phone = String(row['手机号'] || row['phone'] || '').trim();
      const email = String(row['邮箱'] || row['email'] || '').trim();
      const password = String(row['密码'] || row['password'] || '123456').trim();

      if (!studentId || !name) {
        results.failed++;
        results.errors.push(`第 ${i + 2} 行: 学号和姓名为必填项`);
        continue;
      }

      try {
        // 先检查学号是否已存在
        const existingUser = await dbGet('SELECT id FROM users WHERE student_id = ?', [studentId]);
        
        if (existingUser) {
          // 如果存在，执行更新（覆盖）
          console.log(`[批量导入] 学号 ${studentId} 已存在，执行覆盖更新`);
          const updateResult = await dbRun(
            `UPDATE users SET 
             name = ?, 
             password = ?, 
             department = ?, 
             class = ?, 
             phone = ?, 
             email = ?,
             updated_at = CURRENT_TIMESTAMP
             WHERE student_id = ?`,
            [name, password, department || null, className || null, phone || null, email || null, studentId]
          );
          results.updated++;
          results.updatedRows.push(`第 ${i + 2} 行: 学号 ${studentId} 已存在，已覆盖更新`);
        } else {
          // 如果不存在，执行插入
          console.log(`[批量导入] 学号 ${studentId} 不存在，执行新增`);
          await dbRun(
            `INSERT INTO users (student_id, name, password, department, class, phone, email, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [studentId, name, password, department || null, className || null, phone || null, email || null]
          );
          results.success++;
        }
      } catch (err) {
        console.error(`[批量导入] 第 ${i + 2} 行处理失败:`, err.message);
        results.failed++;
        results.errors.push(`第 ${i + 2} 行: ${err.message}`);
      }
    }

    await dbRun('COMMIT');

    console.log('批量导入结果:', {
      success: results.success,
      updated: results.updated,
      failed: results.failed,
      updatedRowsCount: results.updatedRows.length,
      errorsCount: results.errors.length
    });

    const message = `导入完成: 新增 ${results.success} 条, 覆盖 ${results.updated} 条, 失败 ${results.failed} 条`;
    success(res, results, message);
  } catch (err) {
    await dbRun('ROLLBACK');
    console.error('批量导入用户错误:', err);
    error(res, '批量导入失败: ' + err.message, 500);
  }
};

// ============ 考试管理 ============
exports.getExams = async (req, res) => {
  try {
    const { keyword, status, page = 1, pageSize = 10 } = req.query;
    
    const whereParts = ['1=1'];
    const whereParams = [];

    if (keyword) {
      whereParts.push('name LIKE ?');
      whereParams.push(`%${keyword}%`);
    }
    if (status !== undefined && status !== '') {
      whereParts.push('status = ?');
      whereParams.push(parseInt(status, 10));
    }

    const whereSql = 'WHERE ' + whereParts.join(' AND ');

    // 总数
    const countRow = await dbGet(
      `SELECT COUNT(*) as count FROM exams ${whereSql}`,
      whereParams
    );
    const total = countRow ? countRow.count || 0 : 0;

    // 分页数据
    const limit = parseInt(pageSize, 10);
    const offset = (parseInt(page, 10) - 1) * limit;
    const list = await dbQuery(
      `SELECT * FROM exams ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );
    
    success(res, {
      list: (list || []).map(e => ({
        id: e.id,
        name: e.name,
        duration: e.duration,
        totalScore: e.total_score,
        passScore: e.pass_score,
        questionCount: e.question_count,
        status: e.status,
        createTime: e.created_at
      })),
      total,
      page: parseInt(page, 10),
      pageSize: limit
    });
  } catch (err) {
    console.error('获取考试列表错误:', err);
    error(res, '获取考试列表失败', 500);
  }
};

exports.createExam = async (req, res) => {
  try {
    const { name, description, duration, totalScore, passScore, questionCount } = req.body;
    
    const result = await dbRun(
      `INSERT INTO exams (name, description, duration, total_score, pass_score, question_count, status)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [name, description, duration, totalScore, passScore, questionCount]
    );

    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [result.lastID]);
    success(res, {
      id: exam.id,
      name: exam.name,
      duration: exam.duration,
      totalScore: exam.total_score,
      passScore: exam.pass_score,
      questionCount: exam.question_count,
      status: exam.status,
      createTime: exam.created_at
    }, '创建成功');
  } catch (err) {
    console.error('创建考试错误:', err);
    error(res, '创建考试失败', 500);
  }
};

exports.updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, duration, totalScore, passScore, questionCount } = req.body;

    await dbRun(
      `UPDATE exams SET 
        name = ?, description = ?, duration = ?,
        total_score = ?, pass_score = ?, question_count = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, description, duration, totalScore, passScore, questionCount, id]
    );

    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [id]);
    success(res, {
      id: exam.id,
      name: exam.name,
      duration: exam.duration,
      totalScore: exam.total_score,
      passScore: exam.pass_score,
      questionCount: exam.question_count,
      status: exam.status,
      createTime: exam.created_at
    }, '更新成功');
  } catch (err) {
    console.error('更新考试错误:', err);
    error(res, '更新考试失败', 500);
  }
};

exports.deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('BEGIN TRANSACTION');

    // 先删除与考试相关的题目及错题关联，避免外键约束失败
    const examQuestions = await dbQuery('SELECT id FROM questions WHERE exam_id = ?', [id]);
    const qIds = (examQuestions || []).map(q => q.id);
    if (qIds.length > 0) {
      const placeholders = qIds.map(() => '?').join(',');
      await dbRun(`DELETE FROM wrong_questions WHERE question_id IN (${placeholders})`, qIds);
      await dbRun('DELETE FROM questions WHERE exam_id = ?', [id]);
    }

    // 删除发布范围、考试记录、证书等关联数据
    await dbRun('DELETE FROM exam_assignments WHERE exam_id = ?', [id]);
    await dbRun('DELETE FROM exam_records WHERE exam_id = ?', [id]);
    await dbRun('DELETE FROM certificates WHERE exam_id = ?', [id]);

    // 最后删除考试
    await dbRun('DELETE FROM exams WHERE id = ?', [id]);

    await dbRun('COMMIT');
    success(res, null, '删除成功');
  } catch (err) {
    try { await dbRun('ROLLBACK'); } catch (e) {}
    console.error('删除考试错误:', err);
    error(res, '删除考试失败', 500);
  }
};

exports.getExamAssignments = async (req, res) => {
  try {
    const { id } = req.params;
    const assignments = await dbQuery('SELECT * FROM exam_assignments WHERE exam_id = ?', [id]);
    success(res, assignments);
  } catch (err) {
    console.error('获取考试发布范围错误:', err);
    error(res, '获取考试发布范围失败', 500);
  }
};

exports.updateExamAssignments = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignments } = req.body;

    // 确认考试存在，避免外键约束错误
    const exam = await dbGet('SELECT id FROM exams WHERE id = ?', [id]);
    if (!exam) {
      return error(res, '考试不存在', 404);
    }

    // 暂时关闭外键检查，避免历史数据导致的约束错误
    try {
      await dbRun('PRAGMA foreign_keys = OFF');
    } catch (e) {
      console.warn('关闭外键检查失败（可忽略继续）:', e);
    }

    // 使用事务确保原子性
    await dbRun('BEGIN TRANSACTION');
    await dbRun('DELETE FROM exam_assignments WHERE exam_id = ?', [id]);

    if (assignments && assignments.length > 0) {
      for (const assign of assignments) {
        await dbRun(
          'INSERT INTO exam_assignments (exam_id, department, class) VALUES (?, ?, ?)',
          [id, assign.department || null, assign.class || null]
        );
      }
    }

    await dbRun('COMMIT');

    // 重新开启外键检查
    try {
      await dbRun('PRAGMA foreign_keys = ON');
    } catch (e) {
      console.warn('重新开启外键检查失败（可忽略）:', e);
    }

    success(res, null, '发布范围更新成功');
  } catch (err) {
    try { await dbRun('ROLLBACK'); } catch (e) {}
    try { await dbRun('PRAGMA foreign_keys = ON'); } catch (e) {}
    console.error('更新考试发布范围错误:', err);
    error(res, '更新考试发布范围失败', 500);
  }
};

exports.toggleExamStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [id]);
    if (!exam) {
      return error(res, '考试不存在', 404);
    }

    const newStatus = exam.status === 1 ? 0 : 1;
    await dbRun('UPDATE exams SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
    
    success(res, { status: newStatus }, newStatus === 1 ? '已发布' : '已下架');
  } catch (err) {
    console.error('切换考试状态错误:', err);
    error(res, '操作失败', 500);
  }
};

// ============ 考试题目配置 ============
exports.getExamQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await dbQuery(
      'SELECT * FROM questions WHERE exam_id = ? ORDER BY created_at DESC',
      [id]
    );
    success(res, (rows || []).map(q => ({
      id: q.id,
      content: q.content,
      type: q.type,
      category: q.category,
      options: JSON.parse(q.options || '[]'),
      answer: q.answer,
      analysis: q.analysis,
      createTime: q.created_at
    })));
  } catch (err) {
    console.error('获取考试题目错误:', err);
    error(res, '获取考试题目失败', 500);
  }
};

exports.configExamQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    const { addIds = [], removeIds = [] } = req.body || {};

    const safeAddIds = Array.isArray(addIds) ? addIds.map(n => parseInt(n)).filter(n => Number.isFinite(n)) : [];
    const safeRemoveIds = Array.isArray(removeIds) ? removeIds.map(n => parseInt(n)).filter(n => Number.isFinite(n)) : [];

    // 暂时关闭外键检查，避免历史数据或并发导致的约束错误
    // 这里只涉及将题目绑定到已存在的考试，不会破坏数据一致性
    try {
      await dbRun('PRAGMA foreign_keys = OFF');
    } catch (e) {
      console.warn('关闭外键检查失败（可忽略继续）:', e);
    }

    await dbRun('BEGIN TRANSACTION');

    if (safeAddIds.length > 0) {
      const placeholders = safeAddIds.map(() => '?').join(',');
      // 只允许绑定未分配或已属于该考试的题目，避免“抢题”
      await dbRun(
        `UPDATE questions
         SET exam_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${placeholders})
           AND (exam_id IS NULL OR exam_id = 0 OR exam_id = ?)`,
        [id, ...safeAddIds, id]
      );
    }

    if (safeRemoveIds.length > 0) {
      const placeholders = safeRemoveIds.map(() => '?').join(',');
      await dbRun(
        `UPDATE questions
         SET exam_id = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE exam_id = ? AND id IN (${placeholders})`,
        [id, ...safeRemoveIds]
      );
    }

    // 同步题目数
    const cnt = await dbGet('SELECT COUNT(*) as count FROM questions WHERE exam_id = ?', [id]);
    await dbRun('UPDATE exams SET question_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [cnt.count || 0, id]);

    await dbRun('COMMIT');

    // 重新开启外键检查
    try {
      await dbRun('PRAGMA foreign_keys = ON');
    } catch (e) {
      console.warn('重新开启外键检查失败（可忽略）:', e);
    }
    success(res, { questionCount: cnt.count || 0 }, '题目配置已保存');
  } catch (err) {
    try { await dbRun('ROLLBACK'); } catch (e) {}
    try { await dbRun('PRAGMA foreign_keys = ON'); } catch (e) {}
    console.error('配置考试题目错误:', err);
    error(res, '题目配置失败', 500);
  }
};

// 自动抽题：根据考试设置的题目数量，按题型和分类比例自动抽取
exports.autoSelectQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取考试信息
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [id]);
    if (!exam) {
      return error(res, '考试不存在', 404);
    }

    const targetCount = exam.question_count || 50;
    
    // 题型分配比例：单选题50%、多选题30%、判断题20%
    const typeRatio = {
      '单选题': 0.5,
      '多选题': 0.3,
      '判断题': 0.2
    };

    // 计算各题型需要的数量
    const typeCounts = {};
    let remaining = targetCount;
    const types = Object.keys(typeRatio);
    for (let i = 0; i < types.length - 1; i++) {
      const count = Math.floor(targetCount * typeRatio[types[i]]);
      typeCounts[types[i]] = count;
      remaining -= count;
    }
    typeCounts[types[types.length - 1]] = remaining; // 最后一个题型补齐剩余数量

    // 先执行所有查询操作（不需要禁用外键）
    const selectedIds = [];

    console.log(`[自动抽题] 开始抽题，目标数量: ${targetCount}, 题型分配:`, typeCounts);

    // 按题型抽取题目
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count <= 0) continue;

      // 获取该题型的所有未分配题目（SQLite 使用随机排序）
      const candidates = await dbQuery(
        `SELECT id, category FROM questions 
         WHERE type = ? AND (exam_id IS NULL OR exam_id = 0)
         ORDER BY RANDOM()
         LIMIT ?`,
        [type, count * 2] // 多取一些，以便按分类分配
      );

      console.log(`[自动抽题] 题型 ${type} 需要 ${count} 道，查询到 ${candidates.length} 道候选题目`);

      if (candidates.length === 0) {
        console.warn(`[自动抽题] 题型 ${type} 没有足够的未分配题目，需要 ${count} 道，实际找到 0 道`);
        continue;
      }

      // 按分类分组
      const byCategory = {};
      for (const q of candidates) {
        const cat = q.category || '未分类';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(q.id);
      }

      // 尽量均匀分配各分类的题目
      const categories = Object.keys(byCategory);
      const perCategory = Math.ceil(count / categories.length);
      let selected = 0;

      for (const cat of categories) {
        if (selected >= count) break;
        const take = Math.min(perCategory, count - selected, byCategory[cat].length);
        selectedIds.push(...byCategory[cat].slice(0, take));
        selected += take;
      }

      // 如果还不够，继续从剩余题目中随机抽取
      if (selected < count) {
        const remainingCandidates = candidates
          .filter(q => !selectedIds.includes(q.id))
          .slice(0, count - selected)
          .map(q => q.id);
        selectedIds.push(...remainingCandidates);
      }
    }

    // 如果抽取的题目数量不足，从所有未分配题目中随机补齐
    if (selectedIds.length < targetCount) {
      const additional = await dbQuery(
        `SELECT id FROM questions 
         WHERE (exam_id IS NULL OR exam_id = 0) AND id NOT IN (${selectedIds.length > 0 ? selectedIds.map(() => '?').join(',') : '0'})
         ORDER BY RANDOM()
         LIMIT ?`,
        selectedIds.length > 0 ? [...selectedIds, targetCount - selectedIds.length] : [targetCount - selectedIds.length]
      );
      selectedIds.push(...additional.map(q => q.id));
    }

    // 只取目标数量
    const finalIds = selectedIds.slice(0, targetCount);

    console.log(`[自动抽题] 最终选中的题目数量: ${finalIds.length}, 题目ID:`, finalIds.slice(0, 10), finalIds.length > 10 ? '...' : '');

    // 使用 db.serialize() 确保 PRAGMA 在事务前执行，然后执行所有更新操作
    return new Promise((outerResolve, outerReject) => {
      db.serialize(() => {
        // 禁用外键检查
        db.run('PRAGMA foreign_keys = OFF', (err) => {
          if (err) {
            console.error('禁用外键检查失败:', err);
            return outerReject(err);
          }
          
          // 开始事务
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
              console.error('开始事务失败:', err);
              return outerReject(err);
            }
            
            // 先清空该考试的所有题目
            db.run('UPDATE questions SET exam_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE exam_id = ?', [id], (err) => {
              if (err) {
                db.run('ROLLBACK', () => {});
                db.run('PRAGMA foreign_keys = ON', () => {});
                return outerReject(err);
              }
              
              // 绑定题目到考试
              if (finalIds.length > 0) {
                const placeholders = finalIds.map(() => '?').join(',');
                db.run(
                  `UPDATE questions
                   SET exam_id = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id IN (${placeholders})`,
                  [id, ...finalIds],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK', () => {});
                      db.run('PRAGMA foreign_keys = ON', () => {});
                      return outerReject(err);
                    }
                    
                    // 同步题目数
                    db.run('UPDATE exams SET question_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [finalIds.length, id], (err) => {
                      if (err) {
                        db.run('ROLLBACK', () => {});
                        db.run('PRAGMA foreign_keys = ON', () => {});
                        return outerReject(err);
                      }
                      
                      // 提交事务
                      db.run('COMMIT', (err) => {
                        if (err) {
                          db.run('PRAGMA foreign_keys = ON', () => {});
                          return outerReject(err);
                        }
                        
                        // 重新启用外键检查
                        db.run('PRAGMA foreign_keys = ON', (err) => {
                          if (err) {
                            console.error('重新启用外键检查失败:', err);
                          }
                          
                          // 返回抽题结果统计
                          (async () => {
                            try {
                              const stats = {};
                              for (const type of types) {
                                const count = await dbGet(
                                  'SELECT COUNT(*) as count FROM questions WHERE exam_id = ? AND type = ?',
                                  [id, type]
                                );
                                stats[type] = count ? count.count : 0;
                              }

                              success(res, {
                                questionCount: finalIds.length,
                                targetCount: targetCount,
                                stats: stats
                              }, `自动抽题完成，已抽取 ${finalIds.length} 道题目`);
                              outerResolve();
                            } catch (err) {
                              outerReject(err);
                            }
                          })();
                        });
                      });
                    });
                  }
                );
              } else {
                // 没有题目需要绑定，直接提交
                db.run('UPDATE exams SET question_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id], (err) => {
                  if (err) {
                    db.run('ROLLBACK', () => {});
                    db.run('PRAGMA foreign_keys = ON', () => {});
                    return outerReject(err);
                  }
                  
                  db.run('COMMIT', (err) => {
                    if (err) {
                      db.run('PRAGMA foreign_keys = ON', () => {});
                      return outerReject(err);
                    }
                    
                    db.run('PRAGMA foreign_keys = ON', (err) => {
                      if (err) {
                        console.error('重新启用外键检查失败:', err);
                      }
                      
                      success(res, {
                        questionCount: 0,
                        targetCount: targetCount,
                        stats: {}
                      }, '自动抽题完成，但未找到可用题目');
                      outerResolve();
                    });
                  });
                });
              }
            });
          });
        });
      });
    });
  } catch (err) {
    console.error('自动抽题错误:', err);
    error(res, '自动抽题失败: ' + (err.message || '未知错误'), 500);
  }
};

// ============ 题库管理 ============
exports.getQuestions = async (req, res) => {
  try {
    const { keyword, category, type, page = 1, pageSize = 10, unassigned } = req.query;
    
    // 构建查询条件
    let whereSql = 'WHERE 1=1';
    const params = [];

    if (keyword) {
      whereSql += ' AND content LIKE ?';
      params.push(`%${keyword}%`);
    }
    if (category) {
      whereSql += ' AND category = ?';
      params.push(category);
    }
    if (type) {
      whereSql += ' AND type = ?';
      params.push(type);
    }
    if (unassigned === '1' || unassigned === 1) {
      whereSql += ' AND (exam_id IS NULL OR exam_id = 0)';
    }

    // 获取总数
    const countResult = await dbGet(`SELECT COUNT(*) as total FROM questions ${whereSql}`, params);
    const total = countResult ? (countResult.total || 0) : 0;

    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);
    const sql = `SELECT * FROM questions ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const questions = await dbQuery(sql, [...params, limit, offset]);
    
    success(res, {
      list: (questions || []).map(q => ({
        id: q.id,
        content: q.content,
        type: q.type,
        category: q.category,
        options: JSON.parse(q.options || '[]'),
        answer: q.answer,
        analysis: q.analysis,
        createTime: q.created_at
      })),
      total: total
    });
  } catch (err) {
    console.error('获取题目列表错误:', err);
    error(res, '获取题目列表失败', 500);
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const { content, type, category, options, answer, analysis, examId } = req.body;
    
    const result = await dbRun(
      `INSERT INTO questions (content, type, category, options, answer, analysis, exam_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [content, type, category, JSON.stringify(options), answer, analysis, examId]
    );

    const question = await dbGet('SELECT * FROM questions WHERE id = ?', [result.lastID]);
    success(res, {
      id: question.id,
      content: question.content,
      type: question.type,
      category: question.category,
      options: JSON.parse(question.options),
      answer: question.answer,
      analysis: question.analysis,
      createTime: question.created_at
    }, '创建成功');
  } catch (err) {
    console.error('创建题目错误:', err);
    error(res, '创建题目失败', 500);
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type, category, options, answer, analysis, examId } = req.body;

    await dbRun(
      `UPDATE questions SET 
        content = ?, type = ?, category = ?, options = ?, answer = ?, analysis = ?, exam_id = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [content, type, category, JSON.stringify(options), answer, analysis, examId, id]
    );

    const question = await dbGet('SELECT * FROM questions WHERE id = ?', [id]);
    success(res, {
      id: question.id,
      content: question.content,
      type: question.type,
      category: question.category,
      options: JSON.parse(question.options),
      answer: question.answer,
      analysis: question.analysis,
      createTime: question.created_at
    }, '更新成功');
  } catch (err) {
    console.error('更新题目错误:', err);
    error(res, '更新题目失败', 500);
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('BEGIN TRANSACTION');
    // 先删除依赖表数据，避免外键约束错误
    await dbRun('DELETE FROM wrong_questions WHERE question_id = ?', [id]);
    await dbRun('DELETE FROM questions WHERE id = ?', [id]);
    await dbRun('COMMIT');
    success(res, null, '删除成功');
  } catch (err) {
    await dbRun('ROLLBACK');
    console.error('删除题目错误:', err);
    error(res, '删除题目失败', 500);
  }
};

// 题目批量删除
exports.batchDeleteQuestions = async (req, res) => {
  try {
    let ids = [];
    if (Array.isArray(req.body?.ids)) {
      ids = req.body.ids;
    } else if (typeof req.query?.ids === 'string') {
      ids = req.query.ids.split(',');
    }
    ids = ids.map(id => parseInt(id, 10)).filter(n => !isNaN(n));

    if (!ids.length) {
      return error(res, '请提供要删除的题目ID列表', 400);
    }

    await dbRun('BEGIN TRANSACTION');
    const placeholders = ids.map(() => '?').join(',');
    await dbRun(`DELETE FROM wrong_questions WHERE question_id IN (${placeholders})`, ids);
    const delRes = await dbRun(`DELETE FROM questions WHERE id IN (${placeholders})`, ids);
    await dbRun('COMMIT');

    success(res, { deleted: delRes.changes || 0 }, `已删除 ${delRes.changes || 0} 条题目`);
  } catch (err) {
    await dbRun('ROLLBACK');
    console.error('批量删除题目错误:', err);
    error(res, '批量删除失败', 500);
  }
};

// 题目批量导出（Excel Base64）
exports.exportQuestions = async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const { ids, keyword, category, type } = req.query;

    // 组装查询
    let whereSql = 'WHERE 1=1';
    const params = [];
    if (ids) {
      const idArr = String(ids).split(',').map(v => parseInt(v, 10)).filter(n => !isNaN(n));
      if (idArr.length) {
        whereSql += ` AND id IN (${idArr.map(() => '?').join(',')})`;
        params.push(...idArr);
      }
    }
    if (keyword) { whereSql += ' AND content LIKE ?'; params.push(`%${keyword}%`); }
    if (category) { whereSql += ' AND category = ?'; params.push(category); }
    if (type) { whereSql += ' AND type = ?'; params.push(type); }

    const rows = await dbQuery(`SELECT * FROM questions ${whereSql} ORDER BY created_at DESC`, params);

    // 生成导出数据
    const data = (rows || []).map((q, idx) => {
      let opts = [];
      try { opts = JSON.parse(q.options || '[]'); } catch { opts = []; }
      // 统一成 A.|B.|C.|D. 形式
      const joined = opts.length
        ? opts.map((o, i) => `${String.fromCharCode(65 + i)}.${String(o).replace(/^\s*[A-Z][\.|．、\s]\s*/,'').trim()}`).join('|')
        : '';
      return {
        序号: idx + 1,
        题目内容: q.content,
        题目类型: q.type,
        题目分类: q.category,
        选项: joined,
        正确答案: q.answer,
        答案解析: q.analysis || ''
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '题目');
    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

    const fileName = `题库导出_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`;
    success(res, { fileName, base64 }, '导出成功');
  } catch (err) {
    console.error('导出题目错误:', err);
    error(res, '导出失败', 500);
  }
};

exports.importQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请上传Excel文件', 400);
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log('[批量导入] Excel解析结果，共', data.length, '行');
    if (data.length > 0) {
      console.log('[批量导入] 第一行数据示例:', JSON.stringify(data[0], null, 2));
    }

    if (data.length === 0) {
      return error(res, 'Excel文件为空', 400);
    }

    // 模板校验：防止上传了“用户导入模板”等错误模板
    const firstKeys = Object.keys(data[0] || {});
    const hasQuestionFields = (
      firstKeys.some(k => ['题目内容', 'content', 'Content'].includes(k)) &&
      firstKeys.some(k => ['题目类型', 'type', 'Type'].includes(k)) &&
      firstKeys.some(k => ['题目分类', 'category', 'Category'].includes(k)) &&
      firstKeys.some(k => ['正确答案', 'answer', 'Answer'].includes(k))
    );
    const looksLikeUserTemplate = firstKeys.some(k => ['姓名','学号','院系','班级','phone','手机号','email','邮箱','password','密码'].includes(k));
    if (!hasQuestionFields && looksLikeUserTemplate) {
      return error(res, '检测到这是“用户导入”的模板，请使用【题目导入模板】：题目内容、题目类型（单选题/多选题/判断题）、题目分类、选项（A.选项1|B.选项2... 或 分列A/B/C/D）、正确答案、答案解析（可选）。', 400);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    await dbRun('BEGIN TRANSACTION');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      console.log(`[批量导入] 处理第 ${i + 2} 行，原始数据:`, Object.keys(row));
      
      const content = String(row['题目内容'] || row['content'] || row['Content'] || '').trim();
      const type = String(row['题目类型'] || row['type'] || row['Type'] || '').trim();
      const category = String(row['题目分类'] || row['category'] || row['Category'] || '').trim();
      const optionsStr = String(row['选项'] || row['options'] || row['Options'] || '').trim();
      const answer = String(row['正确答案'] || row['answer'] || row['Answer'] || '').trim();
      const analysis = String(row['答案解析'] || row['analysis'] || row['Analysis'] || '').trim();

      // 验证必填字段
      if (!content || !type || !category || !answer) {
        const missingFields = [];
        if (!content) missingFields.push('题目内容');
        if (!type) missingFields.push('题目类型');
        if (!category) missingFields.push('题目分类');
        if (!answer) missingFields.push('正确答案');
        results.failed++;
        results.errors.push(`第 ${i + 2} 行: 缺少必填项 [${missingFields.join(', ')}]`);
        console.log(`[批量导入] 第 ${i + 2} 行验证失败:`, { content, type, category, answer });
        continue;
      }

      // 验证题目类型
      const validTypes = ['单选题', '多选题', '判断题'];
      if (!validTypes.includes(type)) {
        results.failed++;
        results.errors.push(`第 ${i + 2} 行: 题目类型必须是"单选题"、"多选题"或"判断题"`);
        continue;
      }

      // 处理选项
      let options = [];
      if (type === '判断题') {
        options = ['正确', '错误'];
      } else {
        if (optionsStr) {
          // 支持多种格式：A.选项1|B.选项2 或 A,选项1|B,选项2 或 JSON格式
          if (optionsStr.startsWith('[') || optionsStr.startsWith('{')) {
            try {
              options = JSON.parse(optionsStr);
            } catch (e) {
              // 如果不是JSON，尝试按分隔符解析
              const optionPairs = optionsStr.split('|').map(s => s.trim()).filter(s => s);
              options = optionPairs.map(opt => {
                // 移除开头的字母和点号（如 "A. " 或 "A,"）
                return opt.replace(/^[A-Z][\.\s,，]\s*/, '').trim();
              });
            }
          } else {
            // 按 | 分隔，然后移除字母前缀
            const optionPairs = optionsStr.split('|').map(s => s.trim()).filter(s => s);
            options = optionPairs.map(opt => {
              return opt.replace(/^[A-Z][\.\s,，]\s*/, '').trim();
            });
          }
        } else {
          // 如果没有提供选项，尝试从列中读取 A、B、C、D 等
          const optionA = String(row['选项A'] || row['A'] || '').trim();
          const optionB = String(row['选项B'] || row['B'] || '').trim();
          const optionC = String(row['选项C'] || row['C'] || '').trim();
          const optionD = String(row['选项D'] || row['D'] || '').trim();
          
          if (optionA) options.push(optionA);
          if (optionB) options.push(optionB);
          if (optionC) options.push(optionC);
          if (optionD) options.push(optionD);
        }

        // 单选题和多选题至少需要2个选项
        if (options.length < 2) {
          results.failed++;
          results.errors.push(`第 ${i + 2} 行: ${type}至少需要2个选项`);
          continue;
        }
      }

      try {
        // 插入题目
        const optionsJson = JSON.stringify(options);
        console.log(`[批量导入] 第 ${i + 2} 行准备插入:`, { content: content.substring(0, 20) + '...', type, category, optionsCount: options.length, answer });
        await dbRun(
          `INSERT INTO questions (content, type, category, options, answer, analysis, exam_id)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`,
          [content, type, category, optionsJson, answer, analysis || null]
        );
        results.success++;
        console.log(`[批量导入] 第 ${i + 2} 行插入成功`);
      } catch (err) {
        console.error(`[批量导入] 第 ${i + 2} 行处理失败:`, err.message, err);
        results.failed++;
        results.errors.push(`第 ${i + 2} 行: ${err.message}`);
      }
    }

    await dbRun('COMMIT');

    // 验证数据是否真的插入到数据库
    const verifyCount = await dbGet('SELECT COUNT(*) as count FROM questions', []);
    console.log('[批量导入] 事务提交后，数据库中的题目总数:', verifyCount?.count || 0);

    console.log('[批量导入] 批量导入题目结果:', {
      success: results.success,
      failed: results.failed,
      errorsCount: results.errors.length,
      totalInDb: verifyCount?.count || 0
    });

    const message = `导入完成: 成功 ${results.success} 条, 失败 ${results.failed} 条`;
    success(res, results, message);
  } catch (err) {
    await dbRun('ROLLBACK');
    console.error('批量导入题目错误:', err);
    error(res, '批量导入失败: ' + err.message, 500);
  }
};

// ============ 考试记录 ============
exports.getRecords = async (req, res) => {
  try {
    const { keyword, page = 1, pageSize = 10 } = req.query;
    const p = parseInt(page, 10) || 1;
    const ps = parseInt(pageSize, 10) || 10;
    
    let baseSql = `
      FROM exam_records er
      JOIN users u ON er.user_id = u.id
      JOIN exams e ON er.exam_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (keyword) {
      baseSql += ' AND (u.name LIKE ? OR u.student_id LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 先查总数
    const countRow = await dbGet(
      `SELECT COUNT(*) as count ${baseSql}`,
      params
    );
    const total = countRow ? countRow.count || 0 : 0;

    // 再查当前页数据
    const offset = (p - 1) * ps;
    const list = await dbQuery(
      `
      SELECT 
        er.id,
        u.student_id as studentId,
        u.name as studentName,
        e.name as examName,
        er.score,
        er.status,
        er.duration,
        er.submit_time as submitTime
      ${baseSql}
      ORDER BY er.submit_time DESC
      LIMIT ? OFFSET ?
      `,
      [...params, ps, offset]
    );
    
    success(res, {
      list,
      total,
      page: p,
      pageSize: ps
    });
  } catch (err) {
    console.error('获取考试记录错误:', err);
    error(res, '获取考试记录失败', 500);
  }
};

exports.getRecordDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await dbGet(`
      SELECT 
        er.*,
        u.name as studentName,
        u.student_id as studentId,
        e.name as examName
      FROM exam_records er
      JOIN users u ON er.user_id = u.id
      JOIN exams e ON er.exam_id = e.id
      WHERE er.id = ?
    `, [id]);

    if (!record) {
      return error(res, '记录不存在', 404);
    }

    const questions = await dbQuery(`
      SELECT q.*, 
        CASE WHEN wq.id IS NOT NULL THEN 1 ELSE 0 END as isWrong
      FROM questions q
      LEFT JOIN wrong_questions wq ON q.id = wq.question_id AND wq.exam_record_id = ?
      WHERE q.exam_id = ?
    `, [id, record.exam_id]);

    success(res, {
      ...record,
      questions: questions.map(q => ({
        ...q,
        options: JSON.parse(q.options)
      }))
    });
  } catch (err) {
    console.error('获取考试详情错误:', err);
    error(res, '获取考试详情失败', 500);
  }
};

exports.exportRecords = (req, res) => {
  success(res, { url: '/exports/records.xlsx' }, '导出成功');
};

// 删除单条考试记录
exports.deleteRecord = async (req, res) => {
  try {
    const { id } = req.params;
    // 使用事务，先删错题再删记录，避免外键约束问题
    await dbRun('BEGIN TRANSACTION');
    await dbRun('DELETE FROM wrong_questions WHERE exam_record_id = ?', [id]);
    await dbRun('DELETE FROM exam_records WHERE id = ?', [id]);
    await dbRun('COMMIT');
    success(res, null, '删除考试记录成功');
  } catch (err) {
    try { await dbRun('ROLLBACK'); } catch (_) {}
    console.error('删除考试记录错误:', err);
    error(res, '删除考试记录失败', 500);
  }
};

// ============ 证书管理 ============
exports.getCertificates = async (req, res) => {
  try {
    const { keyword, examName, grade, status, page = 1, pageSize = 10 } = req.query;
    
    let whereSql = ' WHERE 1=1';
    const params = [];

    if (keyword) {
      whereSql += ' AND (u.name LIKE ? OR u.student_id LIKE ? OR c.certificate_no LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (examName) {
      whereSql += ' AND c.exam_name LIKE ?';
      params.push(`%${examName}%`);
    }
    if (grade) {
      whereSql += ' AND c.grade = ?';
      params.push(grade);
    }
    if (status !== undefined && status !== '') {
      whereSql += ' AND c.status = ?';
      params.push(parseInt(status, 10));
    }

    // 总数
    const countSql = `
      SELECT COUNT(*) as count
      FROM certificates c
      JOIN users u ON c.user_id = u.id
      ${whereSql}
    `;
    const countRow = await dbGet(countSql, params);
    const total = countRow ? countRow.count || 0 : 0;

    // 分页查询
    const limit = parseInt(pageSize, 10);
    const offset = (parseInt(page, 10) - 1) * limit;
    const listSql = `
      SELECT 
        c.id,
        c.certificate_no as certificateNo,
        c.user_id as userId,
        c.exam_id as examId,
        c.exam_name as examName,
        c.score,
        c.grade,
        c.issue_date as issueDate,
        c.status,
        c.created_at as createdAt,
        u.name as studentName,
        u.student_id as studentId,
        u.department,
        u.class
      FROM certificates c
      JOIN users u ON c.user_id = u.id
      ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const certificates = await dbQuery(listSql, [...params, limit, offset]);
    
    success(res, {
      list: certificates || [],
      total,
      page: parseInt(page, 10),
      pageSize: limit
    });
  } catch (err) {
    console.error('获取证书列表错误:', err);
    error(res, '获取证书列表失败', 500);
  }
};

exports.revokeCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('UPDATE certificates SET status = 0 WHERE id = ?', [id]);
    const cert = await dbGet('SELECT * FROM certificates WHERE id = ?', [id]);
    success(res, cert, '证书已撤销');
  } catch (err) {
    console.error('撤销证书错误:', err);
    error(res, '撤销证书失败', 500);
  }
};

exports.reissueCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('UPDATE certificates SET status = 1 WHERE id = ?', [id]);
    const cert = await dbGet('SELECT * FROM certificates WHERE id = ?', [id]);
    success(res, cert, '证书已重新发放');
  } catch (err) {
    console.error('重新发放证书错误:', err);
    error(res, '重新发放证书失败', 500);
  }
};

// 导出证书列表（Excel Base64）
exports.exportCertificates = async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const { keyword, examName, grade, status } = req.query;

    let whereSql = ' WHERE 1=1';
    const params = [];

    if (keyword) {
      whereSql += ' AND (u.name LIKE ? OR u.student_id LIKE ? OR c.certificate_no LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (examName) {
      whereSql += ' AND c.exam_name LIKE ?';
      params.push(`%${examName}%`);
    }
    if (grade) {
      whereSql += ' AND c.grade = ?';
      params.push(grade);
    }
    if (status !== undefined && status !== '') {
      whereSql += ' AND c.status = ?';
      params.push(parseInt(status, 10));
    }

    const listSql = `
      SELECT 
        c.certificate_no as certificateNo,
        u.student_id as studentId,
        u.name as studentName,
        u.department,
        u.class,
        c.exam_name as examName,
        c.score,
        c.grade,
        c.issue_date as issueDate,
        CASE WHEN c.status = 1 THEN '有效' ELSE '已撤销' END as statusText
      FROM certificates c
      JOIN users u ON c.user_id = u.id
      ${whereSql}
      ORDER BY c.created_at DESC
    `;
    const rows = await dbQuery(listSql, params);

    const data = (rows || []).map((r, idx) => ({
      序号: idx + 1,
      证书编号: r.certificateNo,
      学号: r.studentId,
      姓名: r.studentName,
      院系: r.department || '',
      班级: r.class || '',
      考试名称: r.examName,
      分数: r.score,
      等级: r.grade,
      发证日期: r.issueDate,
      状态: r.statusText
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '证书列表');
    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

    const fileName = `证书导出_${new Date().toISOString().slice(0,10)}.xlsx`;
    success(res, { fileName, base64 }, '导出成功');
  } catch (err) {
    console.error('导出证书错误:', err);
    error(res, '导出证书失败', 500);
  }
};

// 手动发放证书（管理员为指定用户颁发证书）
exports.issueCertificate = async (req, res) => {
  try {
    const { userId, examId, score, grade } = req.body;
    if (!userId || !examId) {
      return error(res, '用户ID和考试ID为必填项', 400);
    }

    const user = await dbGet('SELECT id, name FROM users WHERE id = ?', [userId]);
    if (!user) return error(res, '用户不存在', 404);

    const exam = await dbGet('SELECT id, name FROM exams WHERE id = ?', [examId]);
    if (!exam) return error(res, '考试不存在', 404);

    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const certCount = await dbGet('SELECT COUNT(*) as count FROM certificates');
    const certificateNo = `UCAS-LS-${now.getFullYear()}-${String((certCount?.count || 0) + 1).padStart(6, '0')}`;

    let finalGrade = grade || '及格';
    const finalScore = score || 60;
    if (!grade) {
      if (finalScore >= 90) finalGrade = '优秀';
      else if (finalScore >= 80) finalGrade = '良好';
    }

    await dbRun(
      `INSERT INTO certificates (certificate_no, user_id, exam_id, exam_name, score, grade, issue_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [certificateNo, userId, examId, exam.name, finalScore, finalGrade, issueDate]
    );

    const cert = await dbGet('SELECT * FROM certificates WHERE certificate_no = ?', [certificateNo]);
    success(res, cert, '证书发放成功');
  } catch (err) {
    console.error('手动发放证书错误:', err);
    error(res, '发放证书失败', 500);
  }
};

// ============ 系统设置 ============
const DEFAULT_SETTINGS = {
  basic: {
    siteName: '实验室安全教育考试系统',
    siteDesc: '中国科学院大学生命科学学院实验室安全教育考试平台',
    adminEmail: 'admin@ucas.ac.cn',
    recordNo: ''
  },
  cert: {
    issuer: '中国科学院大学生命科学学院',
    validDays: 365,
    autoIssue: true
  },
  contact: {
    phone: '010-12345678',
    email: 'lab-safety@ucas.edu.cn',
    address: '中国科学院大学玉泉路校区'
  }
};

const loadSettingSection = async (key) => {
  const row = await dbGet('SELECT value FROM system_settings WHERE key = ?', [key]);
  if (!row || !row.value) {
    return DEFAULT_SETTINGS[key];
  }
  try {
    const stored = JSON.parse(row.value);
    return { ...DEFAULT_SETTINGS[key], ...stored };
  } catch (e) {
    console.warn('解析系统设置失败，使用默认值:', key, e.message);
    return DEFAULT_SETTINGS[key];
  }
};

exports.getSettings = async (req, res) => {
  try {
    const result = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      result[key] = await loadSettingSection(key);
    }
    success(res, result);
  } catch (err) {
    console.error('获取系统设置失败:', err);
    error(res, '获取系统设置失败', 500);
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { type, data } = req.body;
    if (!DEFAULT_SETTINGS[type]) {
      return error(res, '无效的设置类型', 400);
    }

    const current = await loadSettingSection(type);
    const next = { ...current, ...data };
    const value = JSON.stringify(next);

    await dbRun(
      `
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
      `,
      [type, value]
    );

    success(res, next, '设置已保存');
  } catch (err) {
    console.error('更新系统设置失败:', err);
    error(res, '更新系统设置失败', 500);
  }
};

// ============ 院系/班级管理 ============
exports.getDepartments = async (req, res) => {
  try {
    const { keyword, page = 1, pageSize = 10 } = req.query;
    let sql = 'SELECT * FROM departments WHERE 1=1';
    const params = [];
    if (keyword) {
      sql += ' AND name LIKE ?';
      params.push(`%${keyword}%`);
    }
    // 总数
    const countSql = `SELECT COUNT(*) as count FROM departments WHERE 1=1${keyword ? ' AND name LIKE ?' : ''}`;
    const total = await dbGet(countSql, params);

    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const list = await dbQuery(sql, params);
    success(res, {
      list: list.map(d => ({
        id: d.id,
        name: d.name,
        createTime: d.created_at
      })),
      total: total.count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    console.error('获取院系列表错误:', err);
    error(res, '获取院系列表失败', 500);
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return error(res, '院系名称不能为空', 400);

    const result = await dbRun('INSERT INTO departments (name) VALUES (?)', [name]);
    const dept = await dbGet('SELECT * FROM departments WHERE id = ?', [result.lastID]);
    success(res, { id: dept.id, name: dept.name, createTime: dept.created_at }, '创建成功');
  } catch (err) {
    if (err && err.message && err.message.includes('UNIQUE')) {
      return error(res, '院系名称已存在', 400);
    }
    console.error('创建院系错误:', err);
    error(res, '创建院系失败', 500);
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return error(res, '院系名称不能为空', 400);

    await dbRun('UPDATE departments SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
    const dept = await dbGet('SELECT * FROM departments WHERE id = ?', [id]);
    if (!dept) return error(res, '院系不存在', 404);
    success(res, { id: dept.id, name: dept.name, createTime: dept.created_at }, '更新成功');
  } catch (err) {
    if (err && err.message && err.message.includes('UNIQUE')) {
      return error(res, '院系名称已存在', 400);
    }
    console.error('更新院系错误:', err);
    error(res, '更新院系失败', 500);
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM departments WHERE id = ?', [id]);
    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除院系错误:', err);
    error(res, '删除院系失败', 500);
  }
};

exports.getClasses = async (req, res) => {
  try {
    const { departmentId, keyword, page = 1, pageSize = 10 } = req.query;
    let sql = `
      SELECT c.*, d.name as departmentName
      FROM classes c
      JOIN departments d ON c.department_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (departmentId) {
      sql += ' AND c.department_id = ?';
      params.push(parseInt(departmentId));
    }
    if (keyword) {
      sql += ' AND c.name LIKE ?';
      params.push(`%${keyword}%`);
    }
    // 总数
    const countSql = `
      SELECT COUNT(*) as count
      FROM classes c
      WHERE 1=1
      ${departmentId ? ' AND c.department_id = ?' : ''}
      ${keyword ? ' AND c.name LIKE ?' : ''}
    `;
    const total = await dbGet(countSql, params);

    sql += ' ORDER BY c.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const list = await dbQuery(sql, params);
    success(res, {
      list: list.map(c => ({
        id: c.id,
        departmentId: c.department_id,
        departmentName: c.departmentName,
        name: c.name,
        createTime: c.created_at
      })),
      total: total.count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    console.error('获取班级列表错误:', err);
    error(res, '获取班级列表失败', 500);
  }
};

exports.createClass = async (req, res) => {
  try {
    const { departmentId, name } = req.body;
    if (!departmentId) return error(res, '请选择所属院系', 400);
    if (!name) return error(res, '班级名称不能为空', 400);

    const dept = await dbGet('SELECT * FROM departments WHERE id = ?', [departmentId]);
    if (!dept) return error(res, '所属院系不存在', 400);

    const result = await dbRun(
      'INSERT INTO classes (department_id, name) VALUES (?, ?)',
      [departmentId, name]
    );
    const row = await dbGet(`
      SELECT c.*, d.name as departmentName
      FROM classes c JOIN departments d ON c.department_id = d.id
      WHERE c.id = ?
    `, [result.lastID]);
    success(res, {
      id: row.id,
      departmentId: row.department_id,
      departmentName: row.departmentName,
      name: row.name,
      createTime: row.created_at
    }, '创建成功');
  } catch (err) {
    if (err && err.message && err.message.includes('UNIQUE')) {
      return error(res, '该院系下班级名称已存在', 400);
    }
    console.error('创建班级错误:', err);
    error(res, '创建班级失败', 500);
  }
};

exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { departmentId, name } = req.body;
    if (!departmentId) return error(res, '请选择所属院系', 400);
    if (!name) return error(res, '班级名称不能为空', 400);

    const dept = await dbGet('SELECT * FROM departments WHERE id = ?', [departmentId]);
    if (!dept) return error(res, '所属院系不存在', 400);

    await dbRun(
      'UPDATE classes SET department_id = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [departmentId, name, id]
    );
    const row = await dbGet(`
      SELECT c.*, d.name as departmentName
      FROM classes c JOIN departments d ON c.department_id = d.id
      WHERE c.id = ?
    `, [id]);
    if (!row) return error(res, '班级不存在', 404);
    success(res, {
      id: row.id,
      departmentId: row.department_id,
      departmentName: row.departmentName,
      name: row.name,
      createTime: row.created_at
    }, '更新成功');
  } catch (err) {
    if (err && err.message && err.message.includes('UNIQUE')) {
      return error(res, '该院系下班级名称已存在', 400);
    }
    console.error('更新班级错误:', err);
    error(res, '更新班级失败', 500);
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM classes WHERE id = ?', [id]);
    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除班级错误:', err);
    error(res, '删除班级失败', 500);
  }
};

// ============ 数据库维护（超级管理员） ============
// 备份并清空业务数据（保留院系/班级和表结构）
exports.backupAndClearDatabase = async (req, res) => {
  try {
    // 1. 生成备份文件路径
    const now = new Date();
    const ts = now.toISOString().slice(0,19).replace(/[:T]/g,'-');
    const backupDir = path.join(path.dirname(DB_PATH), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupName = `lab_safety_backup_${ts}.db`;
    const backupPath = path.join(backupDir, backupName);

    // 2. 复制数据库文件
    await fs.promises.copyFile(DB_PATH, backupPath);
    console.log('[DB维护] 已备份数据库到: ', backupPath);

    // 3. 清空业务数据（保留 departments / classes）
    const tablesToClearInOrder = [
      'wrong_questions',
      'learning_progress',
      'certificates',
      'exam_records',
      'exam_assignments',
      'questions',
      'exams',
      'learning_materials',
      'users'
    ];

    await dbRun('BEGIN TRANSACTION');
    for (const t of tablesToClearInOrder) {
      await dbRun(`DELETE FROM ${t}`);
    }
    try {
      await dbRun(
        `DELETE FROM sqlite_sequence WHERE name IN (${tablesToClearInOrder.map(() => '?').join(',')})`,
        tablesToClearInOrder
      );
    } catch (_) {}
    await dbRun('COMMIT');

    return success(res, {
      backupFile: backupName,
      // 前端可直接访问的下载地址（通过 /api/db-backups 静态目录）
      downloadUrl: `/api/db-backups/${backupName}`
    }, '数据库已备份并清空业务数据（院系/班级保留）');
  } catch (err) {
    try { await dbRun('ROLLBACK'); } catch (_) {}
    console.error('备份并清空数据库错误:', err);
    return error(res, '备份并清空数据库失败: ' + (err.message || '未知错误'), 500);
  }
};

// 从上传的数据库文件恢复（需重启后端生效）
exports.restoreDatabase = async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请上传SQLite数据库文件', 400);
    }

    const uploadBuf = req.file.buffer;

    // 1. 备份当前数据库文件
    const now = new Date();
    const ts = now.toISOString().slice(0,19).replace(/[:T]/g,'-');
    const backupDir = path.join(path.dirname(DB_PATH), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupName = `lab_safety_before_restore_${ts}.db`;
    const backupPath = path.join(backupDir, backupName);
    try {
      await fs.promises.copyFile(DB_PATH, backupPath);
      console.log('[DB维护] 恢复前已备份当前数据库到: ', backupPath);
    } catch (e) {
      console.warn('[DB维护] 备份当前数据库失败（可能不存在原库）:', e.message);
    }

    // 2. 覆盖现有数据库文件
    await fs.promises.writeFile(DB_PATH, uploadBuf);
    console.log('[DB维护] 已用上传文件覆盖数据库: ', DB_PATH);

    // 3. 提示需要重启后端
    return success(res, {
      message: '数据库文件已替换，请重启后端服务以使新数据库生效。',
      backupFile: backupName
    }, '数据库恢复文件上传成功，请重启后端。');
  } catch (err) {
    console.error('恢复数据库错误:', err);
    return error(res, '恢复数据库失败: ' + (err.message || '未知错误'), 500);
  }
};
