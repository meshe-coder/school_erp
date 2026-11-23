const env = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  console.error(error);

  if (env.nodeEnv === 'production') {
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(500).json({ error: error.message });
}

module.exports = { notFound, errorHandler };
