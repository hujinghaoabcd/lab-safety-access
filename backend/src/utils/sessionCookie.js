const STUDENT_COOKIE = 'lab_student_session';
const ADMIN_COOKIE = 'lab_admin_session';
const COOKIE_PATH = '/api';

const parseCookies = (cookieHeader = '') => {
  const cookies = {};
  for (const part of String(cookieHeader).split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch (_) {
      cookies[name] = value;
    }
  }
  return cookies;
};

const serializeCookie = (
  name,
  value,
  { maxAgeSeconds = 0, secure = false } = {}
) => {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${COOKIE_PATH}`,
    'HttpOnly',
    'SameSite=Strict'
  ];
  if (secure) attributes.push('Secure');
  if (Number.isFinite(maxAgeSeconds)) {
    attributes.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  }
  return attributes.join('; ');
};

const cookieNameForRole = (role) => {
  if (role === 'admin') return ADMIN_COOKIE;
  if (role === 'student') return STUDENT_COOKIE;
  throw new Error('不支持的会话角色');
};

const setSessionCookie = (res, role, token, { maxAgeSeconds, secure = false } = {}) => {
  const name = cookieNameForRole(role);
  res.append('Set-Cookie', serializeCookie(name, token, { maxAgeSeconds, secure }));
  res.setHeader('Cache-Control', 'no-store');
};

const clearSessionCookie = (res, role, { secure = false } = {}) => {
  const name = cookieNameForRole(role);
  res.append('Set-Cookie', serializeCookie(name, '', { maxAgeSeconds: 0, secure }));
  res.setHeader('Cache-Control', 'no-store');
};

const isAdminRequest = (req) => {
  const requestPath = String(req.originalUrl || req.url || '');
  return requestPath.startsWith('/api/admin')
    || requestPath.startsWith('/api/db-backups')
    || requestPath.startsWith('/api/database-backups');
};

const getCookieSessionToken = (req) => {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  if (isAdminRequest(req)) {
    return cookies[ADMIN_COOKIE] || cookies[STUDENT_COOKIE] || null;
  }
  return cookies[STUDENT_COOKIE] || cookies[ADMIN_COOKIE] || null;
};

module.exports = {
  STUDENT_COOKIE,
  ADMIN_COOKIE,
  COOKIE_PATH,
  parseCookies,
  serializeCookie,
  setSessionCookie,
  clearSessionCookie,
  getCookieSessionToken
};
