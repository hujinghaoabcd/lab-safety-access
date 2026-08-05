const { dbQuery, dbGet, dbRun } = require('../database/db');
const { success, error } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

/**
 * 获取考试列表（基于发布范围和用户班级）
 * 规则：
 *  - 只返回已发布的考试（exams.status = 1）
 *  - 如果考试未设置任何发布范围（exam_assignments 无记录），视为对所有用户开放
 *  - 如果设置了发布范围，只返回与当前用户 department/class 匹配的考试
 *  - 结合用户考试记录，计算：
 *      passed: 是否已通过至少一次
 *      attempts: 已参加次数
 *      status:
 *        - 'passed'         已通过
 *        - 'not_available'  未通过且尝试次数 >= 3
 *        - 'available'      其余情况（待考试）
 */
const getList = async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取用户所属院系/班级
    const user = await dbGet(
      'SELECT department, class FROM users WHERE id = ?',
      [userId]
    );
    if (!user) {
      return error(res, '用户不存在', 404);
    }

    const userDept = user.department || '';
    const userClass = user.class || '';

    // 获取与当前用户匹配的已发布考试：
    // - 没有任何发布范围配置的考试（a.id IS NULL）视为对所有人开放
    // - 或者 exam_assignments 中存在一条记录与用户 department/class 匹配
    const exams = await dbQuery(
      `
      SELECT DISTINCT e.*
      FROM exams e
      LEFT JOIN exam_assignments a ON a.exam_id = e.id
      WHERE e.status = 1
        AND (
          a.id IS NULL
          OR (
            a.department = ?
            AND (a.class IS NULL OR a.class = '' OR a.class = ?)
          )
        )
      ORDER BY e.created_at DESC
      `,
      [userDept, userClass]
    );

    // 获取用户在这些考试上的记录
    const userRecords = await dbQuery(
      `SELECT 
        exam_id, 
        COUNT(*) as attempts, 
        MAX(CASE WHEN status = '通过' THEN 1 ELSE 0 END) as passed 
       FROM exam_records 
       WHERE user_id = ? 
       GROUP BY exam_id`,
      [userId]
    );

    const recordsMap = {};
    (userRecords || []).forEach(r => {
      recordsMap[r.exam_id] = {
        attempts: r.attempts,
        passed: r.passed === 1
      };
    });

    const list = (exams || []).map(exam => {
      const record = recordsMap[exam.id] || { attempts: 0, passed: false };
      
      let status = 'available';
      if (record.passed) {
        status = 'passed';
      } else if (record.attempts >= 3) { // 默认最大尝试次数为3
        status = 'not_available';
      }

      return {
        id: exam.id,
        name: exam.name,
        category: exam.category,
        description: exam.description,
        duration: exam.duration,
        totalScore: exam.total_score,
        passScore: exam.pass_score,
        questionCount: exam.question_count,
        maxAttempts: 3,
        attempts: record.attempts,
        status
      };
    });

    success(res, list, '获取成功');
  } catch (err) {
    console.error('获取考试列表错误:', err);
    error(res, '获取考试列表失败', 500);
  }
};

/**
 * 获取考试详情
 */
const getDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [id]);

    if (!exam) {
      return error(res, '考试不存在', 404);
    }

    success(res, {
      id: exam.id,
      name: exam.name,
      category: exam.category,
      description: exam.description,
      duration: exam.duration,
      totalScore: exam.total_score,
      passScore: exam.pass_score,
      questionCount: exam.question_count,
      maxAttempts: 3
    }, '获取成功');
  } catch (err) {
    console.error('获取考试详情错误:', err);
    error(res, '获取考试详情失败', 500);
  }
};

/**
 * 开始考试 - 获取题目
 */
const startExam = async (req, res) => {
  try {
    const { examId } = req.body;
    const exam = await dbGet('SELECT * FROM exams WHERE id = ? AND status = 1', [examId]);

    if (!exam) {
      return error(res, '考试不存在或未发布', 404);
    }

    // 获取该考试的题目（不包含答案）
    const examQuestions = await dbQuery(
      'SELECT id, content, type, category, options FROM questions WHERE exam_id = ?',
      [examId]
    );

    const questions = examQuestions.map(q => ({
      id: q.id,
      content: q.content,
      type: q.type,
      category: q.category,
      options: JSON.parse(q.options)
    }));

    success(res, {
      exam: {
        id: exam.id,
        name: exam.name,
        duration: exam.duration,
        totalScore: exam.total_score,
        passScore: exam.pass_score,
        questionCount: exam.question_count
      },
      questions
    }, '考试开始');
  } catch (err) {
    console.error('开始考试错误:', err);
    error(res, '开始考试失败', 500);
  }
};

/**
 * 提交考试
 */
