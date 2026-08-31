const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-safety-session-'));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'session-cookie-test-secret-at-least-32-characters';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'StrongAdminPassword-2026!';
process.env.ADMIN_DISPLAY_NAME = '测试管理员';
process.env.DEFAULT_USER_PASSWORD = 'ChangeMe123!';
process.env.LAB_SAFETY_DB_PATH = path.join(testDirectory, 'session_test.db');

const { initDatabase, dbRun, closeDatabase } = require('../src/database/db');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/utils/password');

let server;
let baseUrl;

const jsonRequest = async (pathname, { method = 'GET', body, cookie, headers = {} } = {}) => {
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (cookie) requestHeaders.Cookie = cookie;
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
};

const firstCookie = (response) => {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'response should set a session cookie');
  return setCookie.split(';')[0];
};

test.before(async () => {
  await initDatabase();
  const password = await hashPassword('StudentPass123!');
  await dbRun(
    `INSERT INTO users (student_id, name, password, department, class, status)
     VALUES (?, ?, ?, ?, ?, 1)`,
    ['20269999', 'Cookie测试学生', password, '测试学院', '测试班']
  );

  const app = createApp();
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDatabase();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('student login stores JWT only in HttpOnly cookie and cookie authenticates requests', async () => {
  const { response, payload } = await jsonRequest('/api/auth/login', {
    method: 'POST',
    body: { username: '20269999', password: 'StudentPass123!' }
  });

  assert.equal(response.status, 200);
  assert.equal(payload.code, 0);
  assert.equal(payload.data.token, undefined);
  assert.equal(payload.data.userInfo.studentId, '20269999');

  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /lab_student_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = firstCookie(response);

  const profile = await jsonRequest('/api/user/profile', { cookie });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.payload.data.studentId, '20269999');

  const logout = await jsonRequest('/api/auth/logout', { method: 'POST', cookie });
  assert.equal(logout.response.status, 200);
  assert.match(logout.response.headers.get('set-cookie'), /Max-Age=0/i);
});

test('administrator login uses a separate HttpOnly cookie and session endpoint', async () => {
  const { response, payload } = await jsonRequest('/api/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: 'StrongAdminPassword-2026!' }
  });

  assert.equal(response.status, 200);
  assert.equal(payload.code, 0);
  assert.equal(payload.data.token, undefined);
  assert.equal(payload.data.userInfo.role, 'admin');
  assert.match(response.headers.get('set-cookie'), /lab_admin_session=/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  const cookie = firstCookie(response);

  const session = await jsonRequest('/api/admin/session', { cookie });
  assert.equal(session.response.status, 200);
  assert.equal(session.payload.data.userInfo.role, 'admin');

  const logout = await jsonRequest('/api/admin/logout', { method: 'POST', cookie });
  assert.equal(logout.response.status, 200);
  assert.match(logout.response.headers.get('set-cookie'), /Max-Age=0/i);
});

test('state-changing browser requests from an unapproved origin are rejected', async () => {
  const { response, payload } = await jsonRequest('/api/auth/login', {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Sec-Fetch-Site': 'cross-site'
    },
    body: { username: '20269999', password: 'StudentPass123!' }
  });

  assert.equal(response.status, 403);
  assert.equal(payload.message, '跨站请求被拒绝');
});
