const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-safety-access-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-at-least-32-characters-long';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'StrongAdminPassword-2026!';
process.env.ADMIN_DISPLAY_NAME = '测试管理员';
process.env.DEFAULT_USER_PASSWORD = 'ChangeMe123!';
process.env.MAX_EXAM_ATTEMPTS = '3';
process.env.LAB_SAFETY_DB_PATH = path.join(testDirectory, 'lab_safety_test.db');

const {
  initDatabase,
  dbRun,
  dbGet,
  dbQuery,
  closeDatabase
} = require('../src/database/db');
const { createApp } = require('../src/app');
const { generateToken } = require('../src/middleware/auth');
const {
  hashPassword,
  verifyPassword,
  parseHash
} = require('../src/utils/password');
const {
  isAnswerCorrect,
  normalizeMultiAnswer
} = require('../src/controllers/examController');
const { matchesImageSignature } = require('../src/controllers/userController');
const { isPrivateAddress } = require('../src/controllers/secureLearningController');

let server;
let baseUrl;
let studentId;
let outsiderId;
let legacyId;
let examId;
let retryExamId;
let restrictedExamId;
let materialId;
let studentToken;
let outsiderToken;
let adminToken;
let successfulRecordId;

const request = async (
  pathname,
  {
    method = 'GET',
    token,
    body,
    headers = {}
  } = {}
) => {
  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: requestHeaders,
    body: body === undefined
      ? undefined
      : body instanceof FormData
        ? body
        : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = text;
    }
  }
  return { response, payload };
};

