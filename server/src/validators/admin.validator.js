import { body, param, query } from 'express-validator';

// Admin appointment validators
export const adminUpdateAppointmentValidator = [
  param('id').isMongoId().withMessage('Invalid appointment ID'),
  body('slotId').optional().isMongoId().withMessage('Invalid slot ID'),
  body('status').optional().isIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
];

export const adminCancelAppointmentValidator = [
  param('id').isMongoId().withMessage('Invalid appointment ID'),
  body('reason').optional().isString().trim().isLength({ max: 500 }),
];

export const adminGetAppointmentsValidator = [
  query('status').optional().isIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
  query('doctorId').optional().isMongoId(),
  query('userId').optional().isMongoId(),
  query('specializationId').optional().isMongoId(),
  query('bookingId').optional().isString().trim(),
  query('dateFrom').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('dateTo').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

// Admin doctor validators
export const createDoctorValidator = [
  body('name').trim().notEmpty().withMessage('Doctor name is required').isLength({ max: 100 }),
  body('specialization').notEmpty().withMessage('Specialization is required').isMongoId(),
  body('location').trim().notEmpty().withMessage('Location is required').isLength({ max: 200 }),
  body('experience').optional().isInt({ min: 0 }),
  body('qualification').optional().isArray(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];

export const updateDoctorValidator = [
  param('id').isMongoId().withMessage('Invalid doctor ID'),
  body('name').optional().trim().isLength({ max: 100 }),
  body('specialization').optional().isMongoId(),
  body('location').optional().trim().isLength({ max: 200 }),
  body('experience').optional().isInt({ min: 0 }),
  body('qualification').optional().isArray(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];

// Admin specialization validators
export const createSpecializationValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('slug')
    .trim().notEmpty().withMessage('Slug is required')
    .matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase alphanumeric with hyphens'),
  body('aliases').optional().isArray(),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];

export const updateSpecializationValidator = [
  param('id').isMongoId().withMessage('Invalid specialization ID'),
  body('name').optional().trim().isLength({ max: 100 }),
  body('aliases').optional().isArray(),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];

// Admin slot validators
export const createSlotValidator = [
  body('doctorId').notEmpty().withMessage('Doctor ID is required').isMongoId(),
  body('date').notEmpty().withMessage('Date is required').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('startTime').notEmpty().withMessage('Start time is required').matches(/^\d{2}:\d{2}$/),
  body('endTime').notEmpty().withMessage('End time is required').matches(/^\d{2}:\d{2}$/),
];

export const bulkCreateSlotsValidator = [
  body('doctorId').notEmpty().isMongoId(),
  body('dateFrom').notEmpty().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('dateTo').notEmpty().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('startTime').notEmpty().matches(/^\d{2}:\d{2}$/),
  body('endTime').notEmpty().matches(/^\d{2}:\d{2}$/),
  body('durationMinutes').optional().isInt({ min: 15, max: 120 }),
];

export const updateSlotValidator = [
  param('id').isMongoId().withMessage('Invalid slot ID'),
  body('status').notEmpty().isIn(['AVAILABLE', 'BLOCKED']).withMessage('Status must be AVAILABLE or BLOCKED'),
];
