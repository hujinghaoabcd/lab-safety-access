const { dbQuery, dbGet } = require('../database/db');
const { success, error } = require('../utils/response');

const safeParseArray = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const getExams = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || '10', 10) || 10));
    const where = ['1=1'];
    const params = [];
    const keyword = String(req.query.keyword || '').trim();
    const status = String(req.query.status ?? '').trim();

    if (keyword) {
      where.push('name LIKE ?');
      params.push(`%${keyword}%`);
    }
    if (status !== '') {
      if (!['0', '1'].includes(status)) return error(res, '考试状态参数无效', 400);
      where.push('status = ?');
      params.push(Number(status));
    }

    const count = await dbGet(
      `SELECT COUNT(*) AS count FROM exams WHERE ${where.join(' AND ')}`,
      params
    );
    const rows = await dbQuery(
      `SELECT id, name, category, description, duration,
              total_score AS totalScore, pass_score AS passScore,
              question_count AS questionCount, status,
              created_at AS createTime, updated_at AS updateTime
         FROM exams
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return success(res, {
      list: rows,
      total: Number(count.count || 0),
      page,
      pageSize
    });
  } catch (err) {
    console.error('获取考试列表错误:', err);
    return error(res, '获取考试列表失败', 500);
  }
};

const getExamAssignments = async (req, res) => {
  const examId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(examId) || examId <= 0) return error(res, '考试 ID 无效', 400);

  try {
    const exam = await dbGet('SELECT id FROM exams WHERE id = ?', [examId]);
    if (!exam) return error(res, '考试不存在', 404);
    const rows = await dbQuery(
      `SELECT id, exam_id AS examId, department, class,
              created_at AS createdAt
         FROM exam_assignments
        WHERE exam_id = ?
        ORDER BY id`,
      [examId]
    );
    return success(res, rows);
  } catch (err) {
    console.error('获取考试发布范围错误:', err);
    return error(res, '获取考试发布范围失败', 500);
  }
};

const getExamQuestions = async (req, res) => {
  const examId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(examId) || examId <= 0) return error(res, '考试 ID 无效', 400);

  try {
    const exam = await dbGet('SELECT id FROM exams WHERE id = ?', [examId]);
    if (!exam) return error(res, '考试不存在', 404);
    const rows = await dbQuery(
      `SELECT id, content, type, category, options, answer, analysis,
              created_at AS createTime
         FROM questions
        WHERE exam_id = ?
        ORDER BY created_at DESC, id DESC`,
      [examId]
    );
    return success(res, rows.map((question) => ({
      ...question,
      options: safeParseArray(question.options)
    })));
  } catch (err) {
    console.error('获取考试题目错误:', err);
    return error(res, '获取考试题目失败', 500);
  }
};

module.exports = {
  getExams,
  getExamAssignments,
  getExamQuestions,
  safeParseArray
};
