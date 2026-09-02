const crypto = require('crypto');
const { dbQuery, dbGet, withTransaction } = require('../database/db');
const { success, error } = require('../utils/response');
const { formatAppDate, utcDateTimeNow } = require('../utils/time');
const {
  ExamAccessError,
  getMaxExamAttempts,
  assertExamAvailable
} = require('../services/examAccess');

const safeParseOptions = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const normalizeScalarAnswer = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return /^[a-z]+$/i.test(text) ? text.toUpperCase() : text;
};

const normalizeMultiAnswer = (value) => {
  let items = [];

  if (Array.isArray(value)) {
    items = value;
  } else if (value !== null && value !== undefined) {
    const text = String(value).trim();
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) items = parsed;
      } catch (_) {
        items = [];
      }
    }
    if (!items.length) {
      if (/^[a-z]+$/i.test(text)) items = text.split('');
      else items = text.split(/[\s,，、;；|]+/);
    }
  }

  return [...new Set(items
    .map(normalizeScalarAnswer)
    .filter(Boolean))]
    .sort();
};

const isAnswerCorrect = (type, userAnswer, correctAnswer) => {
  if (type === '多选题') {
    return JSON.stringify(normalizeMultiAnswer(userAnswer))
      === JSON.stringify(normalizeMultiAnswer(correctAnswer));
  }
  return normalizeScalarAnswer(userAnswer) === normalizeScalarAnswer(correctAnswer);
};

const normalizeDuration = (duration) => {
  if (duration === null || duration === undefined || duration === '') return '0分0秒';
  const text = String(duration).trim();
  return text.slice(0, 64) || '0分0秒';
};

const handleControllerError = (res, err, fallbackMessage) => {
  if (err instanceof ExamAccessError) {
    return error(res, err.message, err.statusCode);
  }
  console.error(fallbackMessage, err);
  return error(res, fallbackMessage, 500);
};

/**
 * Return only published exams that match the student's department/class.
 */
const getList = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await dbGet(
      'SELECT id, department, class FROM users WHERE id = ? AND status = 1',
      [userId]
    );
    if (!user) return error(res, '用户不存在或已被禁用', 401);

    const maxAttempts = getMaxExamAttempts();
    const exams = await dbQuery(
      `SELECT
         e.*,
         (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS actual_question_count,
         (SELECT COUNT(*) FROM exam_records er
           WHERE er.user_id = ? AND er.exam_id = e.id) AS attempts,
         (SELECT COUNT(*) FROM exam_records er
           WHERE er.user_id = ? AND er.exam_id = e.id AND er.status = '通过') AS passed_count
       FROM exams e
       WHERE e.status = 1
         AND (
           NOT EXISTS (SELECT 1 FROM exam_assignments a WHERE a.exam_id = e.id)
           OR EXISTS (
             SELECT 1 FROM exam_assignments a
              WHERE a.exam_id = e.id
                AND (a.department IS NULL OR a.department = '' OR a.department = ?)
                AND (a.class IS NULL OR a.class = '' OR a.class = ?)
           )
         )
       ORDER BY e.created_at DESC`,
      [userId, userId, user.department || '', user.class || '']
    );

    const list = exams.map((exam) => {
      const attempts = Number(exam.attempts || 0);
      const passed = Number(exam.passed_count || 0) > 0;
      let status = 'available';
      if (passed) status = 'passed';
      else if (attempts >= maxAttempts) status = 'not_available';

      return {
        id: exam.id,
        name: exam.name,
        category: exam.category || '',
        description: exam.description,
        duration: exam.duration,
        totalScore: exam.total_score,
        passScore: exam.pass_score,
        questionCount: Number(exam.actual_question_count || 0),
        maxAttempts,
        attempts,
        status
      };
    });

    return success(res, list, '获取成功');
  } catch (err) {
    return handleControllerError(res, err, '获取考试列表失败');
  }
};

const getDetail = async (req, res) => {
  try {
    const exam = await assertExamAvailable(
      { get: dbGet },
      req.user.id,
      req.params.id,
      { enforceAttempts: false, allowAfterPass: true }
    );
    const questionCount = await dbGet(
      'SELECT COUNT(*) AS count FROM questions WHERE exam_id = ?',
      [exam.id]
    );

    return success(res, {
      id: exam.id,
      name: exam.name,
      category: exam.category || '',
      description: exam.description,
      duration: exam.duration,
      totalScore: exam.total_score,
      passScore: exam.pass_score,
      questionCount: Number(questionCount.count || 0),
      maxAttempts: getMaxExamAttempts(),
      attempts: exam.attempts,
      passed: exam.passed
    }, '获取成功');
  } catch (err) {
    return handleControllerError(res, err, '获取考试详情失败');
  }
};

