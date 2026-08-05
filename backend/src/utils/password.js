const crypto = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(crypto.scrypt);
const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 8;

const isHashedPassword = (value) =>
  typeof value === 'string' && value.startsWith(`${HASH_PREFIX}$`);

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`密码长度不能少于 ${MIN_PASSWORD_LENGTH} 位`);
  }
};

const hashPassword = async (password) => {
  validatePassword(password);
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);
  return `${HASH_PREFIX}$${salt}$${derivedKey.toString('hex')}`;
};

const safeEqualText = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyPassword = async (password, storedPassword) => {
  if (typeof password !== 'string' || typeof storedPassword !== 'string') {
    return false;
  }

  // Backward compatibility: accept a legacy plaintext password once. The
  // caller should immediately replace it with hashPassword(password).
  if (!isHashedPassword(storedPassword)) {
    return safeEqualText(password, storedPassword);
  }

  const [, salt, storedKeyHex] = storedPassword.split('$');
  if (!salt || !storedKeyHex) return false;

  const storedKey = Buffer.from(storedKeyHex, 'hex');
  const derivedKey = await scryptAsync(password, salt, storedKey.length);
  return storedKey.length === derivedKey.length && crypto.timingSafeEqual(storedKey, derivedKey);
};

module.exports = {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  verifyPassword,
  isHashedPassword,
  safeEqualText,
  validatePassword
};
