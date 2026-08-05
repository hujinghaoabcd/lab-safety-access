const { dbQuery, dbGet } = require('../database/db');
const { success, error } = require('../utils/response');

const safeParse = (value, fallback) => {
  try {
    const parsed = JSON.parse(value || '');
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (_) {
    return fallback;
  }
};

const getRecords = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || '10', 10) || 10));
    const where = ['1=1'];
    const params = [];
    const keyword = String(req.query.keyword || '').trim();
    const examName = String(req.query.examName || '').trim();
    const status = String(req.query.status || '').trim();

    if (keyword) {
      where.push('(u.name LIKE ? OR u.student_id LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (examName) {
      where.push('e.name LIKE ?');
      params.push(`%${examName}%`);
    }
    if (status) {
      if (!['通过', '未通过'].includes(status)) return error(res, '考试状态参数无效', 400);
      where.push('er.status = ?');
      params.push(status);
    }

    const count = await dbGet(
      `SELECT COUNT(*) AS count
         FROM exam_records er
         JOIN users u ON u.id = er.user_id
         JOIN exams e ON e.id = er.exam_id
        WHERE ${where.join(' AND ')}`,
      params
    );
    const rows = await dbQuery(
      `SELECT er.id,
              er.user_id AS userId,
              er.exam_id AS examId,
              u.student_id AS studentId,
              u.name AS studentName,
              u.department,
              u.class AS className,
              e.name AS examName,
              er.score,
              e.total_score AS totalScore,
              er.status,
              er.duration,
              er.submit_time AS submitTime
         FROM exam_records er
         JOIN users u ON u.id = er.user_id
         JOIN exams e ON e.id = er.exam_id
        WHERE ${where.join(' AND ')}
        ORDER BY er.submit_time DESC, er.id DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return success(res, {
      list: rows.map((row) => ({
        ...row,
        percentage: row.totalScore > 0
          ? Math.round((row.score / row.totalScore) * 1000) / 10
          : 0
      })),
      total: Number(count.count || 0),
      page,
      pageSize
    });
  } catch (err) {
    console.error('获取考试记录错误:', err);
    return error(res, '获取考试记录失败', 500);
  }
};

const snapshotQuestions = (answers) => Object.entries(answers)
  .filter(([, detail]) => detail && detail.snapshot)
  .map(([questionId, detail]) => ({
    id: Number(questionId),
    type: detail.snapshot.type,
    content: detail.snapshot.content,
    category: detail.snapshot.category,
    options: Array.isArray(detail.snapshot.options) ? detail.snapshot.options : [],
    userAnswer: detail.userAnswer,
    correctAnswer: detail.correctAnswer,
    isCorrect: Boolean(detail.isCorrect),
    analysis: detail.snapshot.analysis || null
  }));

const getRecordDetail = async (req, res) => {
  const recordId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(recordId) || recordId <= 0) return error(res, '记录 ID 无效', 400);

  try {
    const record = await dbGet(
      `SELECT er.*,
              u.name AS studentName,
              u.student_id AS studentId,
              u.department,
              u.class AS className,
              e.name AS examName,
              e.total_score AS totalScore
         FROM exam_records er
         JOIN users u ON u.id = er.user_id
         JOIN exams e ON e.id = er.exam_id
        WHERE er.id = ?`,
      [recordId]
    );
    if (!record) return error(res, '记录不存在', 404);

    const answers = safeParse(record.answers, {});
    const wrongQuestionIds = safeParse(record.wrong_questions, []);
    let questions = snapshotQuestions(answers);

    if (!questions.length) {
      const currentQuestions = await dbQuery(
        'SELECT * FROM questions WHERE exam_id = ? ORDER BY id',
        [record.exam_id]
      );
      questions = currentQuestions.map((question) => {
        const detail = answers[question.id] || {};
        return {
          id: question.id,
          type: question.type,
          content: question.content,
          category: question.category,
          options: safeParse(question.options, []),
          userAnswer: detail.userAnswer,
          correctAnswer: question.answer,
          isCorrect: detail.isCorrect !== undefined
            ? Boolean(detail.isCorrect)
            : !wrongQuestionIds.includes(question.id),
          analysis: question.analysis
        };
      });
    }

    return success(res, {
      id: record.id,
      userId: record.user_id,
      examId: record.exam_id,
      studentName: record.studentName,
      studentId: record.studentId,
      department: record.department,
      className: record.className,
      examName: record.examName,
      score: record.score,
      totalScore: record.totalScore,
      percentage: record.totalScore > 0
        ? Math.round((record.score / record.totalScore) * 1000) / 10
        : 0,
      status: record.status,
      duration: record.duration,
      submitTime: record.submit_time,
      questions
    });
  } catch (err) {
    console.error('获取考试详情错误:', err);
    return error(res, '获取考试详情失败', 500);
  }
};

module.exports = {
  getRecords,
  getRecordDetail,
  safeParse,
  snapshotQuestions
};
