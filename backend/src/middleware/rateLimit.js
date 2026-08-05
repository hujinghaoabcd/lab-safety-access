const buckets = new Map();

const createRateLimit = ({ windowMs = 15 * 60 * 1000, max = 10 } = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        code: 429,
        message: '登录尝试过于频繁，请稍后重试'
      });
    }

    return next();
  };
};

// Avoid unbounded memory growth in long-running processes.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}, 10 * 60 * 1000);
cleanupTimer.unref();

module.exports = { createRateLimit };