const startExam = async (req, res) => {
  try {
    const examId = req.body && req.body.examId;
    const exam = await assertExamAvailable({ get: dbGet }, req.user.id, examId);
    const rows = await dbQuery(
      `SELECT id, content, type, category, options
         FROM questions
        WHERE exam_id = ?
        ORDER BY id ASC`,
      [exam.id]
    );

    if (!rows.length) return error(res, '该考试尚未配置题目', 409);

    return success(res, {
      exam: {
        id: exam.id,
        name: exam.name,
        duration: exam.duration,
        totalScore: exam.total_score,
        passScore: exam.pass_score,
        questionCount: rows.length,
        attemptNumber: exam.attempts + 1,
        maxAttempts: getMaxExamAttempts()
      },
      questions: rows.map((question) => ({
        id: question.id,
        content: question.content,
        type: question.type,
        category: question.category,
        options: safeParseOptions(question.options)
      }))
    }, '考试开始');
  } catch (err) {
    return handleControllerError(res, err, '开始考试失败');
  }
};

const submitExam = async (req, res) => {
  const body = req.body || {};
  if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) {
    return error(res, '答案格式无效', 400);
  }

  try {
    const result = await withTransaction(async (tx) => {
      const exam = await assertExamAvailable(tx, req.user.id, body.examId);
      const questions = await tx.query(
        `SELECT id, content, type, category, options, answer, analysis
           FROM questions
          WHERE exam_id = ?
          ORDER BY id ASC`,
        [exam.id]
      );

      if (!questions.length) {
        throw new ExamAccessError('该考试尚未配置题目', 409);
      }

      let correctCount = 0;
      const wrongQuestionIds = [];
      const answerDetails = {};

      for (const question of questions) {
        const userAnswer = body.answers[question.id] ?? body.answers[String(question.id)];
        const correct = isAnswerCorrect(question.type, userAnswer, question.answer);
        if (correct) correctCount += 1;
        else wrongQuestionIds.push(question.id);

        answerDetails[question.id] = {
          userAnswer: userAnswer ?? null,
          correctAnswer: question.answer,
          isCorrect: correct,
          snapshot: {
            content: question.content,
            type: question.type,
            category: question.category,
            options: safeParseOptions(question.options),
            analysis: question.analysis || null
          }
        };
      }

      const score = Math.min(
        Number(exam.total_score),
        Math.round((correctCount / questions.length) * Number(exam.total_score))
      );
      const wrongCount = questions.length - correctCount;
      const passed = score >= Number(exam.pass_score);
      const status = passed ? '通过' : '未通过';
      // 数据库存 UTC，API 输出层统一转换为 Asia/Shanghai。
      const submitTime = utcDateTimeNow();

      const insertResult = await tx.run(
        `INSERT INTO exam_records
          (user_id, exam_id, score, status, duration, answers, wrong_questions, submit_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          exam.id,
          score,
          status,
          normalizeDuration(body.duration),
          JSON.stringify(answerDetails),
          JSON.stringify(wrongQuestionIds),
          submitTime
        ]
      );

      if (passed) {
        const existingCertificate = await tx.get(
          'SELECT id FROM certificates WHERE user_id = ? AND exam_id = ? AND status = 1',
          [req.user.id, exam.id]
        );

        if (!existingCertificate) {
          const percentage = Number(exam.total_score) > 0
            ? (score / Number(exam.total_score)) * 100
            : 0;
          const grade = percentage >= 90 ? '优秀' : percentage >= 80 ? '良好' : '及格';
          const issueDate = formatAppDate();
          const year = issueDate.slice(0, 4);
          const certificateNo = `UCAS-LS-${year}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

          await tx.run(
            `INSERT INTO certificates
              (certificate_no, user_id, exam_id, exam_name, score, grade, issue_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [certificateNo, req.user.id, exam.id, exam.name, score, grade, issueDate]
          );
        }
      }

      for (const questionId of wrongQuestionIds) {
        await tx.run(
          `INSERT INTO wrong_questions
            (user_id, question_id, user_answer, exam_record_id)
           VALUES (?, ?, ?, ?)`,
          [
            req.user.id,
            questionId,
            JSON.stringify(answerDetails[questionId].userAnswer),
            insertResult.lastID
          ]
        );
      }

      return {
        recordId: insertResult.lastID,
        score,
        totalScore: Number(exam.total_score),
        passed,
        correctCount,
        wrongCount,
        attempts: exam.attempts + 1,
        maxAttempts: getMaxExamAttempts()
      };
    });

    return success(
      res,
      result,
      result.passed ? '恭喜通过考试！' : '未通过考试，请继续努力'
    );
  } catch (err) {
    return handleControllerError(res, err, '提交考试失败');
  }
};

module.exports = {
  getList,
  getDetail,
  startExam,
  submitExam,
  // Exported for focused unit tests.
  normalizeMultiAnswer,
  isAnswerCorrect
};
