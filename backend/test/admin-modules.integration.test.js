const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-safety-admin-modules-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'admin-modules-test-secret-at-least-32-characters';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'StrongAdminPassword-2026!';
process.env.DEFAULT_USER_PASSWORD = 'ChangeMe123!';
process.env.LAB_SAFETY_DB_PATH = path.join(testDirectory, 'admin-modules.db');

const {
  initDatabase,
  dbRun,
  dbGet,
  dbQuery,
  closeDatabase
} = require('../src/database/db');
const { createApp } = require('../src/app');
const { generateToken } = require('../src/middleware/auth');
const { hashPassword } = require('../src/utils/password');

let server;
let baseUrl;
let adminToken;
let departmentId;
let classId;
let userId;
let examId;
let recordId;

const request = async (pathname, { method = 'GET', body } = {}) => {
  const headers = { Authorization: `Bearer ${adminToken}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_) {
    payload = text;
  }
  return { response, payload };
};

test.before(async () => {
  await initDatabase();
  const department = await dbRun('INSERT INTO departments(name) VALUES (?)', ['测试学院']);
  departmentId = department.lastID;
  const classRow = await dbRun(
    'INSERT INTO classes(department_id, name) VALUES (?, ?)',
    [departmentId, '测试一班']
  );
  classId = classRow.lastID;

  const user = await dbRun(
    `INSERT INTO users(student_id, name, password, department, class, status)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [
      'admin-module-user',
      '管理测试学生',
      await hashPassword('StudentPass123!'),
      '测试学院',
      '测试一班'
    ]
  );
  userId = user.lastID;

  const exam = await dbRun(
    `INSERT INTO exams
      (name, category, description, duration, total_score, pass_score, question_count, status)
     VALUES ('管理模块考试', '通用安全', '', 30, 100, 60, 1, 1)`
  );
  examId = exam.lastID;
  await dbRun(
    'INSERT INTO exam_assignments(exam_id, department, class) VALUES (?, ?, ?)',
    [examId, '测试学院', '测试一班']
  );
  const question = await dbRun(
    `INSERT INTO questions(content, type, category, options, answer, analysis, exam_id)
     VALUES ('快照题目', '单选题', '通用安全', ?, 'A', '快照解析', ?)`,
    [JSON.stringify(['正确选项', '错误选项']), examId]
  );
  const answerDetails = {
    [question.lastID]: {
      userAnswer: 'A',
      correctAnswer: 'A',
      isCorrect: true,
      snapshot: {
        content: '快照题目',
        type: '单选题',
        category: '通用安全',
        options: ['正确选项', '错误选项'],
        analysis: '快照解析'
      }
    }
  };
  const record = await dbRun(
    `INSERT INTO exam_records
      (user_id, exam_id, score, status, duration, answers, wrong_questions)
     VALUES (?, ?, 100, '通过', '5分', ?, '[]')`,
    [userId, examId, JSON.stringify(answerDetails)]
  );
  recordId = record.lastID;

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

test('split dashboard and user controllers retain compatible responses', async () => {
  const dashboard = await request('/api/admin/dashboard/stats');
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.payload.data.userCount, 1);
  assert.equal(dashboard.payload.data.examCount, 1);

  const users = await request('/api/admin/users?page=1&pageSize=10');
  assert.equal(users.response.status, 200);
  assert.equal(users.payload.data.total, 1);
  assert.equal(users.payload.data.list[0].studentId, 'admin-module-user');

  const invalidOrganization = await request(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: { department: '不存在学院', class: '不存在班级' }
  });
  assert.equal(invalidOrganization.response.status, 400);
});

test('organization renames propagate to users and exam assignments', async () => {
  const renameDepartment = await request(`/api/admin/departments/${departmentId}`, {
    method: 'PUT',
    body: { name: '重命名学院' }
  });
  assert.equal(renameDepartment.response.status, 200);

  const renameClass = await request(`/api/admin/classes/${classId}`, {
    method: 'PUT',
    body: { departmentId, name: '重命名一班' }
  });
  assert.equal(renameClass.response.status, 200);

  const user = await dbGet('SELECT department, class FROM users WHERE id = ?', [userId]);
  assert.deepEqual(user, { department: '重命名学院', class: '重命名一班' });
  const assignment = await dbGet(
    'SELECT department, class FROM exam_assignments WHERE exam_id = ?',
    [examId]
  );
  assert.deepEqual(assignment, { department: '重命名学院', class: '重命名一班' });

  const deleteInUseClass = await request(`/api/admin/classes/${classId}`, { method: 'DELETE' });
  assert.equal(deleteInUseClass.response.status, 409);
  const deleteInUseDepartment = await request(`/api/admin/departments/${departmentId}`, { method: 'DELETE' });
  assert.equal(deleteInUseDepartment.response.status, 409);
});

