import { ERROR_CODES } from '../config/constants.js';

/**
 * Standard success response helper
 */
export const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Standard error response helper
 */
export const errorResponse = (res, message, errorCode = ERROR_CODES.INTERNAL_ERROR, statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    errorCode,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Paginated response helper
 */
export const paginatedResponse = (res, data, page, limit, total, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
};
