import { USER_ROLES } from '../config/constants.js';
import { errorResponse } from '../utils/response.js';
import { ERROR_CODES } from '../config/constants.js';

/**
 * Require admin role middleware
 * Must be used after authenticateJWT
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
    return errorResponse(
      res,
      'Access denied. Admin role required.',
      ERROR_CODES.FORBIDDEN,
      403
    );
  }

  next();
};