test('settings accept only validated known fields', async () => {
  const initial = await request('/api/admin/settings');
  assert.equal(initial.response.status, 200);
  assert.equal(initial.payload.data.security.passwordMinLength, 8);

  const update = await request('/api/admin/settings', {
    method: 'PUT',
    body: {
      type: 'security',
      data: {
        loginAttempts: 6,
        lockDuration: 45,
        passwordMinLength: 12,
        passwordComplexity: true,
        sessionTimeout: 90
      }
    }
  });
  assert.equal(update.response.status, 200);
  assert.equal(update.payload.data.passwordMinLength, 12);

  const invalid = await request('/api/admin/settings', {
    method: 'PUT',
    body: { type: 'basic', data: { siteName: '新站点', arbitrary: 'forbidden' } }
  });
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.payload.message, /不支持的设置字段/);
});

test('question CRUD validates data and synchronizes exam counts', async () => {
  const created = await request('/api/admin/questions', {
    method: 'POST',
    body: {
      content: '新建判断题',
      type: '判断题',
      category: '通用安全',
      options: ['正确', '错误'],
      answer: '正确',
      analysis: '新建解析',
      examId
    }
  });
  assert.equal(created.response.status, 200);
  const questionId = created.payload.data.id;

  const countAfterCreate = await dbGet('SELECT question_count AS count FROM exams WHERE id = ?', [examId]);
  assert.equal(countAfterCreate.count, 2);

  const invalid = await request(`/api/admin/questions/${questionId}`, {
    method: 'PUT',
    body: { type: '单选题', options: ['A', 'B'], answer: 'AB' }
  });
  assert.equal(invalid.response.status, 400);

  const updated = await request(`/api/admin/questions/${questionId}`, {
    method: 'PUT',
    body: {
      content: '更新后的单选题',
      type: '单选题',
      category: '通用安全',
      options: ['选项一', '选项二'],
      answer: 'B',
      analysis: '更新解析',
      examId: null
    }
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.data.examId, null);

  const countAfterRelease = await dbGet('SELECT question_count AS count FROM exams WHERE id = ?', [examId]);
  assert.equal(countAfterRelease.count, 1);
});

test('administrator record detail uses immutable question snapshots', async () => {
  await dbRun(
    "UPDATE questions SET content = '后来修改的题目', answer = 'B' WHERE exam_id = ?",
    [examId]
  );
  const detail = await request(`/api/admin/records/${recordId}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload.data.questions[0].content, '快照题目');
  assert.equal(detail.payload.data.questions[0].correctAnswer, 'A');
});

test('certificate issuance, duplicate protection, revoke, and reissue are consistent', async () => {
  const belowPass = await request('/api/admin/certificates', {
    method: 'POST',
    body: { userId, examId, score: 59 }
  });
  assert.equal(belowPass.response.status, 400);

  const issued = await request('/api/admin/certificates', {
    method: 'POST',
    body: { userId, examId, score: 95, grade: '优秀' }
  });
  assert.equal(issued.response.status, 200);
  assert.match(issued.payload.data.certificateNo, /^UCAS-LS-\d{4}-[A-F0-9]{16}$/);
  const certificateId = issued.payload.data.id;

  const duplicate = await request('/api/admin/certificates', {
    method: 'POST',
    body: { userId, examId, score: 95 }
  });
  assert.equal(duplicate.response.status, 409);

  const revoked = await request(`/api/admin/certificates/${certificateId}/revoke`, {
    method: 'PUT'
  });
  assert.equal(revoked.response.status, 200);
  assert.equal(revoked.payload.data.status, 0);

  const reissued = await request(`/api/admin/certificates/${certificateId}/reissue`, {
    method: 'PUT'
  });
  assert.equal(reissued.response.status, 200);
  assert.equal(reissued.payload.data.status, 1);

  const list = await request('/api/admin/certificates?page=1&pageSize=10');
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.data.total, 1);
});

test('all split administrator operations preserve foreign-key integrity and audit trails', async () => {
  const foreignKeyIssues = await dbQuery('PRAGMA foreign_key_check');
  assert.deepEqual(foreignKeyIssues, []);
  const auditCount = await dbGet('SELECT COUNT(*) AS count FROM operation_audit_logs');
  assert.ok(Number(auditCount.count) >= 5);
});
