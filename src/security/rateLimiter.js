/**
 * Lightweight in-memory rate limiter middleware.
 * No external dependencies — uses a sliding window approach.
 */
function createRateLimiter({ windowMs = 60000, maxRequests = 30 } = {}) {
  const hits = new Map(); // ip -> [timestamps]

  // Periodically clean up old entries to prevent memory leak
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of hits) {
      const filtered = timestamps.filter(t => t > cutoff);
      if (filtered.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, filtered);
      }
    }
  }, windowMs);
  cleanup.unref(); // Don't keep the process alive for cleanup

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;

    let timestamps = hits.get(ip) || [];
    timestamps = timestamps.filter(t => t > cutoff);
    timestamps.push(now);
    hits.set(ip, timestamps);

    if (timestamps.length > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfterMs: windowMs
      });
    }

    next();
  };
}

module.exports = createRateLimiter;
