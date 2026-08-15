import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '../config/constants.js';
import { errorResponse } from '../utils/response.js';
import { ERROR_CODES } from '../config/constants.js';

/**
 * Rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs,
  max: RATE_LIMITS.AUTH.max,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    errorResponse(
      res,
      'Too many authentication attempts, please try again later',
      ERROR_CODES.VALIDATION_ERROR,
      429
    );
  },
});

/**
 * Rate limiter for chat endpoints
 */
export const chatLimiter = rateLimit({
  windowMs: RATE_LIMITS.CHAT.windowMs,
  max: RATE_LIMITS.CHAT.max,
  message: 'Too many messages, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    errorResponse(
      res,
      'Too many messages, please slow down',
      ERROR_CODES.VALIDATION_ERROR,
      429
    );
  },
});

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API.windowMs,
  max: RATE_LIMITS.API.max,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    errorResponse(
      res,
      'Too many requests, please try again later',
      ERROR_CODES.VALIDATION_ERROR,
      429
    );
  },
});
