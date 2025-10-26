function requireRole(allowed = []) {
  return (req, res, next) => {
    try {
      const roles = req.user?.roles || [];
      if (!roles.some(r => allowed.includes(r))) return res.status(403).json({ error: 'Forbidden' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireRole };
