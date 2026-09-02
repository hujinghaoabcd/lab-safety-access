const {
  dbGet,
  dbQuery,
  dbRun,
  closeDatabase
} = require('../database/db');

const API_BASE = String(process.env.TEST_API_BASE || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const EXAM_NAME = process.env.TEST_EXAM_NAME || '考试测试';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'Test123456';
const SHOULD_RESET = process.argv.includes('--reset');

const TEST_USERS = [
  { studentId: 'TEST006', label: '测试满分', mode: 'full' },
  { studentId: 'TEST001', label: '测试优秀', mode: 'excellent' },
  { studentId: 'TEST002', label: '测试良好', mode: 'good' },
  { studentId: 'TEST003', label: '测试及格', mode: 'pass' },
  { studentId: 'TEST004', label: '测试未通过', mode: 'fail' },
  { studentId: 'TEST005', label: '测试重考', mode: 'retry' }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scoreForCorrectCount = (correctCount, questionCount, totalScore) => Math.min(
  Number(totalScore),
  Math.round((correctCount / questionCount) * Number(totalScore))
);

const allScoreCandidates = (questionCount, totalScore) => {
  const rows = [];
  for (let correctCount = 0; correctCount <= questionCount; correctCount += 1) {
    rows.push({
      correctCount,
      score: scoreForCorrectCount(correctCount, questionCount, totalScore)
    });
  }
  return rows;
};

const closestCandidate = (candidates, targetScore) => [...candidates].sort((a, b) => {
  const diff = Math.abs(a.score - targetScore) - Math.abs(b.score - targetScore);
  if (diff !== 0) return diff;
  return a.correctCount - b.correctCount;
})[0];

const chooseCandidate = ({ mode, questionCount, totalScore, passScore, retryAttempt = 1 }) => {
  const candidates = allScoreCandidates(questionCount, totalScore);

  if (mode === 'full') {
    return candidates[candidates.length - 1];
  }

  if (mode === 'excellent') {
    return closestCandidate(candidates, Math.round(totalScore * 0.90));
  }

  if (mode === 'good') {
    return closestCandidate(candidates, Math.round(totalScore * 0.80));
  }

  if (mode === 'pass') {
    const passing = candidates.filter((item) => item.score >= passScore);
    return passing[0] || candidates[candidates.length - 1];
  }

  if (mode === 'fail') {
    const failing = candidates.filter((item) => item.score < passScore);
    return failing[failing.length - 1] || candidates[0];
  }

  if (mode === 'retry') {
    const target = retryAttempt === 1
      ? Math.max(0, passScore - Math.round(totalScore * 0.10))
      : Math.max(passScore, Math.round(totalScore * 0.70));
    return closestCandidate(candidates, target);
  }

  throw new Error(`未知测试模式: ${mode}`);
};

const apiRequest = async (path, { method = 'GET', body, cookie } = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.code !== 0) {
    const message = payload?.message || `${response.status} ${response.statusText}`;
    throw new Error(`${method} ${path} 失败: ${message}`);
  }

  return { payload, response };
};

const login = async (studentId) => {
  const { response } = await apiRequest('/auth/login', {
    method: 'POST',
    body: { username: studentId, password: TEST_PASSWORD }
  });

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error(`${studentId} 登录成功但没有收到会话 Cookie`);
  return setCookie.split(';')[0];
};

const resetTestData = async (examId, testUsers) => {
  console.log('\n[reset] 清理该考试下测试账号的历史记录、错题和证书...');
  for (const user of testUsers) {
    await dbRun(
      `DELETE FROM wrong_questions
        WHERE user_id = ?
          AND question_id IN (SELECT id FROM questions WHERE exam_id = ?)`,
      [user.id, examId]
    );
    await dbRun('DELETE FROM certificates WHERE user_id = ? AND exam_id = ?', [user.id, examId]);
    await dbRun('DELETE FROM exam_records WHERE user_id = ? AND exam_id = ?', [user.id, examId]);
  }
  console.log('[reset] 完成。');
};

const buildAnswers = (startedQuestions, correctAnswers, correctCount) => {
  const answers = {};
  startedQuestions.forEach((question, index) => {
    const correctAnswer = correctAnswers.get(Number(question.id));
    if (correctAnswer === undefined || correctAnswer === null || String(correctAnswer).trim() === '') {
      throw new Error(`题目 ${question.id} 缺少正确答案，无法自动模拟`);
    }
    answers[question.id] = index < correctCount ? correctAnswer : '__AUTO_TEST_WRONG__';
  });
  return answers;
};

const submitAttempt = async ({ cookie, exam, correctAnswers, mode, retryAttempt = 1 }) => {
  const start = await apiRequest('/exam/start', {
    method: 'POST',
    cookie,
    body: { examId: exam.id }
  });

  const startedQuestions = start.payload.data?.questions || [];
  const examInfo = start.payload.data?.exam || {};
  if (!startedQuestions.length) throw new Error('考试没有题目');

  const candidate = chooseCandidate({
    mode,
    retryAttempt,
    questionCount: startedQuestions.length,
    totalScore: Number(examInfo.totalScore),
    passScore: Number(examInfo.passScore)
  });

  const answers = buildAnswers(startedQuestions, correctAnswers, candidate.correctCount);
  const submit = await apiRequest('/exam/submit', {
    method: 'POST',
    cookie,
    body: {
      examId: exam.id,
      answers,
      duration: retryAttempt === 1 ? '2分30秒' : '1分45秒'
    }
  });

  return {
    plannedCorrect: candidate.correctCount,
    plannedScore: candidate.score,
    ...submit.payload.data
  };
};

const verifyExamVisible = async (cookie, examId, studentId) => {
  const list = await apiRequest('/exam/list', { cookie });
  const visible = (list.payload.data || []).find((item) => Number(item.id) === Number(examId));
  if (!visible) {
    throw new Error(`${studentId} 看不到“${EXAM_NAME}”，请检查发布范围是否包含该用户的院系/班级`);
  }
  return visible;
};

const main = async () => {
  console.log('=== 实验室安全考试自动成绩模拟 ===');
  console.log(`考试: ${EXAM_NAME}`);
  console.log(`API: ${API_BASE}`);
  console.log(`清理旧测试数据: ${SHOULD_RESET ? '是' : '否'}`);

  const exam = await dbGet(
    `SELECT id, name, total_score AS totalScore, pass_score AS passScore, status
       FROM exams
      WHERE name = ?
      ORDER BY id DESC
      LIMIT 1`,
    [EXAM_NAME]
  );
  if (!exam) throw new Error(`找不到考试“${EXAM_NAME}”`);
  if (Number(exam.status) !== 1) throw new Error(`考试“${EXAM_NAME}”尚未发布`);

  const questions = await dbQuery(
    'SELECT id, answer FROM questions WHERE exam_id = ? ORDER BY id ASC',
    [exam.id]
  );
  if (!questions.length) throw new Error(`考试“${EXAM_NAME}”尚未配置题目`);
  const correctAnswers = new Map(questions.map((item) => [Number(item.id), item.answer]));

  const testUsers = [];
  for (const spec of TEST_USERS) {
    const user = await dbGet(
      `SELECT id, student_id AS studentId, name, department, class
         FROM users
        WHERE student_id = ? AND status = 1`,
      [spec.studentId]
    );
    if (!user) {
      throw new Error(`测试账号 ${spec.studentId} 不存在。请先导入测试用户文件。`);
    }
    testUsers.push({ ...spec, ...user });
  }

  if (SHOULD_RESET) {
    await resetTestData(exam.id, testUsers);
  }

  const summary = [];

  for (const user of testUsers) {
    console.log(`\n[${user.studentId}] ${user.label}：登录中...`);
    const cookie = await login(user.studentId);
    const visible = await verifyExamVisible(cookie, exam.id, user.studentId);
    console.log(`  发布范围检查通过，当前已考 ${visible.attempts || 0} 次。`);

    if (user.mode === 'retry') {
      const first = await submitAttempt({
        cookie,
        exam,
        correctAnswers,
        mode: 'retry',
        retryAttempt: 1
      });
      console.log(`  第1次：${first.score} 分，${first.passed ? '通过' : '未通过'}（答对 ${first.correctCount}/${questions.length}）`);

      await sleep(100);

      const second = await submitAttempt({
        cookie,
        exam,
        correctAnswers,
        mode: 'retry',
        retryAttempt: 2
      });
      console.log(`  第2次：${second.score} 分，${second.passed ? '通过' : '未通过'}（答对 ${second.correctCount}/${questions.length}）`);
      summary.push({
        studentId: user.studentId,
        name: user.name,
        result: `${first.score}→${second.score}`,
        status: second.passed ? '最终通过' : '最终未通过'
      });
    } else {
      const result = await submitAttempt({
        cookie,
        exam,
        correctAnswers,
        mode: user.mode
      });
      console.log(`  成绩：${result.score} 分，${result.passed ? '通过' : '未通过'}（答对 ${result.correctCount}/${questions.length}）`);
      summary.push({
        studentId: user.studentId,
        name: user.name,
        result: String(result.score),
        status: result.passed ? '通过' : '未通过'
      });
    }
  }

  console.log('\n=== 模拟完成 ===');
  console.table(summary);

  const verificationRows = await dbQuery(
    `SELECT
       u.student_id AS studentId,
       u.name,
       er.score,
       er.status,
       er.submit_time AS submitTime,
       c.grade AS certificateGrade,
       c.certificate_no AS certificateNo
     FROM users u
     LEFT JOIN exam_records er ON er.user_id = u.id AND er.exam_id = ?
     LEFT JOIN certificates c ON c.user_id = u.id AND c.exam_id = ? AND c.status = 1
     WHERE u.student_id IN (${TEST_USERS.map(() => '?').join(',')})
     ORDER BY u.student_id, er.id`,
    [exam.id, exam.id, ...TEST_USERS.map((item) => item.studentId)]
  );

  console.log('\n=== 数据库验收结果 ===');
  console.table(verificationRows);
  console.log('\n现在可以直接去后台“考试记录 / 证书管理”查看这些结果，无需人工答题。');
};

main()
  .catch((err) => {
    console.error(`\n[失败] ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeDatabase();
    } catch (_) {}
  });
