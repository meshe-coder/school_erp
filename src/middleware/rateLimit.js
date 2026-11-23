const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip || 'unknown');
    const username = String(req.body?.username || '')
      .trim()
      .toLowerCase();

    return `${ip}:${username}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts. Please try again later.',
    });
  },
});

module.exports = { loginLimiter };
