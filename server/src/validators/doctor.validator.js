import { query, param, body } from 'express-validator';

export const getDoctorsValidator = [
  query('specialization').optional().isString().trim(),
  query('location').optional().isString().trim(),
  query('name').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
];

export const getDoctorByIdValidator = [
  param('id').isMongoId().withMessage('Invalid doctor ID'),
];
