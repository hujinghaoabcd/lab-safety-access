const { dbQuery, dbGet } = require('../database/db');
const { success, error } = require('../utils/response');

const getDashboardStats = async (_req, res) => {
  try {
    const [userCount, examCount, questionCount, todayExamCount, passRecords, totalRecords] = await Promise.all([
      dbGet('SELECT COUNT(*) AS count FROM users WHERE status = 1'),
      dbGet('SELECT COUNT(*) AS count FROM exams WHERE status = 1'),
      dbGet('SELECT COUNT(*) AS count FROM questions'),
      dbGet(
        "SELECT COUNT(*) AS count FROM exam_records WHERE DATE(submit_time) = DATE('now', 'localtime')"
      ),
      dbGet("SELECT COUNT(*) AS count FROM exam_records WHERE status = '通过'"),
      dbGet('SELECT COUNT(*) AS count FROM exam_records')
    ]);

    const total = Number(totalRecords.count || 0);
    const passed = Number(passRecords.count || 0);
    return success(res, {
      userCount: Number(userCount.count || 0),
      examCount: Number(examCount.count || 0),
      questionCount: Number(questionCount.count || 0),
      todayExamCount: Number(todayExamCount.count || 0),
      passRate: total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : '0%'
    });
  } catch (err) {
    console.error('获取统计数据错误:', err);
    return error(res, '获取统计数据失败', 500);
  }
};

const getChartData = async (_req, res) => {
  try {
    const trendRows = await dbQuery(`
      WITH RECURSIVE dates(day, offset) AS (
        SELECT DATE('now', 'localtime', '-6 day'), 0
        UNION ALL
        SELECT DATE(day, '+1 day'), offset + 1 FROM dates WHERE offset < 6
      )
      SELECT day,
             CAST(STRFTIME('%m', day) AS INTEGER) || '-' ||
             CAST(STRFTIME('%d', day) AS INTEGER) AS label,
             (SELECT COUNT(*) FROM exam_records WHERE DATE(submit_time) = day) AS value
        FROM dates
       ORDER BY day
    `);

    const distribution = await dbQuery(`
      WITH cats(name, sort_order) AS (
        SELECT '通用安全', 1 UNION ALL
        SELECT '化学安全', 2 UNION ALL
        SELECT '生物安全', 3 UNION ALL
        SELECT '辐射安全', 4 UNION ALL
        SELECT '电气安全', 5 UNION ALL
        SELECT '消防安全', 6
      ), counts AS (
        SELECT category AS name, COUNT(*) AS value
          FROM questions
         GROUP BY category
      )
      SELECT cats.name, COALESCE(counts.value, 0) AS value
        FROM cats
        LEFT JOIN counts ON counts.name = cats.name
       ORDER BY cats.sort_order
    `);

    return success(res, {
      trend: {
        dates: trendRows.map((row) => row.label),
        values: trendRows.map((row) => Number(row.value || 0))
      },
      distribution: distribution.map((row) => ({
        name: row.name,
        value: Number(row.value || 0)
      }))
    });
  } catch (err) {
    console.error('获取图表数据错误:', err);
    return error(res, '获取图表数据失败', 500);
  }
};

const getRecentExams = async (_req, res) => {
  try {
    const records = await dbQuery(`
      SELECT er.id,
             u.student_id AS studentId,
             u.name AS studentName,
             e.name AS examName,
             er.score,
             er.status,
             er.duration,
             er.submit_time AS submitTime
        FROM exam_records er
        JOIN users u ON u.id = er.user_id
        JOIN exams e ON e.id = er.exam_id
       ORDER BY er.submit_time DESC, er.id DESC
       LIMIT 5
    `);
    return success(res, records);
  } catch (err) {
    console.error('获取最近考试记录错误:', err);
    return error(res, '获取最近考试记录失败', 500);
  }
};

module.exports = {
  getDashboardStats,
  getChartData,
  getRecentExams
};
