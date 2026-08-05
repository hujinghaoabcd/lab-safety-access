const { dbQuery, dbGet, withTransaction } = require('../database/db');
const { normalizeQuestionRow } = require('./secureQuestionController');
const { success, error } = require('../utils/response');

const serializeQuestion = (question) => {
  let options = [];
  try {
    const parsed = JSON.parse(question.options || '[]');
    if (Array.isArray(parsed)) options = parsed;
  } catch (_) {
    options = [];
  }
  return {
    id: question.id,
    content: question.content,
    type: question.type,
    category: question.category,
    options,
    answer: question.answer,
    analysis: question.analysis,
    examId: question.exam_id || null,
    createTime: question.created_at,
    updateTime: question.updated_at
  };
};

const normalizeRequestQuestion = (body = {}) => {
  const options = Array.isArray(body.options)
    ? body.options.map((value, index) => `${String.fromCharCode(65 + index)}.${String(value)}`).join('|')
    : body.options;
  return normalizeQuestionRow({
    '题目内容': body.content,
    '题目类型': body.type,
    '题目分类': body.category,
    '选项': options,
    '正确答案': body.answer,
    '答案解析': body.analysis
  });
};

const validateExamId = async (tx, value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '' || Number(value) === 0) return null;
  const examId = Number.parseInt(value, 10);
  if (!Number.isInteger(examId) || examId <= 0) throw new Error('所属考试 ID 无效');
  const exam = await tx.get('SELECT id FROM exams WHERE id = ?', [examId]);
  if (!exam) throw new Error('所属考试不存在');
  return examId;
};

const syncExamCount = async (tx, examId) => {
  if (!examId) return;
  const count = await tx.get(
    'SELECT COUNT(*) AS count FROM questions WHERE exam_id = ?',
    [examId]
  );
  await tx.run(
    'UPDATE exams SET question_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [Number(count.count || 0), examId]
  );
};

const getQuestions = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || '10', 10) || 10));
    const where = ['1=1'];
    const params = [];
    const keyword = String(req.query.keyword || '').trim();
    const category = String(req.query.category || '').trim();
    const type = String(req.query.type || '').trim();
    const unassigned = String(req.query.unassigned ?? '').trim();

    if (keyword) {
      where.push('content LIKE ?');
      params.push(`%${keyword}%`);
    }
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (type) {
      if (!['单选题', '多选题', '判断题'].includes(type)) {
        return error(res, '题目类型参数无效', 400);
      }
      where.push('type = ?');
      params.push(type);
    }
    if (unassigned === '1') where.push('(exam_id IS NULL OR exam_id = 0)');

    const count = await dbGet(
      `SELECT COUNT(*) AS count FROM questions WHERE ${where.join(' AND ')}`,
      params
    );
    const rows = await dbQuery(
      `SELECT * FROM questions
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return success(res, {
      list: rows.map(serializeQuestion),
      total: Number(count.count || 0),
      page,
      pageSize
    });
  } catch (err) {
    console.error('获取题目列表错误:', err);
    return error(res, '获取题目列表失败', 500);
  }
};

const createQuestion = async (req, res) => {
  try {
    const result = await withTransaction(async (tx) => {
      const question = normalizeRequestQuestion(req.body || {});
      const examId = await validateExamId(tx, req.body && req.body.examId);
      const created = await tx.run(
        `INSERT INTO questions
          (content, type, category, options, answer, analysis, exam_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          question.content,
          question.type,
          question.category,
          JSON.stringify(question.options),
          question.answer,
          question.analysis,
          examId === undefined ? null : examId
        ]
      );
      await syncExamCount(tx, examId);
      await tx.run(
        `INSERT INTO operation_audit_logs
          (actor_type, actor_id, action, target_type, target_id, outcome, ip)
         VALUES ('admin', ?, 'question.create', 'question', ?, 'success', ?)`,
        [
          String(req.user.id),
          String(created.lastID),
          String(req.ip || '').slice(0, 100) || null
        ]
      );
      return tx.get('SELECT * FROM questions WHERE id = ?', [created.lastID]);
    });
    return success(res, serializeQuestion(result), '创建成功');
  } catch (err) {
    if (/不能为空|必须|至少|不能超过|重复|无效|不存在|超出/.test(err.message || '')) {
      return error(res, err.message, 400);
    }
    console.error('创建题目错误:', err);
    return error(res, '创建题目失败', 500);
  }
};

const updateQuestion = async (req, res) => {
  const questionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(questionId) || questionId <= 0) return error(res, '题目 ID 无效', 400);

  try {
    const result = await withTransaction(async (tx) => {
      const current = await tx.get('SELECT * FROM questions WHERE id = ?', [questionId]);
      if (!current) {
        const notFound = new Error('题目不存在');
        notFound.status = 404;
        throw notFound;
      }

      const merged = {
        content: req.body && req.body.content !== undefined ? req.body.content : current.content,
        type: req.body && req.body.type !== undefined ? req.body.type : current.type,
        category: req.body && req.body.category !== undefined ? req.body.category : current.category,
        options: req.body && req.body.options !== undefined
          ? req.body.options
          : JSON.parse(current.options || '[]'),
        answer: req.body && req.body.answer !== undefined ? req.body.answer : current.answer,
        analysis: req.body && req.body.analysis !== undefined ? req.body.analysis : current.analysis
      };
      const question = normalizeRequestQuestion(merged);
      const examId = req.body && Object.prototype.hasOwnProperty.call(req.body, 'examId')
        ? await validateExamId(tx, req.body.examId)
        : current.exam_id;

      await tx.run(
        `UPDATE questions
            SET content = ?, type = ?, category = ?, options = ?, answer = ?,
                analysis = ?, exam_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [
          question.content,
          question.type,
          question.category,
          JSON.stringify(question.options),
          question.answer,
          question.analysis,
          examId,
          questionId
        ]
      );
      await syncExamCount(tx, current.exam_id);
      if (examId !== current.exam_id) await syncExamCount(tx, examId);
      await tx.run(
        `INSERT INTO operation_audit_logs
          (actor_type, actor_id, action, target_type, target_id, outcome, detail, ip)
         VALUES ('admin', ?, 'question.update', 'question', ?, 'success', ?, ?)`,
        [
          String(req.user.id),
          String(questionId),
          JSON.stringify({ previousExamId: current.exam_id || null, examId: examId || null }),
          String(req.ip || '').slice(0, 100) || null
        ]
      );
      return tx.get('SELECT * FROM questions WHERE id = ?', [questionId]);
    });
    return success(res, serializeQuestion(result), '更新成功');
  } catch (err) {
    if (err.status) return error(res, err.message, err.status);
    if (/不能为空|必须|至少|不能超过|重复|无效|不存在|超出/.test(err.message || '')) {
      return error(res, err.message, 400);
    }
    console.error('更新题目错误:', err);
    return error(res, '更新题目失败', 500);
  }
};

module.exports = {
  getQuestions,
  createQuestion,
  updateQuestion,
  serializeQuestion,
  normalizeRequestQuestion
};
