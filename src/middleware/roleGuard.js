/**
 * Role-based access control middleware factory.
 * Usage: authorize('admin') or authorize('admin', 'teacher')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not allowed to perform this action.`,
      });
    }

    next();
  };
};

module.exports = { authorize };
