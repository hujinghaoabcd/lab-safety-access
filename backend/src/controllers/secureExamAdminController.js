const { dbGet, dbRun, withTransaction } = require('../database/db');
const { success, error } = require('../utils/response');

const parseInteger = (value, label, { min, max } = {}) => {
  const text = String(value ?? '').trim();
  if (!/^-?\d+$/.test(text)) throw new Error(`${label}必须是整数`);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label}超出有效范围`);
  if (min !== undefined && parsed < min) throw new Error(`${label}不能小于 ${min}`);
  if (max !== undefined && parsed > max) throw new Error(`${label}不能大于 ${max}`);
  return parsed;
};

const normalizeExamPayload = (body, { partial = false } = {}) => {
  const input = body || {};
  const result = {};

  if (!partial || input.name !== undefined) {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('考试名称不能为空');
    if (name.length > 200) throw new Error('考试名称不能超过 200 个字符');
    result.name = name;
  }
  if (!partial || input.description !== undefined) {
    const description = String(input.description || '').trim();
    if (description.length > 5000) throw new Error('考试说明不能超过 5000 个字符');
    result.description = description || null;
  }
  if (!partial || input.category !== undefined) {
    const category = String(input.category || '').trim();
    if (category.length > 100) throw new Error('考试分类不能超过 100 个字符');
    result.category = category || null;
  }
  if (!partial || input.duration !== undefined) {
    result.duration = parseInteger(input.duration, '考试时长', { min: 1, max: 1440 });
  }
  if (!partial || input.totalScore !== undefined) {
    result.totalScore = parseInteger(input.totalScore, '总分', { min: 1, max: 10000 });
  }
  if (!partial || input.passScore !== undefined) {
    result.passScore = parseInteger(input.passScore, '及格分数', { min: 0, max: 10000 });
  }
  if (!partial || input.questionCount !== undefined) {
    result.questionCount = parseInteger(input.questionCount ?? 0, '题目数量', { min: 0, max: 10000 });
  }

  if (result.totalScore !== undefined && result.passScore !== undefined
      && result.passScore > result.totalScore) {
    throw new Error('及格分数不能高于总分');
  }
  return result;
};

const serializeExam = (exam) => ({
  id: exam.id,
  name: exam.name,
  category: exam.category || '',
  description: exam.description || '',
  duration: exam.duration,
  totalScore: exam.total_score,
  passScore: exam.pass_score,
  questionCount: exam.question_count,
  status: exam.status,
  createTime: exam.created_at,
  updateTime: exam.updated_at
});

const createExam = async (req, res) => {
  try {
    const payload = normalizeExamPayload(req.body);
    const result = await dbRun(
      `INSERT INTO exams
        (name, category, description, duration, total_score, pass_score, question_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        payload.name,
        payload.category,
        payload.description,
        payload.duration,
        payload.totalScore,
        payload.passScore,
        payload.questionCount
      ]
    );
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [result.lastID]);
    return success(res, serializeExam(exam), '创建成功');
  } catch (err) {
    if (/不能为空|不能|必须|超出/.test(err.message || '')) return error(res, err.message, 400);
    console.error('创建考试错误:', err);
    return error(res, '创建考试失败', 500);
  }
};

const updateExam = async (req, res) => {
  try {
    const existing = await dbGet('SELECT * FROM exams WHERE id = ?', [req.params.id]);
    if (!existing) return error(res, '考试不存在', 404);
    const payload = normalizeExamPayload(req.body, { partial: true });
    const merged = {
      totalScore: payload.totalScore ?? existing.total_score,
      passScore: payload.passScore ?? existing.pass_score
    };
    if (merged.passScore > merged.totalScore) {
      return error(res, '及格分数不能高于总分', 400);
    }

    const fieldMap = {
      name: 'name',
      category: 'category',
      description: 'description',
      duration: 'duration',
      totalScore: 'total_score',
      passScore: 'pass_score',
      questionCount: 'question_count'
    };
    const updates = [];
    const values = [];
    for (const [key, column] of Object.entries(fieldMap)) {
      if (payload[key] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(payload[key]);
      }
    }
    if (!updates.length) return error(res, '没有需要更新的字段', 400);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);
    await dbRun(`UPDATE exams SET ${updates.join(', ')} WHERE id = ?`, values);
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [req.params.id]);
    return success(res, serializeExam(exam), '更新成功');
  } catch (err) {
    if (/不能为空|不能|必须|超出/.test(err.message || '')) return error(res, err.message, 400);
    console.error('更新考试错误:', err);
    return error(res, '更新考试失败', 500);
  }
};