const seedUser = async ({ studentId: studentNumber, name, password, department, className }) => {
  const result = await dbRun(
    `INSERT INTO users
      (student_id, name, password, department, class, status)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [studentNumber, name, password, department, className]
  );
  return result.lastID;
};

const seedExam = async ({ name, totalScore, passScore, questionCount, department, className }) => {
  const result = await dbRun(
    `INSERT INTO exams
      (name, category, description, duration, total_score, pass_score, question_count, status)
     VALUES (?, '通用安全', '集成测试考试', 30, ?, ?, ?, 1)`,
    [name, totalScore, passScore, questionCount]
  );
  if (department !== undefined || className !== undefined) {
    await dbRun(
      'INSERT INTO exam_assignments (exam_id, department, class) VALUES (?, ?, ?)',
      [result.lastID, department || null, className || null]
    );
  }
  return result.lastID;
};

const seedQuestion = async ({ exam, content, type, options, answer, category = '通用安全' }) => {
  const result = await dbRun(
    `INSERT INTO questions
      (content, type, category, options, answer, analysis, exam_id)
     VALUES (?, ?, ?, ?, ?, '测试解析', ?)`,
    [content, type, category, JSON.stringify(options), answer, exam]
  );
  return result.lastID;
};

test.before(async () => {
  await initDatabase();

  const departmentResult = await dbRun('INSERT INTO departments (name) VALUES (?)', ['化学学院']);
  await dbRun(
    'INSERT INTO classes (department_id, name) VALUES (?, ?)',
    [departmentResult.lastID, '化学一班']
  );
  const physicsDepartment = await dbRun('INSERT INTO departments (name) VALUES (?)', ['物理学院']);
  await dbRun(
    'INSERT INTO classes (department_id, name) VALUES (?, ?)',
    [physicsDepartment.lastID, '物理一班']
  );

  const passwordHash = await hashPassword('StudentPass123!');
  studentId = await seedUser({
    studentId: '20260001',
    name: '测试学生',
    password: passwordHash,
    department: '化学学院',
    className: '化学一班'
  });
  outsiderId = await seedUser({
    studentId: '20260002',
    name: '范围外学生',
    password: passwordHash,
    department: '物理学院',
    className: '物理一班'
  });
  legacyId = await seedUser({
    studentId: '20260003',
    name: '旧密码学生',
    password: 'old123',
    department: '化学学院',
    className: '化学一班'
  });

  examId = await seedExam({
    name: '三题满分回归测试',
    totalScore: 100,
    passScore: 60,
    questionCount: 3,
    department: '化学学院',
    className: '化学一班'
  });
  await seedQuestion({
    exam: examId,
    content: '原始单选题内容',
    type: '单选题',
    options: ['选项A', '选项B'],
    answer: 'A'
  });
  await seedQuestion({
    exam: examId,
    content: '多选题内容',
    type: '多选题',
    options: ['A', 'B', 'C', 'D'],
    answer: 'AC'
  });
  await seedQuestion({
    exam: examId,
    content: '判断题内容',
    type: '判断题',
    options: ['正确', '错误'],
    answer: '正确'
  });

  retryExamId = await seedExam({
    name: '次数限制回归测试',
    totalScore: 100,
    passScore: 100,
    questionCount: 1,
    department: '化学学院',
    className: '化学一班'
  });
  await seedQuestion({
    exam: retryExamId,
    content: '次数限制题目',
    type: '单选题',
    options: ['A', 'B'],
    answer: 'A'
  });

  restrictedExamId = await seedExam({
    name: '发布范围回归测试',
    totalScore: 100,
    passScore: 60,
    questionCount: 1,
    department: '物理学院',
    className: '物理一班'
  });
  await seedQuestion({
    exam: restrictedExamId,
    content: '范围限制题目',
    type: '单选题',
    options: ['A', 'B'],
    answer: 'A'
  });

  const material = await dbRun(
    `INSERT INTO learning_materials
      (title, description, content, duration, category, order_num)
     VALUES ('测试资料', '测试', 'https://example.com/training.pdf', '10分钟', '通用安全', 1)`
  );
  materialId = material.lastID;
  await dbRun(
    `INSERT INTO banners (title, subtitle, color, order_num, status)
     VALUES ('测试轮播', '', '#0475FA', 1, 1)`
  );
  await dbRun(
    `INSERT INTO announcements (content, order_num, status)
     VALUES ('测试公告', 1, 1)`
  );

  studentToken = generateToken({
    id: studentId,
    username: '20260001',
    name: '测试学生',
    role: 'student'
  });
  outsiderToken = generateToken({
    id: outsiderId,
    username: '20260002',
    name: '范围外学生',
    role: 'student'
  });
  adminToken = generateToken({
    id: 'admin',
    username: 'admin',
    name: '测试管理员',
    role: 'admin'
  });

  const app = createApp();
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  await closeDatabase();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('health check verifies the database connection', async () => {
  const { response, payload } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(payload.data.status, 'healthy');
  assert.equal(payload.data.database, 'ready');
});

test('public banner and announcement routers are read-only', async () => {
  const bannerList = await request('/api/banner/list');
  assert.equal(bannerList.response.status, 200);
  assert.equal(bannerList.payload.data.length, 1);

  const publicBannerWrite = await request('/api/banner', {
    method: 'POST',
    body: { title: '越权创建' }
  });
  assert.equal(publicBannerWrite.response.status, 404);

  const publicAnnouncementWrite = await request('/api/announcement', {
    method: 'POST',
    body: { content: '越权公告' }
  });
  assert.equal(publicAnnouncementWrite.response.status, 404);

  const protectedAdminWrite = await request('/api/admin/banner', {
    method: 'POST',
    body: { title: '无令牌管理员请求' }
  });
  assert.equal(protectedAdminWrite.response.status, 401);
});

test('student cannot alter identity or exam-assignment fields', async () => {
  const forbidden = await request('/api/user/profile', {
    method: 'PUT',
    token: studentToken,
    body: { department: '物理学院', name: '伪造姓名' }
  });
  assert.equal(forbidden.response.status, 403);

  const allowed = await request('/api/user/profile', {
    method: 'PUT',
    token: studentToken,
    body: { phone: '+86 13800000000', email: 'student@example.edu' }
  });
  assert.equal(allowed.response.status, 200);
  assert.equal(allowed.payload.data.department, '化学学院');
  assert.equal(allowed.payload.data.email, 'student@example.edu');
});

test('exam detail, start, and submit all enforce publication scope', async () => {
  const detail = await request(`/api/exam/${restrictedExamId}`, { token: studentToken });
  assert.equal(detail.response.status, 403);

  const start = await request('/api/exam/start', {
    method: 'POST',
    token: studentToken,
    body: { examId: restrictedExamId }
  });
  assert.equal(start.response.status, 403);

  const submit = await request('/api/exam/submit', {
    method: 'POST',
    token: studentToken,
    body: { examId: restrictedExamId, answers: {} }
  });
  assert.equal(submit.response.status, 403);

  const allowedForOutsider = await request(`/api/exam/${restrictedExamId}`, {
    token: outsiderToken
  });
  assert.equal(allowedForOutsider.response.status, 200);
});

test('perfect answers on three questions produce the full 100 points', async () => {
  const start = await request('/api/exam/start', {
    method: 'POST',
    token: studentToken,
    body: { examId }
  });
  assert.equal(start.response.status, 200);
  assert.equal(start.payload.data.questions.length, 3);

  const questions = start.payload.data.questions;
  const answers = {
    [questions[0].id]: 'a',
    [questions[1].id]: ['C', 'A', 'A'],
    [questions[2].id]: '正确'
  };
  const submit = await request('/api/exam/submit', {
    method: 'POST',
    token: studentToken,
    body: { examId, answers, duration: '1分20秒' }
  });
  assert.equal(submit.response.status, 200);
  assert.equal(submit.payload.data.score, 100);
  assert.equal(submit.payload.data.correctCount, 3);
  assert.equal(submit.payload.data.passed, true);
  successfulRecordId = submit.payload.data.recordId;

  const certificateCount = await dbGet(
    'SELECT COUNT(*) AS count FROM certificates WHERE user_id = ? AND exam_id = ? AND status = 1',
    [studentId, examId]
  );
  assert.equal(certificateCount.count, 1);
});

test('record detail remains stable after the question bank is edited', async () => {
  const originalQuestion = await dbGet(
    'SELECT id FROM questions WHERE exam_id = ? ORDER BY id ASC LIMIT 1',
    [examId]
  );
  await dbRun(
    `UPDATE questions
        SET content = '后来修改的内容', answer = 'B'
      WHERE id = ?`,
    [originalQuestion.id]
  );

  const detail = await request(`/api/records/${successfulRecordId}`, {
    token: studentToken
  });
  assert.equal(detail.response.status, 200);
  const snapshotQuestion = detail.payload.data.questions.find(
    (question) => question.id === originalQuestion.id
  );
  assert.equal(snapshotQuestion.content, '原始单选题内容');
  assert.equal(snapshotQuestion.correctAnswer, 'A');
  assert.equal(snapshotQuestion.isCorrect, true);

  const repeatSubmit = await request('/api/exam/submit', {
    method: 'POST',
    token: studentToken,
    body: { examId, answers: { [originalQuestion.id]: 'B' } }
  });
  assert.equal(repeatSubmit.response.status, 409);
});

test('failed attempts are capped at the configured maximum', async () => {
  const question = await dbGet(
    'SELECT id FROM questions WHERE exam_id = ? LIMIT 1',
    [retryExamId]
  );

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await request('/api/exam/submit', {
      method: 'POST',
      token: studentToken,
      body: {
        examId: retryExamId,
        answers: { [question.id]: 'B' },
        duration: '10秒'
      }
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.data.passed, false);
    assert.equal(result.payload.data.attempts, attempt);
  }

  const fourth = await request('/api/exam/submit', {
    method: 'POST',
    token: studentToken,
    body: { examId: retryExamId, answers: { [question.id]: 'B' } }
  });
  assert.equal(fourth.response.status, 409);
  assert.match(fourth.payload.message, /最大考试次数/);
});

test('learning progress is monotonic and study duration is validated', async () => {
  const firstProgress = await request('/api/learning/progress', {
    method: 'POST',
    token: studentToken,
    body: { id: materialId, progress: 60 }
  });
  assert.equal(firstProgress.response.status, 200);
  assert.equal(firstProgress.payload.data.progress, 60);

  const lowerProgress = await request('/api/learning/progress', {
    method: 'POST',
    token: studentToken,
    body: { id: materialId, progress: 20 }
  });
  assert.equal(lowerProgress.response.status, 200);
  assert.equal(lowerProgress.payload.data.progress, 60);

  const invalidProgress = await request('/api/learning/progress', {
    method: 'POST',
    token: studentToken,
    body: { id: materialId, progress: 101 }
  });
  assert.equal(invalidProgress.response.status, 400);

  const firstDuration = await request('/api/learning/duration', {
    method: 'POST',
    token: studentToken,
    body: { id: materialId, duration: 10 }
  });
  assert.equal(firstDuration.payload.data.duration, 10);

  const secondDuration = await request('/api/learning/duration', {
    method: 'POST',
    token: studentToken,
    body: { id: materialId, duration: 5 }
  });
  assert.equal(secondDuration.payload.data.duration, 15);

  const invalidDuration = await request('/api/learning/duration', {
    method: 'POST',
    token: studentToken,
    body: { id: materialId, duration: -1 }
  });
  assert.equal(invalidDuration.response.status, 400);
});

test('PDF proxy rejects URLs not registered as learning materials before networking', async () => {
  const result = await request(
    `/api/learning/proxy-pdf?url=${encodeURIComponent('http://127.0.0.1/private.pdf')}`,
    { token: studentToken }
  );
  assert.equal(result.response.status, 403);
});

test('legacy plaintext passwords are upgraded after a successful login', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username: '20260003', password: 'old123' }
  });
  assert.equal(login.response.status, 200);
  const user = await dbGet('SELECT password FROM users WHERE id = ?', [legacyId]);
  assert.ok(user.password.startsWith('scrypt$'));
  assert.equal(await verifyPassword('old123', user.password), true);
});

test('administrator exam validation and exports are functional', async () => {
  const adminLogin = await request('/api/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: 'StrongAdminPassword-2026!' }
  });
  assert.equal(adminLogin.response.status, 200);

  const invalidExam = await request('/api/admin/exams', {
    method: 'POST',
    token: adminToken,
    body: {
      name: '无效考试',
      duration: 30,
      totalScore: 100,
      passScore: 101,
      questionCount: 0
    }
  });
  assert.equal(invalidExam.response.status, 400);

  const validDraft = await request('/api/admin/exams', {
    method: 'POST',
    token: adminToken,
    body: {
      name: '待配置考试',
      category: '通用安全',
      description: '',
      duration: 30,
      totalScore: 100,
      passScore: 60,
      questionCount: 0
    }
  });
  assert.equal(validDraft.response.status, 200);

  const publishEmpty = await request(`/api/admin/exams/${validDraft.payload.data.id}/status`, {
    method: 'PUT',
    token: adminToken
  });
  assert.equal(publishEmpty.response.status, 409);

  const recordExport = await request('/api/admin/records/export', { token: adminToken });
  assert.equal(recordExport.response.status, 200);
  assert.ok(recordExport.payload.data.base64.length > 100);
  assert.ok(recordExport.payload.data.rowCount >= 4);

  const certificateExport = await request('/api/admin/certificates/export', { token: adminToken });
  assert.equal(certificateExport.response.status, 200);
  assert.ok(certificateExport.payload.data.base64.length > 100);
  assert.equal(certificateExport.payload.data.rowCount, 1);
});

test('focused security and normalization helpers reject malformed values', async () => {
  assert.deepEqual(normalizeMultiAnswer(['c', 'A', 'a']), ['A', 'C']);
  assert.equal(isAnswerCorrect('多选题', ['C', 'A'], 'AC'), true);
  assert.equal(isAnswerCorrect('单选题', 'a', 'A'), true);

  assert.equal(parseHash('scrypt$bad$not-hex'), null);
  assert.equal(await verifyPassword('anything', 'scrypt$bad$not-hex'), false);

  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('10.0.0.1'), true);
  assert.equal(isPrivateAddress('169.254.169.254'), true);
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('::1'), true);

  assert.equal(matchesImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'), true);
  assert.equal(matchesImageSignature(Buffer.from('not-an-image'), 'image/jpeg'), false);
});

test('database has no foreign-key violations after the tested workflows', async () => {
  const issues = await dbQuery('PRAGMA foreign_key_check');
  assert.deepEqual(issues, []);
});
