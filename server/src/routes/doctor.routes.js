import express from 'express';
import { getDoctors, getDoctorById } from '../controllers/doctor.controller.js';
import { getDoctorsValidator, getDoctorByIdValidator } from '../validators/doctor.validator.js';
import { getDoctorAvailability } from '../controllers/availability.controller.js';
import { getDoctorAvailabilityValidator } from '../validators/availability.validator.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getDoctorsValidator, getDoctors);
router.get('/:id', getDoctorByIdValidator, getDoctorById);
router.get('/:id/availability', authenticateJWT, getDoctorAvailabilityValidator, getDoctorAvailability);

export default router;
