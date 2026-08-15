import { body, param, query } from 'express-validator';

export const createAppointmentValidator = [
  body('slotId').notEmpty().withMessage('Slot ID is required').isMongoId().withMessage('Invalid slot ID'),
  body('confirmationToken').optional().isString(),
];

export const updateAppointmentValidator = [
  param('id').isMongoId().withMessage('Invalid appointment ID'),
  body('slotId').notEmpty().withMessage('New slot ID is required').isMongoId().withMessage('Invalid slot ID'),
  body('confirmationToken').optional().isString(),
];

export const cancelAppointmentValidator = [
  param('id').isMongoId().withMessage('Invalid appointment ID'),
  body('reason').optional().isString().trim().isLength({ max: 500 }),
];

export const getAppointmentsValidator = [
  query('status').optional().isIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
];
