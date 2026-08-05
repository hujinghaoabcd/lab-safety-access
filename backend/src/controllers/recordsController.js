const { dbQuery, dbGet } = require('../database/db');
const { success, error } = require('../utils/response');

/**
 * 获取考试记录列表
 */
const getList = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const records = await dbQuery(`
      SELECT 
        er.id,
        er.score,
        er.status,
        er.duration,
        er.submit_time as submitTime,
        e.name as examTitle,
        e.total_score as totalScore
      FROM exam_records er
      JOIN exams e ON er.exam_id = e.id
      WHERE er.user_id = ?
      ORDER BY er.submit_time DESC
    `, [userId]);

    const list = records.map(record => ({
      id: record.id,
      examTitle: record.examTitle,
      score: record.score,
      totalScore: record.totalScore,
      passed: record.status === '通过',
      duration: record.duration,
      submitTime: record.submitTime
    }));

    // 统计信息
    const stats = {
      totalExams: list.length,
      passedExams: list.filter(r => r.passed).length,
      highestScore: list.length > 0 ? Math.max(...list.map(r => r.score)) : 0
    };

    success(res, { list, stats }, '获取成功');
  } catch (err) {
    console.error('获取考试记录列表错误:', err);
    error(res, '获取考试记录列表失败', 500);
  }
};

/**
 * 获取考试记录详情
 */
const getDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const record = await dbGet(`
      SELECT 
        er.*,
        e.name as examTitle,
        e.total_score as totalScore
      FROM exam_records er
      JOIN exams e ON er.exam_id = e.id
      WHERE er.id = ? AND er.user_id = ?
    `, [id, userId]);

    if (!record) {
      return error(res, '记录不存在', 404);
    }

    // 获取题目详情和作答情况
    const examQuestions = await dbQuery(
      'SELECT * FROM questions WHERE exam_id = ?',
      [record.exam_id]
    );

    const answers = JSON.parse(record.answers || '{}');
    const wrongQuestions = JSON.parse(record.wrong_questions || '[]');

    const questions = examQuestions.map(q => {
      const answerDetail = answers[q.id] || {};
      const isWrong = wrongQuestions.includes(q.id);

      return {
        id: q.id,
        type: q.type,
        content: q.content,
        options: JSON.parse(q.options),
        userAnswer: answerDetail.userAnswer,
        correctAnswer: q.answer,
        isCorrect: !isWrong,
        analysis: q.analysis
      };
    });

    success(res, {
      id: record.id,
      examTitle: record.examTitle,
      examId: record.exam_id,
      score: record.score,
      totalScore: record.totalScore,
      passed: record.status === '通过',
      duration: record.duration,
      submitTime: record.submit_time,
      questions
    }, '获取成功');
  } catch (err) {
    console.error('获取考试记录详情错误:', err);
    error(res, '获取考试记录详情失败', 500);
  }
};

/**
 * 成绩排行榜（按用户最高得分统计）
 */
const getRanking = async (req, res) => {
  try {
    const userId = req.user.id;

    // 按用户聚合最高得分
    const rows = await dbQuery(
      `SELECT 
        u.id as userId,
        u.name,
        u.department,
        u.avatar,
        MAX(er.score) as bestScore
       FROM users u
       JOIN exam_records er ON er.user_id = u.id
       WHERE er.status = '通过'
       GROUP BY u.id
       ORDER BY bestScore DESC, u.id ASC
       LIMIT 100`
    );

    const list = (rows || []).map((row, index) => ({
      userId: row.userId,
      rank: index + 1,
      name: row.name,
      department: row.department,
      avatar: row.avatar || null,
      score: row.bestScore || 0
    }));

    const total = list.length;
    const meItem = list.find(item => item.userId === userId) || null;
    const me = meItem
      ? { rank: meItem.rank, score: meItem.score, total }
      : { rank: 0, score: 0, total };

    success(res, { list, me }, '获取排行榜成功');
  } catch (err) {
    console.error('获取成绩排行榜错误:', err);
    error(res, '获取成绩排行榜失败', 500);
  }
};

module.exports = {
  getList,
  getDetail,
  getRanking
};
