import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import Specialization from '../models/Specialization.js';
import Slot from '../models/Slot.js';
import User from '../models/User.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { ERROR_CODES, SLOT_STATUS, APPOINTMENT_STATUS, DOCTOR_STATUS, PAGINATION } from '../config/constants.js';
import { generateUniqueBookingId } from '../utils/bookingId.js';
import { isDateTimeInFuture, addDays, getTodayDate } from '../utils/dateTime.js';

// ─── Appointments ────────────────────────────────────────────────────────────

export const adminGetAppointments = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { status, doctorId, userId, specializationId, bookingId,
            dateFrom, dateTo, page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (doctorId) filter.doctor = doctorId;
    if (userId) filter.user = userId;
    if (specializationId) filter.specialization = specializationId;
    if (bookingId) filter.bookingId = { $regex: bookingId, $options: 'i' };
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = dateFrom;
      if (dateTo) filter.date.$lte = dateTo;
    }

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate('user', 'name email phone')
        .populate('doctor', 'name location')
        .populate('specialization', 'name')
        .sort({ date: -1, startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    return paginatedResponse(res, appointments, page, limit, total);
  } catch (error) {
    next(error);
  }
};

export const adminGetAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('doctor', 'name location qualification experience')
      .populate('specialization', 'name');

    if (!appointment) {
      return errorResponse(res, 'Appointment not found', ERROR_CODES.APPOINTMENT_NOT_FOUND, 404);
    }

    return successResponse(res, appointment.toSafeObject());
  } catch (error) {
    next(error);
  }
};

export const adminRescheduleAppointment = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { slotId } = req.body;

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      status: { $in: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING] },
    });

    if (!appointment) {
      return errorResponse(res, 'Appointment not found or not eligible for rescheduling',
        ERROR_CODES.APPOINTMENT_NOT_FOUND, 404);
    }

    session.startTransaction();

    const newSlot = await Slot.findOneAndUpdate(
      { _id: slotId, status: SLOT_STATUS.AVAILABLE },
      { $set: { status: SLOT_STATUS.BOOKED } },
      { new: true, session }
    );

    if (!newSlot) {
      await session.abortTransaction();
      return errorResponse(res, 'Selected slot is no longer available', ERROR_CODES.SLOT_UNAVAILABLE, 409);
    }

    // Release old slot if future
    if (isDateTimeInFuture(appointment.date, appointment.startTime)) {
      await Slot.findByIdAndUpdate(appointment.slot,
        { $set: { status: SLOT_STATUS.AVAILABLE, appointment: null } }, { session });
    }

    const doctor = await Doctor.findById(newSlot.doctor).session(session);
    appointment.slot = newSlot._id;
    appointment.date = newSlot.date;
    appointment.startTime = newSlot.startTime;
    appointment.endTime = newSlot.endTime;
    appointment.location = doctor.location;
    await appointment.save({ session });
    await Slot.findByIdAndUpdate(newSlot._id, { appointment: appointment._id }, { session });

    await session.commitTransaction();

    const populated = await Appointment.findById(appointment._id)
      .populate('user', 'name email')
      .populate('doctor', 'name location')
      .populate('specialization', 'name');

    return successResponse(res, populated.toSafeObject(), 'Appointment rescheduled by admin');
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    next(error);
  } finally {
    session.endSession();
  }
};

export const adminCancelAppointment = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { reason } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return errorResponse(res, 'Appointment not found', ERROR_CODES.APPOINTMENT_NOT_FOUND, 404);
    }

    if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
      return successResponse(res, appointment.toSafeObject(), 'Appointment already cancelled');
    }

    session.startTransaction();

    appointment.status = APPOINTMENT_STATUS.CANCELLED;
    appointment.cancellationReason = reason || 'Cancelled by admin';
    appointment.cancelledAt = new Date();
    await appointment.save({ session });

    if (isDateTimeInFuture(appointment.date, appointment.startTime)) {
      await Slot.findByIdAndUpdate(appointment.slot,
        { $set: { status: SLOT_STATUS.AVAILABLE, appointment: null } }, { session });
    }

    await session.commitTransaction();
    return successResponse(res, appointment.toSafeObject(), 'Appointment cancelled');
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    next(error);
  } finally {
    session.endSession();
  }
};