const toggleExamStatus = async (req, res) => {
  try {
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [req.params.id]);
    if (!exam) return error(res, '考试不存在', 404);
    const newStatus = Number(exam.status) === 1 ? 0 : 1;

    if (newStatus === 1) {
      const countRow = await dbGet(
        'SELECT COUNT(*) AS count FROM questions WHERE exam_id = ?',
        [req.params.id]
      );
      const actualCount = Number(countRow.count || 0);
      if (actualCount === 0) return error(res, '考试没有配置题目，不能发布', 409);
      if (Number(exam.pass_score) > Number(exam.total_score)) {
        return error(res, '及格分数高于总分，不能发布', 409);
      }
      await dbRun(
        `UPDATE exams
            SET status = 1, question_count = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [actualCount, req.params.id]
      );
    } else {
      await dbRun(
        'UPDATE exams SET status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [req.params.id]
      );
    }
    return success(res, { status: newStatus }, newStatus ? '已发布' : '已下架');
  } catch (err) {
    console.error('切换考试状态错误:', err);
    return error(res, '操作失败', 500);
  }
};

const normalizeAssignment = (value) => {
  const department = String((value && value.department) || '').trim() || null;
  const className = String((value && value.class) || '').trim() || null;
  if (department && department.length > 200) throw new Error('院系名称过长');
  if (className && className.length > 200) throw new Error('班级名称过长');
  if (className && !department) throw new Error('指定班级时必须同时指定院系');
  return { department, className };
};

const updateExamAssignments = async (req, res) => {
  const assignments = req.body && req.body.assignments;
  if (!Array.isArray(assignments)) return error(res, '发布范围必须是数组', 400);
  if (assignments.length > 1000) return error(res, '发布范围数量不能超过 1000', 400);

  try {
    const exam = await dbGet('SELECT id FROM exams WHERE id = ?', [req.params.id]);
    if (!exam) return error(res, '考试不存在', 404);

    const normalized = assignments.map(normalizeAssignment);
    const unique = [];
    const seen = new Set();
    for (const item of normalized) {
      const key = `${item.department || ''}\u0000${item.className || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    await withTransaction(async (tx) => {
      await tx.run('DELETE FROM exam_assignments WHERE exam_id = ?', [req.params.id]);
      for (const item of unique) {
        if (item.department) {
          const department = await tx.get(
            'SELECT id FROM departments WHERE name = ?',
            [item.department]
          );
          if (!department) throw new Error(`院系不存在：${item.department}`);
          if (item.className) {
            const classRow = await tx.get(
              `SELECT c.id
                 FROM classes c
                 JOIN departments d ON d.id = c.department_id
                WHERE d.name = ? AND c.name = ?`,
              [item.department, item.className]
            );
            if (!classRow) throw new Error(`班级不存在：${item.department}/${item.className}`);
          }
        }
        await tx.run(
          'INSERT INTO exam_assignments (exam_id, department, class) VALUES (?, ?, ?)',
          [req.params.id, item.department, item.className]
        );
      }
    });

    return success(res, { count: unique.length }, '发布范围更新成功');
  } catch (err) {
    if (/不存在|过长|必须/.test(err.message || '')) return error(res, err.message, 400);
    console.error('更新考试发布范围错误:', err);
    return error(res, '更新考试发布范围失败', 500);
  }
};

module.exports = {
  createExam,
  updateExam,
  toggleExamStatus,
  updateExamAssignments,
  normalizeExamPayload
};
