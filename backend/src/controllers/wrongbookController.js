const { dbQuery, dbGet, dbRun } = require('../database/db');
const { success, error } = require('../utils/response');

/**
 * 获取错题列表
 */
const getList = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query; // 可选：单选题、多选题、判断题

    let sql = `
      SELECT 
        q.id,
        q.type,
        q.content,
        q.options,
        q.answer,
        q.analysis,
        COUNT(wq.id) as wrongCount,
        MAX(wq.created_at) as lastWrongTime
      FROM wrong_questions wq
      JOIN questions q ON wq.question_id = q.id
      WHERE wq.user_id = ?
    `;
    const params = [userId];

    if (type) {
      sql += ' AND q.type = ?';
      params.push(type);
    }

    sql += ' GROUP BY q.id ORDER BY lastWrongTime DESC';

    const wrongQuestions = await dbQuery(sql, params);

    const list = wrongQuestions.map(item => ({
      id: item.id,
      type: item.type,
      content: item.content,
      options: JSON.parse(item.options),
      correctAnswer: item.answer,
      analysis: item.analysis,
      wrongCount: item.wrongCount,
      lastWrongTime: item.lastWrongTime ? item.lastWrongTime.split('T')[0] : null
    }));

    success(res, list, '获取成功');
  } catch (err) {
    console.error('获取错题列表错误:', err);
    error(res, '获取错题列表失败', 500);
  }
};

/**
 * 删除错题（标记为已掌握）
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 删除该用户的所有该题目的错题记录
    await dbRun(
      'DELETE FROM wrong_questions WHERE user_id = ? AND question_id = ?',
      [userId, id]
    );

    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除错题错误:', err);
    error(res, '删除错题失败', 500);
  }
};

module.exports = {
  getList,
  remove
};