// ─── Doctors ─────────────────────────────────────────────────────────────────

export const adminGetDoctors = async (req, res, next) => {
  try {
    const { page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.query;
    const skip = (page - 1) * limit;

    const [doctors, total] = await Promise.all([
      Doctor.find()
        .populate('specialization', 'name slug')
        .skip(skip).limit(parseInt(limit))
        .sort({ name: 1 }).lean(),
      Doctor.countDocuments(),
    ]);

    return paginatedResponse(res, doctors, page, limit, total);
  } catch (error) {
    next(error);
  }
};

export const adminCreateDoctor = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { name, specialization, location, experience, qualification, status } = req.body;

    // Verify specialization exists
    const spec = await Specialization.findById(specialization);
    if (!spec) return errorResponse(res, 'Specialization not found', ERROR_CODES.NOT_FOUND, 404);

    const doctor = await Doctor.create({ name, specialization, location, experience, qualification, status });
    const populated = await Doctor.findById(doctor._id).populate('specialization', 'name slug');

    return successResponse(res, populated.toSafeObject(), 'Doctor created', 201);
  } catch (error) {
    next(error);
  }
};

export const adminUpdateDoctor = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const allowed = ['name', 'specialization', 'location', 'experience', 'qualification', 'status'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const doctor = await Doctor.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('specialization', 'name slug');

    if (!doctor) return errorResponse(res, 'Doctor not found', ERROR_CODES.NOT_FOUND, 404);

    return successResponse(res, doctor.toSafeObject(), 'Doctor updated');
  } catch (error) {
    next(error);
  }
};

export const adminDeactivateDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { status: DOCTOR_STATUS.INACTIVE },
      { new: true }
    ).populate('specialization', 'name');

    if (!doctor) return errorResponse(res, 'Doctor not found', ERROR_CODES.NOT_FOUND, 404);

    return successResponse(res, doctor.toSafeObject(), 'Doctor deactivated');
  } catch (error) {
    next(error);
  }
};

// ─── Specializations ─────────────────────────────────────────────────────────

export const adminGetSpecializations = async (req, res, next) => {
  try {
    const { page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.query;
    const skip = (page - 1) * limit;

    const [specs, total] = await Promise.all([
      Specialization.find().skip(skip).limit(parseInt(limit)).sort({ name: 1 }).lean(),
      Specialization.countDocuments(),
    ]);

    return paginatedResponse(res, specs, page, limit, total);
  } catch (error) {
    next(error);
  }
};

export const adminCreateSpecialization = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { name, slug, aliases, description, status } = req.body;
    const spec = await Specialization.create({ name, slug, aliases, description, status });

    return successResponse(res, spec.toSafeObject(), 'Specialization created', 201);
  } catch (error) {
    next(error);
  }
};

export const adminUpdateSpecialization = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const allowed = ['name', 'aliases', 'description', 'status'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const spec = await Specialization.findByIdAndUpdate(req.params.id, updates,
      { new: true, runValidators: true });

    if (!spec) return errorResponse(res, 'Specialization not found', ERROR_CODES.NOT_FOUND, 404);

    return successResponse(res, spec.toSafeObject(), 'Specialization updated');
  } catch (error) {
    next(error);
  }
};

export const adminDeactivateSpecialization = async (req, res, next) => {
  try {
    const spec = await Specialization.findByIdAndUpdate(
      req.params.id, { status: 'INACTIVE' }, { new: true });

    if (!spec) return errorResponse(res, 'Specialization not found', ERROR_CODES.NOT_FOUND, 404);

    return successResponse(res, spec.toSafeObject(), 'Specialization deactivated');
  } catch (error) {
    next(error);
  }
};

