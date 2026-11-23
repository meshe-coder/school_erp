const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function requireApiHeader(req, res, next) {
  if (
    req.path.startsWith('/api') &&
    stateChangingMethods.has(req.method)
  ) {
    if (req.get('X-Requested-With') !== 'school-erp') {
      return res.status(403).json({ error: 'Missing required header' });
    }
  }

  return next();
}

module.exports = { requireApiHeader };
