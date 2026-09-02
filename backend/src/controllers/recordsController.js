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

const sanitizeStoredAnswer = (value) => {
  const isInternalTestMarker = (item) => String(item || '').trim().startsWith('__AUTO_TEST_');

  if (Array.isArray(value)) {
    if (value.some(isInternalTestMarker)) return '错误作答';
    return value;
  }

  if (isInternalTestMarker(value)) return '错误作答';
  return value;
};

const getList = async (req, res) => {
  try {
    const userId = req.user.id;
    const records = await dbQuery(
      `SELECT
         er.id,
         er.exam_id AS examId,
         er.score,
         er.status,
         er.duration,
         er.submit_time AS submitTime,
         e.name AS examTitle,
         e.total_score AS totalScore
       FROM exam_records er
       JOIN exams e ON er.exam_id = e.id
       WHERE er.user_id = ?
       ORDER BY er.submit_time DESC, er.id DESC`,
      [userId]
    );

    const list = records.map((record) => ({
      id: record.id,
      examId: record.examId,
      examTitle: record.examTitle,
      score: record.score,
      totalScore: record.totalScore,
      percentage: record.totalScore > 0
        ? Math.round((record.score / record.totalScore) * 1000) / 10
        : 0,
      passed: record.status === '通过',
      duration: record.duration,
      submitTime: record.submitTime
    }));

    const distinctPassedExams = new Set(
      list.filter((record) => record.passed).map((record) => record.examId)
    );
    const stats = {
      totalExams: list.length,
      passedExams: distinctPassedExams.size,
      highestScore: list.length ? Math.max(...list.map((record) => record.score)) : 0,
      highestPercentage: list.length
        ? Math.max(...list.map((record) => record.percentage))
        : 0
    };

    return success(res, { list, stats }, '获取成功');
  } catch (err) {
    console.error('获取考试记录列表错误:', err);
    return error(res, '获取考试记录列表失败', 500);
  }
};

const buildSnapshotQuestions = (answers) => Object.entries(answers)
  .filter(([, detail]) => detail && detail.snapshot)
  .map(([questionId, detail]) => ({
    id: Number(questionId),
    type: detail.snapshot.type,
    content: detail.snapshot.content,
    category: detail.snapshot.category,
    options: Array.isArray(detail.snapshot.options) ? detail.snapshot.options : [],
    userAnswer: sanitizeStoredAnswer(detail.userAnswer),
    correctAnswer: detail.correctAnswer,
    isCorrect: Boolean(detail.isCorrect),
    analysis: detail.snapshot.analysis || null
  }));

const getDetail = async (req, res) => {
  try {
    const record = await dbGet(
      `SELECT
         er.*,
         e.name AS examTitle,
         e.total_score AS totalScore
       FROM exam_records er
       JOIN exams e ON er.exam_id = e.id
       WHERE er.id = ? AND er.user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (!record) return error(res, '记录不存在', 404);

    const answers = safeParse(record.answers, {});
    const wrongQuestions = safeParse(record.wrong_questions, []);
    let questions = buildSnapshotQuestions(answers);

    // Compatibility for records created before question snapshots were stored.
    if (!questions.length) {
      const currentQuestions = await dbQuery(
        'SELECT * FROM questions WHERE exam_id = ? ORDER BY id ASC',
        [record.exam_id]
      );
      questions = currentQuestions.map((question) => {
        const answerDetail = answers[question.id] || {};
        return {
          id: question.id,
          type: question.type,
          content: question.content,
          category: question.category,
          options: safeParse(question.options, []),
          userAnswer: sanitizeStoredAnswer(answerDetail.userAnswer),
          correctAnswer: question.answer,
          isCorrect: answerDetail.isCorrect !== undefined
            ? Boolean(answerDetail.isCorrect)
            : !wrongQuestions.includes(question.id),
          analysis: question.analysis
        };
      });
    }

    return success(res, {
      id: record.id,
      examTitle: record.examTitle,
      examId: record.exam_id,
      score: record.score,
      totalScore: record.totalScore,
      percentage: record.totalScore > 0
        ? Math.round((record.score / record.totalScore) * 1000) / 10
        : 0,
      passed: record.status === '通过',
      duration: record.duration,
      submitTime: record.submit_time,
      questions
    }, '获取成功');
  } catch (err) {
    console.error('获取考试记录详情错误:', err);
    return error(res, '获取考试记录详情失败', 500);
  }
};

/**
 * Rank users by their best percentage, not raw points from differently scored
 * exams. The response keeps the legacy `score` field for UI compatibility.
 */
const getRanking = async (req, res) => {
  try {
    const rows = await dbQuery(
      `SELECT
         u.id AS userId,
         u.name,
         u.department,
         u.avatar,
         MAX(CASE WHEN e.total_score > 0
             THEN (100.0 * er.score / e.total_score)
             ELSE 0 END) AS bestPercentage
       FROM users u
       JOIN exam_records er ON er.user_id = u.id
       JOIN exams e ON e.id = er.exam_id
       WHERE er.status = '通过' AND u.status = 1
       GROUP BY u.id, u.name, u.department, u.avatar
       ORDER BY bestPercentage DESC, u.id ASC
       LIMIT 100`
    );

    const list = rows.map((row, index) => ({
      userId: row.userId,
      rank: index + 1,
      name: row.name,
      department: row.department,
      avatar: row.avatar || null,
      score: Math.round(Number(row.bestPercentage || 0) * 10) / 10
    }));
    const meItem = list.find((item) => item.userId === req.user.id) || null;

    return success(res, {
      list,
      me: meItem
        ? { rank: meItem.rank, score: meItem.score, total: list.length }
        : { rank: 0, score: 0, total: list.length }
    }, '获取排行榜成功');
  } catch (err) {
    console.error('获取成绩排行榜错误:', err);
    return error(res, '获取成绩排行榜失败', 500);
  }
};

module.exports = {
  getList,
  getDetail,
  getRanking,
  safeParse
};
