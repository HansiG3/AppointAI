import { query, param } from 'express-validator';

export const getAvailabilityValidator = [
  query('specialization').notEmpty().withMessage('Specialization is required').isString().trim(),
  query('date')
    .notEmpty().withMessage('Date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
  query('time').optional().matches(/^\d{2}:\d{2}$/).withMessage('Time must be HH:mm'),
  query('startTime').optional().matches(/^\d{2}:\d{2}$/).withMessage('startTime must be HH:mm'),
  query('endTime').optional().matches(/^\d{2}:\d{2}$/).withMessage('endTime must be HH:mm'),
  query('doctorId').optional().isMongoId().withMessage('Invalid doctor ID'),
  query('location').optional().isString().trim(),
];

export const getDoctorAvailabilityValidator = [
  param('id').isMongoId().withMessage('Invalid doctor ID'),
  query('date')
    .notEmpty().withMessage('Date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
];
