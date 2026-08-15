import logger from '../utils/logger.js';
import { ERROR_CODES } from '../config/constants.js';
import { errorResponse } from '../utils/response.js';

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`Error: ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return errorResponse(
      res,
      'Validation failed',
      ERROR_CODES.VALIDATION_ERROR,
      400,
      errors
    );
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return errorResponse(
      res,
      `${field} already exists`,
      ERROR_CODES.CONFLICT,
      409
    );
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return errorResponse(
      res,
      'Invalid ID format',
      ERROR_CODES.VALIDATION_ERROR,
      400
    );
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(
      res,
      'Invalid token',
      ERROR_CODES.UNAUTHORIZED,
      401
    );
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(
      res,
      'Token expired',
      ERROR_CODES.UNAUTHORIZED,
      401
    );
  }

  // Default to 500 server error
  return errorResponse(
    res,
    err.message || 'Internal server error',
    err.errorCode || ERROR_CODES.INTERNAL_ERROR,
    err.statusCode || 500
  );
};

export default errorHandler;
