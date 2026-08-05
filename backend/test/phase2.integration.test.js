const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-safety-phase2-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase2-test-secret-at-least-32-characters-long';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'StrongAdminPassword-2026!';
process.env.DEFAULT_USER_PASSWORD = 'ChangeMe123!';
process.env.LAB_SAFETY_DB_PATH = path.join(testDirectory, 'phase2.db');
process.env.DB_BACKUP_RETENTION = '3';

const {
  initDatabase,
  getMigrationStatus,
  createDatabaseBackup,
  verifyDatabaseFile,
  dbRun,
  dbGet,
  dbQuery,
  closeDatabase,
  BACKUP_DIR
} = require('../src/database/db');
const { createApp } = require('../src/app');
const { generateToken } = require('../src/middleware/auth');
const { verifyPassword } = require('../src/utils/password');

let server;
let baseUrl;
let adminToken;
let userId;

const request = async (
  pathname,
  { method = 'GET', token, body, headers = {} } = {}
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

const workbookForm = async (sheetName, headers, rows, customize) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.addRow(headers);
  for (const row of rows) worksheet.addRow(row);
  if (customize) customize(worksheet);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const form = new FormData();
  form.append(
    'file',
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }),
    `${sheetName}.xlsx`
  );
  return form;
};

test.before(async () => {
  await initDatabase();
  const department = await dbRun('INSERT INTO departments(name) VALUES (?)', ['化学学院']);
  await dbRun(
    'INSERT INTO classes(department_id, name) VALUES (?, ?)',
    [department.lastID, '化学一班']
  );

  const user = await dbRun(
    `INSERT INTO users(student_id, name, password, department, class, status)
     VALUES ('phase2-existing', '现有学生', 'legacy-password', '化学学院', '化学一班', 1)`
  );
  userId = user.lastID;

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

test('ordered migrations are applied exactly once', async () => {
  const first = await getMigrationStatus();
  assert.deepEqual(first.pending, []);
  assert.deepEqual(first.applied.map((item) => item.version), [1, 2, 3]);

  await initDatabase();
  const second = await getMigrationStatus();
  assert.deepEqual(second.pending, []);
  assert.equal(second.applied.length, 3);
});

test('database backup is verified, hashed, retained, and downloadable', async () => {
  const backup = await createDatabaseBackup({ reason: 'phase2_test' });
  assert.match(backup.filename, /^lab_safety_phase2_test_\d{8}T\d{6}Z_[a-f0-9]{8}\.db$/);
  assert.equal(fs.existsSync(backup.path), true);
  assert.equal(fs.existsSync(`${backup.path}.sha256`), true);
  assert.equal(backup.sha256.length, 64);

  const verification = await verifyDatabaseFile(backup.path);
  assert.equal(verification.valid, true);
  assert.deepEqual(verification.foreignKeyIssues, []);

  const list = await request('/api/admin/db/backups', { token: adminToken });
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.data.some((item) => item.filename === backup.filename), true);

  const download = await fetch(
    `${baseUrl}/api/database-backups/${encodeURIComponent(backup.filename)}`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  assert.equal(download.status, 200);
  assert.ok((await download.arrayBuffer()).byteLength > 100);
  assert.equal(fs.readdirSync(BACKUP_DIR).some((name) => name === backup.filename), true);
});

test('user XLSX import hashes passwords and rejects spreadsheet formulas', async () => {
  const validForm = await workbookForm(
    '用户',
    ['学号', '姓名', '院系', '班级', '手机号', '邮箱', '密码'],
    [[
      'phase2-imported',
      '导入学生',
      '化学学院',
      '化学一班',
      '13800000000',
      'imported@example.edu',
      'ImportedPass123!'
    ]]
  );
  const imported = await request('/api/admin/users/import', {
    method: 'POST',
    token: adminToken,
    body: validForm
  });
  assert.equal(imported.response.status, 200);
  assert.equal(imported.payload.data.success, 1);

  const user = await dbGet(
    'SELECT password FROM users WHERE student_id = ?',
    ['phase2-imported']
  );
  assert.equal(await verifyPassword('ImportedPass123!', user.password), true);
  assert.notEqual(user.password, 'ImportedPass123!');

  const formulaForm = await workbookForm(
    '用户公式',
    ['学号', '姓名', '密码'],
    [['phase2-formula', '公式学生', 'FormulaPass123!']],
    (worksheet) => {
      worksheet.getCell('B2').value = { formula: '1+1', result: 2 };
    }
  );
  const rejected = await request('/api/admin/users/import', {
    method: 'POST',
    token: adminToken,
    body: formulaForm
  });
  assert.equal(rejected.response.status, 400);
  assert.match(rejected.payload.message, /不允许使用公式/);
});

test('question XLSX import validates answers and exports through ExcelJS', async () => {
  const validForm = await workbookForm(
    '题目',
    ['题目内容', '题目类型', '题目分类', '选项', '正确答案', '答案解析'],
    [
      ['安全帽是否必要', '单选题', '通用安全', 'A.必要|B.不必要', 'A', '进入实验室前佩戴'],
      ['可选择哪些措施', '多选题', '通用安全', 'A.培训|B.防护|C.违规', 'BA', '培训与防护'],
      ['实验后应整理台面', '判断题', '通用安全', '', '对', '保持整洁']
    ]
  );
  const imported = await request('/api/admin/questions/import', {
    method: 'POST',
    token: adminToken,
    body: validForm
  });
  assert.equal(imported.response.status, 200);
  assert.equal(imported.payload.data.success, 3);

  const multiple = await dbGet(
    "SELECT answer FROM questions WHERE type = '多选题' ORDER BY id DESC LIMIT 1"
  );
  assert.equal(multiple.answer, 'AB');

  const exported = await request('/api/admin/questions/export', { token: adminToken });
  assert.equal(exported.response.status, 200);
  assert.match(exported.payload.data.fileName, /\.xlsx$/);
  const buffer = Buffer.from(exported.payload.data.base64, 'base64');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.ok(workbook.worksheets[0].actualRowCount >= 4);
});

test('auto-selection is atomic and an exam deletion releases questions', async () => {
  const exam = await dbRun(
    `INSERT INTO exams
      (name, category, description, duration, total_score, pass_score, question_count, status)
     VALUES ('自动抽题测试', '通用安全', '', 30, 100, 60, 3, 0)`
  );
  const questionIds = [];
  for (const [type, answer, content] of [
    ['单选题', 'A', '自动抽题单选'],
    ['多选题', 'AB', '自动抽题多选'],
    ['判断题', '正确', '自动抽题判断']
  ]) {
    const question = await dbRun(
      `INSERT INTO questions(content, type, category, options, answer, analysis, exam_id)
       VALUES (?, ?, '专项分类', ?, ?, '', NULL)`,
      [
        content,
        type,
        JSON.stringify(type === '判断题' ? ['正确', '错误'] : ['选项A', '选项B']),
        answer
      ]
    );
    questionIds.push(question.lastID);
  }

  const selected = await request(`/api/admin/exams/${exam.lastID}/questions/auto-select`, {
    method: 'POST',
    token: adminToken,
    body: { targetCount: 3 }
  });
  assert.equal(selected.response.status, 200);
  assert.equal(selected.payload.data.questionCount, 3);

  const assignedBeforeFailure = await dbQuery(
    'SELECT id FROM questions WHERE exam_id = ? ORDER BY id',
    [exam.lastID]
  );
  const shortage = await request(`/api/admin/exams/${exam.lastID}/questions/auto-select`, {
    method: 'POST',
    token: adminToken,
    body: { targetCount: 500 }
  });
  assert.equal(shortage.response.status, 409);
  const assignedAfterFailure = await dbQuery(
    'SELECT id FROM questions WHERE exam_id = ? ORDER BY id',
    [exam.lastID]
  );
  assert.deepEqual(assignedAfterFailure, assignedBeforeFailure);

  const deleted = await request(`/api/admin/exams/${exam.lastID}`, {
    method: 'DELETE',
    token: adminToken
  });
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.payload.data.releasedQuestionCount, 3);

  const released = await dbQuery(
    `SELECT id, exam_id AS examId FROM questions
      WHERE id IN (${questionIds.map(() => '?').join(',')})`,
    questionIds
  );
  assert.equal(released.length, 3);
  assert.equal(released.every((item) => item.examId === null), true);

  const audit = await dbGet(
    "SELECT action FROM operation_audit_logs WHERE action = 'exam.delete' ORDER BY id DESC LIMIT 1"
  );
  assert.equal(audit.action, 'exam.delete');
});

test('online restore is rejected and final foreign keys remain valid', async () => {
  const restore = await request('/api/admin/db/restore', {
    method: 'POST',
    token: adminToken,
    body: {}
  });
  assert.equal(restore.response.status, 409);
  assert.match(restore.payload.message, /在线恢复已停用/);

  const migrationStatus = await request('/api/admin/db/migrations', { token: adminToken });
  assert.equal(migrationStatus.response.status, 200);
  assert.deepEqual(migrationStatus.payload.data.pending, []);

  const foreignKeyIssues = await dbQuery('PRAGMA foreign_key_check');
  assert.deepEqual(foreignKeyIssues, []);

  const existingUser = await dbGet('SELECT id FROM users WHERE id = ?', [userId]);
  assert.equal(existingUser.id, userId);
});
