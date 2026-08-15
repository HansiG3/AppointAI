import express from 'express';
import {
  createAppointment,
  getAppointments,
  getAppointmentById,
  rescheduleAppointment,
  cancelAppointment,
} from '../controllers/appointment.controller.js';
import {
  createAppointmentValidator,
  updateAppointmentValidator,
  cancelAppointmentValidator,
  getAppointmentsValidator,
} from '../validators/appointment.validator.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// All appointment routes require authentication
router.use(authenticateJWT);

router.post('/', createAppointmentValidator, createAppointment);
router.get('/', getAppointmentsValidator, getAppointments);
router.get('/:id', getAppointmentById);
router.put('/:id', updateAppointmentValidator, rescheduleAppointment);
router.delete('/:id', cancelAppointmentValidator, cancelAppointment);

export default router;
