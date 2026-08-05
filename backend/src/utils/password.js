const crypto = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(crypto.scrypt);
const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MIN_PASSWORD_LENGTH = 8;

const isHashedPassword = (value) =>
  typeof value === 'string' && value.startsWith(`${HASH_PREFIX}$`);

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`密码长度不能少于 ${MIN_PASSWORD_LENGTH} 位`);
  }
  if (password.length > 256) {
    throw new Error('密码长度不能超过 256 位');
  }
};

const hashPassword = async (password) => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('密码不能为空');
  }
  if (password.length > 256) {
    throw new Error('密码长度不能超过 256 位');
  }
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);
  return `${HASH_PREFIX}$${salt}$${derivedKey.toString('hex')}`;
};

const safeEqualText = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const parseHash = (storedPassword) => {
  if (!isHashedPassword(storedPassword)) return null;
  const parts = storedPassword.split('$');
  if (parts.length !== 3 || parts[0] !== HASH_PREFIX) return null;
  const [, salt, storedKeyHex] = parts;
  if (!new RegExp(`^[0-9a-f]{${SALT_BYTES * 2}}$`, 'i').test(salt)) return null;
  if (!new RegExp(`^[0-9a-f]{${KEY_LENGTH * 2}}$`, 'i').test(storedKeyHex)) return null;
  return { salt, storedKey: Buffer.from(storedKeyHex, 'hex') };
};

const verifyPassword = async (password, storedPassword) => {
  if (typeof password !== 'string' || typeof storedPassword !== 'string') {
    return false;
  }
  if (password.length > 256) return false;

  if (!isHashedPassword(storedPassword)) {
    return safeEqualText(password, storedPassword);
  }

  const parsed = parseHash(storedPassword);
  if (!parsed) return false;

  try {
    const derivedKey = await scryptAsync(password, parsed.salt, KEY_LENGTH);
    return crypto.timingSafeEqual(parsed.storedKey, derivedKey);
  } catch (_) {
    return false;
  }
};

module.exports = {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  verifyPassword,
  isHashedPassword,
  parseHash,
  safeEqualText,
  validatePassword
};
