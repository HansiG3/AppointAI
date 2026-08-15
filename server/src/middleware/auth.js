import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { errorResponse } from '../utils/response.js';
import { ERROR_CODES } from '../config/constants.js';

/**
 * Authenticate JWT middleware
 * Verifies token and attaches user info to req.user
 */
export const authenticateJWT = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(
        res,
        'No token provided',
        ERROR_CODES.UNAUTHORIZED,
        401
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Attach user info to request
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(
        res,
        'Invalid token',
        ERROR_CODES.UNAUTHORIZED,
        401
      );
    }

    if (error.name === 'TokenExpiredError') {
      return errorResponse(
        res,
        'Token expired',
        ERROR_CODES.UNAUTHORIZED,
        401
      );
    }

    next(error);
  }
};
