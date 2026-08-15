import express from 'express';
import {
  adminGetAppointments,
  adminGetAppointmentById,
  adminRescheduleAppointment,
  adminCancelAppointment,
  adminGetDoctors,
  adminCreateDoctor,
  adminUpdateDoctor,
  adminDeactivateDoctor,
  adminGetSpecializations,
  adminCreateSpecialization,
  adminUpdateSpecialization,
  adminDeactivateSpecialization,
  adminGetSlots,
  adminCreateSlot,
  adminBulkCreateSlots,
  adminUpdateSlot,
  adminDeleteSlot,
} from '../controllers/admin.controller.js';
import {
  adminGetAppointmentsValidator,
  adminCancelAppointmentValidator,
  adminUpdateAppointmentValidator,
  createDoctorValidator,
  updateDoctorValidator,
  createSpecializationValidator,
  updateSpecializationValidator,
  createSlotValidator,
  bulkCreateSlotsValidator,
  updateSlotValidator,
} from '../validators/admin.validator.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminOnly.js';

const router = express.Router();

// All admin routes require auth + admin role
router.use(authenticateJWT, requireAdmin);

// Appointments
router.get('/appointments', adminGetAppointmentsValidator, adminGetAppointments);
router.get('/appointments/:id', adminGetAppointmentById);
router.put('/appointments/:id', adminUpdateAppointmentValidator, adminRescheduleAppointment);
router.delete('/appointments/:id', adminCancelAppointmentValidator, adminCancelAppointment);

// Doctors
router.get('/doctors', adminGetDoctors);
router.post('/doctors', createDoctorValidator, adminCreateDoctor);
router.put('/doctors/:id', updateDoctorValidator, adminUpdateDoctor);
router.delete('/doctors/:id', adminDeactivateDoctor);

// Specializations
router.get('/specializations', adminGetSpecializations);
router.post('/specializations', createSpecializationValidator, adminCreateSpecialization);
router.put('/specializations/:id', updateSpecializationValidator, adminUpdateSpecialization);
router.delete('/specializations/:id', adminDeactivateSpecialization);

// Slots
router.get('/slots', adminGetSlots);
router.post('/slots', createSlotValidator, adminCreateSlot);
router.post('/slots/bulk', bulkCreateSlotsValidator, adminBulkCreateSlots);
router.put('/slots/:id', updateSlotValidator, adminUpdateSlot);
router.delete('/slots/:id', adminDeleteSlot);

export default router;
