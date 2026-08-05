const normalizeIp = (req) => req.ip || req.socket.remoteAddress || 'unknown';
const normalizeAccount = (req) => String(
  (req.body && (req.body.username || req.body.studentId)) || ''
).trim().toLowerCase();

const incrementBucket = (buckets, key, now, windowMs) => {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const created = { count: 1, resetAt: now + windowMs };
    buckets.set(key, created);
    return created;
  }
  current.count += 1;
  return current;
};

const createRateLimit = ({ windowMs = 15 * 60 * 1000, max = 10 } = {}) => {
  const ipBuckets = new Map();
  const accountBuckets = new Map();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const buckets of [ipBuckets, accountBuckets]) {
      for (const [key, value] of buckets.entries()) {
        if (value.resetAt <= now) buckets.delete(key);
      }
    }
  }, Math.min(windowMs, 10 * 60 * 1000));
  cleanupTimer.unref();

  return (req, res, next) => {
    const now = Date.now();
    const ipState = incrementBucket(ipBuckets, normalizeIp(req), now, windowMs);
    const account = normalizeAccount(req);
    const accountState = account
      ? incrementBucket(accountBuckets, account, now, windowMs)
      : null;
    const blockedState = [ipState, accountState]
      .filter(Boolean)
      .find((state) => state.count > max);

    if (blockedState) {
      const retryAfter = Math.max(1, Math.ceil((blockedState.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(429).json({
        code: 429,
        message: '登录尝试过于频繁，请稍后重试',
        data: null
      });
    }

    return next();
  };
};

module.exports = {
  createRateLimit,
  normalizeIp,
  normalizeAccount
};
