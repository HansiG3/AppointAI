import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Appointment from '../models/Appointment.js';
import Slot from '../models/Slot.js';
import Doctor from '../models/Doctor.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { ERROR_CODES, SLOT_STATUS, APPOINTMENT_STATUS, PAGINATION } from '../config/constants.js';
import { generateUniqueBookingId } from '../utils/bookingId.js';
import { isDateTimeInFuture } from '../utils/dateTime.js';

/**
 * @route   POST /api/appointments
 * @desc    Create appointment — atomically claim selected slot
 * @access  Private
 */
export const createAppointment = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { slotId } = req.body;
    const userId = req.user.id;

    session.startTransaction();

    // Atomically claim the slot: only succeeds if status is AVAILABLE
    const slot = await Slot.findOneAndUpdate(
      { _id: slotId, status: SLOT_STATUS.AVAILABLE },
      { $set: { status: SLOT_STATUS.BOOKED } },
      { new: true, session }
    );

    if (!slot) {
      await session.abortTransaction();
      return errorResponse(res, 'This slot is no longer available', ERROR_CODES.SLOT_UNAVAILABLE, 409);
    }

    // Fetch doctor with specialization
    const doctor = await Doctor.findById(slot.doctor).populate('specialization').session(session);
    if (!doctor) {
      await session.abortTransaction();
      return errorResponse(res, 'Doctor not found', ERROR_CODES.NOT_FOUND, 404);
    }

    // Generate unique Booking ID
    const bookingId = await generateUniqueBookingId(slot.date);

    // Create the appointment
    const [appointment] = await Appointment.create([{
      bookingId,
      user: userId,
      doctor: doctor._id,
      specialization: doctor.specialization._id,
      slot: slot._id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      location: doctor.location,
      status: APPOINTMENT_STATUS.CONFIRMED,
    }], { session });

    // Link appointment back to slot
    await Slot.findByIdAndUpdate(slot._id, { appointment: appointment._id }, { session });

    await session.commitTransaction();

    // Return populated result
    const populated = await Appointment.findById(appointment._id)
      .populate('doctor', 'name location')
      .populate('specialization', 'name');

    return successResponse(res, populated.toSafeObject(), 'Appointment confirmed', 201);
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @route   GET /api/appointments
 * @desc    List current user's appointments
 * @access  Private
 */
export const getAppointments = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { status, page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.query;
    const skip = (page - 1) * limit;

    const filter = { user: req.user.id };
    if (status) filter.status = status;

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
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

/**
 * @route   GET /api/appointments/:id
 * @desc    Get one owned appointment
 * @access  Private
 */
export const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      user: req.user.id,
    })
      .populate('doctor', 'name location qualification experience')
      .populate('specialization', 'name description');

    if (!appointment) {
      return errorResponse(res, 'Appointment not found', ERROR_CODES.APPOINTMENT_NOT_FOUND, 404);
    }

    return successResponse(res, appointment.toSafeObject());
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/appointments/:id
 * @desc    Reschedule — atomically claim new slot, release old
 * @access  Private
 */
export const rescheduleAppointment = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { slotId } = req.body;
    const userId = req.user.id;

    // Verify ownership and eligibility
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      user: userId,
      status: { $in: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING] },
    });

    if (!appointment) {
      return errorResponse(res, 'Appointment not found or not eligible for rescheduling',
        ERROR_CODES.APPOINTMENT_NOT_FOUND, 404);
    }

    // Must be a future appointment
    if (!isDateTimeInFuture(appointment.date, appointment.startTime)) {
      return errorResponse(res, 'Cannot reschedule a past appointment', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    session.startTransaction();

    // Atomically claim the new slot
    const newSlot = await Slot.findOneAndUpdate(
      { _id: slotId, status: SLOT_STATUS.AVAILABLE },
      { $set: { status: SLOT_STATUS.BOOKED } },
      { new: true, session }
    );

    if (!newSlot) {
      await session.abortTransaction();
      return errorResponse(res, 'The selected slot is no longer available', ERROR_CODES.SLOT_UNAVAILABLE, 409);
    }

    // Release old slot
    await Slot.findByIdAndUpdate(
      appointment.slot,
      { $set: { status: SLOT_STATUS.AVAILABLE, appointment: null } },
      { session }
    );

    // Fetch doctor for the new slot
    const doctor = await Doctor.findById(newSlot.doctor).session(session);

    // Update appointment
    appointment.slot = newSlot._id;
    appointment.date = newSlot.date;
    appointment.startTime = newSlot.startTime;
    appointment.endTime = newSlot.endTime;
    appointment.location = doctor.location;
    await appointment.save({ session });

    // Link new slot to appointment
    await Slot.findByIdAndUpdate(newSlot._id, { appointment: appointment._id }, { session });

    await session.commitTransaction();

    const populated = await Appointment.findById(appointment._id)
      .populate('doctor', 'name location')
      .populate('specialization', 'name');

    return successResponse(res, populated.toSafeObject(), 'Appointment rescheduled');
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @route   DELETE /api/appointments/:id
 * @desc    Cancel appointment and release slot
 * @access  Private
 */
export const cancelAppointment = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { reason } = req.body;
    const userId = req.user.id;

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!appointment) {
      return errorResponse(res, 'Appointment not found', ERROR_CODES.APPOINTMENT_NOT_FOUND, 404);
    }

    // Idempotent: already cancelled
    if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
      return successResponse(res, appointment.toSafeObject(), 'Appointment already cancelled');
    }

    if (appointment.status === APPOINTMENT_STATUS.COMPLETED) {
      return errorResponse(res, 'Cannot cancel a completed appointment', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    session.startTransaction();

    appointment.status = APPOINTMENT_STATUS.CANCELLED;
    appointment.cancellationReason = reason || null;
    appointment.cancelledAt = new Date();
    await appointment.save({ session });

    // Release slot (only if it's in the future)
    if (isDateTimeInFuture(appointment.date, appointment.startTime)) {
      await Slot.findByIdAndUpdate(
        appointment.slot,
        { $set: { status: SLOT_STATUS.AVAILABLE, appointment: null } },
        { session }
      );
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
