function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
}

function blockUntilPasswordChanged(req, res, next) {
  if (!req.user?.must_change_password) {
    return next();
  }

  const allowed =
    (req.method === 'GET' && req.path === '/me') ||
    (req.method === 'POST' &&
      ['/change-password', '/logout'].includes(req.path));

  if (!allowed) {
    return res.status(403).json({ error: 'Password change required' });
  }

  return next();
}

module.exports = {
  ensureAuthenticated,
  requireRole,
  blockUntilPasswordChanged,
};