// ─── Slots ───────────────────────────────────────────────────────────────────

export const adminGetSlots = async (req, res, next) => {
  try {
    const { doctorId, date, status, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (doctorId) filter.doctor = doctorId;
    if (date) filter.date = date;
    if (status) filter.status = status;

    const [slots, total] = await Promise.all([
      Slot.find(filter)
        .populate('doctor', 'name location')
        .sort({ date: 1, startTime: 1 })
        .skip(skip).limit(parseInt(limit)).lean(),
      Slot.countDocuments(filter),
    ]);

    return paginatedResponse(res, slots, page, limit, total);
  } catch (error) {
    next(error);
  }
};

export const adminCreateSlot = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { doctorId, date, startTime, endTime } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return errorResponse(res, 'Doctor not found', ERROR_CODES.NOT_FOUND, 404);

    const slot = await Slot.create({ doctor: doctorId, date, startTime, endTime });

    return successResponse(res, slot.toSafeObject(), 'Slot created', 201);
  } catch (error) {
    // Duplicate slot (unique index violation)
    if (error.code === 11000) {
      return errorResponse(res, 'A slot already exists for this doctor at this date and time',
        ERROR_CODES.CONFLICT, 409);
    }
    next(error);
  }
};

export const adminBulkCreateSlots = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { doctorId, dateFrom, dateTo, startTime, endTime, durationMinutes = 30 } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return errorResponse(res, 'Doctor not found', ERROR_CODES.NOT_FOUND, 404);

    if (dateFrom > dateTo) {
      return errorResponse(res, 'dateFrom must be before or equal to dateTo',
        ERROR_CODES.VALIDATION_ERROR, 400);
    }

    // Generate slots
    const slots = [];
    let current = dateFrom;
    while (current <= dateTo) {
      const dayOfWeek = new Date(current).getDay();
      if (dayOfWeek !== 0) { // Skip Sundays
        let slotStart = startTime;
        while (slotStart < endTime) {
          const [h, m] = slotStart.split(':').map(Number);
          const totalMin = h * 60 + m + durationMinutes;
          const slotEnd = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
          if (slotEnd > endTime) break;
          slots.push({ doctor: doctorId, date: current, startTime: slotStart, endTime: slotEnd });
          slotStart = slotEnd;
        }
      }
      current = addDays(current, 1);
    }

    // Insert ordered, skip duplicates
    const result = await Slot.insertMany(slots, { ordered: false }).catch(err => {
      // Return partial success if some slots already existed
      if (err.code === 11000) return err.insertedDocs || [];
      throw err;
    });

    return successResponse(res, { created: Array.isArray(result) ? result.length : 0 },
      'Slots generated', 201);
  } catch (error) {
    next(error);
  }
};

export const adminUpdateSlot = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { status } = req.body;

    // Only allow status changes on non-booked slots
    const slot = await Slot.findOne({ _id: req.params.id, status: { $ne: SLOT_STATUS.BOOKED } });
    if (!slot) {
      return errorResponse(res, 'Slot not found or is already booked and cannot be changed',
        ERROR_CODES.NOT_FOUND, 404);
    }

    slot.status = status;
    await slot.save();

    return successResponse(res, slot.toSafeObject(), 'Slot updated');
  } catch (error) {
    next(error);
  }
};

export const adminDeleteSlot = async (req, res, next) => {
  try {
    const slot = await Slot.findOne({
      _id: req.params.id,
      status: { $in: [SLOT_STATUS.AVAILABLE, SLOT_STATUS.BLOCKED] },
    });

    if (!slot) {
      return errorResponse(res, 'Slot not found or cannot be deleted (booked or held)',
        ERROR_CODES.NOT_FOUND, 404);
    }

    await slot.deleteOne();

    return successResponse(res, null, 'Slot deleted');
  } catch (error) {
    next(error);
  }
};