const submitExam = async (req, res) => {
  try {
    const { examId, answers, duration } = req.body;
    const userId = req.user.id;
    
    const exam = await dbGet('SELECT * FROM exams WHERE id = ?', [examId]);
    if (!exam) {
      return error(res, '考试不存在', 404);
    }

    // 获取题目和正确答案
    const examQuestions = await dbQuery(
      'SELECT id, content, type, options, answer FROM questions WHERE exam_id = ?',
      [examId]
    );

    // 计算分数
    let correctCount = 0;
    let wrongCount = 0;
    let score = 0;
    const wrongQuestions = [];
    const answerDetails = {};

    examQuestions.forEach(q => {
      const userAnswer = answers[q.id];
      const correctAnswer = q.answer;
      
      let isCorrect = false;
      if (q.type === '多选题') {
        // 多选题：答案应该是数组，比较排序后的数组
        const userArr = Array.isArray(userAnswer) ? userAnswer.sort().join('') : String(userAnswer);
        const correctArr = correctAnswer.split('').sort().join('');
        isCorrect = userArr === correctArr;
      } else {
        // 单选题和判断题
        isCorrect = String(userAnswer) === String(correctAnswer);
      }

      answerDetails[q.id] = {
        userAnswer,
        correctAnswer,
        isCorrect
      };

      if (isCorrect) {
        correctCount++;
        // 每题分数 = 总分 / 题目数
        score += Math.floor(exam.total_score / examQuestions.length);
      } else {
        wrongCount++;
        wrongQuestions.push(q.id);
      }
    });

    // 调试输出：逐题打印用户作答与正确答案，方便核对得分逻辑
    try {
      const debugItems = examQuestions.map(q => ({
        questionId: q.id,
        content: q.content,
        type: q.type,
        correctAnswer: q.answer,
        userAnswer: answers[q.id],
        isCorrect: !!(answerDetails[q.id] && answerDetails[q.id].isCorrect)
      }));
      console.log('[提交考试调试] examId=%s userId=%s totalScore=%s passScore=%s 计算结果: score=%s, correct=%s, wrong=%s',
        examId,
        userId,
        exam.total_score,
        exam.pass_score,
        score,
        correctCount,
        wrongCount
      );
      console.log('[提交考试调试] 逐题详情:', JSON.stringify(debugItems, null, 2));
    } catch (e) {
      console.warn('打印考试调试信息失败:', e);
    }

    // 确保分数不超过总分
    score = Math.min(score, exam.total_score);
    const passed = score >= exam.pass_score;
    const status = passed ? '通过' : '未通过';

    // 创建考试记录
    const submitTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const durationStr = duration || '0分0秒';
    
    // 为了兼容历史数据导致的外键约束问题，这里在一个事务中暂时关闭外键检查
    try {
      await dbRun('PRAGMA foreign_keys = OFF');
    } catch (e) {
      console.warn('关闭外键检查失败（可忽略继续）:', e);
    }

    await dbRun('BEGIN TRANSACTION');

    const insertRes = await dbRun(
      `INSERT INTO exam_records (user_id, exam_id, score, status, duration, answers, wrong_questions, submit_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        examId,
        score,
        status,
        durationStr,
        JSON.stringify(answerDetails),
        JSON.stringify(wrongQuestions),
        submitTime
      ]
    );

    const recordId = insertRes.lastID;

    // 如果通过，创建证书（检查是否已有该考试的有效证书，避免重复发放）
    if (passed) {
      const existingCert = await dbGet(
        'SELECT id FROM certificates WHERE user_id = ? AND exam_id = ? AND status = 1',
        [userId, examId]
      );

      if (!existingCert) {
        const now = new Date();
        const issueDate = now.toISOString().split('T')[0];
        
        // 计算等级
        let grade = '及格';
        if (score >= 90) {
          grade = '优秀';
        } else if (score >= 80) {
          grade = '良好';
        }

        // 生成唯一证书编号：年份 + 时间戳后6位 + 随机3位
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const certificateNo = `UCAS-LS-${now.getFullYear()}-${timestamp}${random}`;

        await dbRun(
          `INSERT INTO certificates (certificate_no, user_id, exam_id, exam_name, score, grade, issue_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [certificateNo, userId, examId, exam.name, score, grade, issueDate]
        );
      }
    }

    // 无论是否通过，都将这次错题写入错题本（wrong_questions）
    if (wrongQuestions.length > 0) {
      for (const questionId of wrongQuestions) {
        await dbRun(
          `INSERT INTO wrong_questions (user_id, question_id, user_answer, exam_record_id)
           VALUES (?, ?, ?, ?)`,
          [userId, questionId, JSON.stringify(answerDetails[questionId].userAnswer), recordId]
        );
      }
    }

    await dbRun('COMMIT');

    try {
      await dbRun('PRAGMA foreign_keys = ON');
    } catch (e) {
      console.warn('重新开启外键检查失败（可忽略）:', e);
    }

    success(res, {
      recordId,
      score,
      totalScore: exam.total_score,
      passed,
      correctCount,
      wrongCount
    }, passed ? '恭喜通过考试！' : '未通过考试，请继续努力');
  } catch (err) {
    try { await dbRun('ROLLBACK'); } catch (e) {}
    try { await dbRun('PRAGMA foreign_keys = ON'); } catch (e) {}
    console.error('提交考试错误:', err);
    error(res, '提交考试失败', 500);
  }
};

module.exports = {
  getList,
  getDetail,
  startExam,
  submitExam
};
