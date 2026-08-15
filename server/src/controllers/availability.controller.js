import Slot from '../models/Slot.js';
import Doctor from '../models/Doctor.js';
import Specialization from '../models/Specialization.js';
import { validationResult } from 'express-validator';
import { successResponse, errorResponse } from '../utils/response.js';
import { ERROR_CODES, SLOT_STATUS, DOCTOR_STATUS } from '../config/constants.js';
import { isDateValid } from '../utils/dateTime.js';

/**
 * @route   GET /api/availability
 * @desc    Find available slots for a specialization on a date
 * @access  Private (authenticated users)
 */
export const getAvailability = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { specialization, date, time, startTime, endTime, doctorId, location } = req.query;

    // Reject past dates
    if (!isDateValid(date)) {
      return errorResponse(res, 'Date cannot be in the past', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    // Resolve specialization
    const spec = await Specialization.findOne({
      $or: [{ slug: specialization.toLowerCase() }, { name: { $regex: `^${specialization}$`, $options: 'i' } }],
      status: 'ACTIVE',
    });
    if (!spec) {
      return errorResponse(res, `Specialization "${specialization}" not found`, ERROR_CODES.NOT_FOUND, 404);
    }

    // Get active doctors in this specialization
    const doctorFilter = { specialization: spec._id, status: DOCTOR_STATUS.ACTIVE };
    if (doctorId) doctorFilter._id = doctorId;
    if (location) doctorFilter.location = { $regex: location, $options: 'i' };

    const doctors = await Doctor.find(doctorFilter).lean();
    if (!doctors.length) {
      return successResponse(res, { slots: [], specialization: spec.name });
    }

    const doctorIds = doctors.map(d => d._id);

    // Build slot filter
    const slotFilter = {
      doctor: { $in: doctorIds },
      date,
      status: SLOT_STATUS.AVAILABLE,
    };

    // Exact time or time range filter
    if (time) {
      slotFilter.startTime = time;
    } else if (startTime && endTime) {
      slotFilter.startTime = { $gte: startTime, $lt: endTime };
    }

    const slots = await Slot.find(slotFilter)
      .sort({ startTime: 1 })
      .limit(50)
      .lean();

    // Map doctor info onto each slot
    const doctorMap = {};
    doctors.forEach(d => { doctorMap[d._id.toString()] = d; });

    const formatted = slots.map(slot => {
      const doc = doctorMap[slot.doctor.toString()];
      return {
        slotId: slot._id,
        doctor: {
          id: doc._id,
          name: doc.name,
          specialization: spec.name,
          location: doc.location,
          experience: doc.experience,
          qualification: doc.qualification,
        },
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      };
    });

    return successResponse(res, { slots: formatted, specialization: spec.name });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/doctors/:id/availability
 * @desc    Get one doctor's available slots on a date
 * @access  Private
 */
export const getDoctorAvailability = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { date } = req.query;

    if (!isDateValid(date)) {
      return errorResponse(res, 'Date cannot be in the past', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const doctor = await Doctor.findOne({ _id: req.params.id, status: DOCTOR_STATUS.ACTIVE })
      .populate('specialization', 'name slug');
    if (!doctor) {
      return errorResponse(res, 'Doctor not found', ERROR_CODES.NOT_FOUND, 404);
    }

    const slots = await Slot.find({
      doctor: doctor._id,
      date,
      status: SLOT_STATUS.AVAILABLE,
    }).sort({ startTime: 1 }).lean();

    const formatted = slots.map(slot => ({
      slotId: slot._id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));

    return successResponse(res, { doctor: doctor.toSafeObject(), slots: formatted });
  } catch (error) {
    next(error);
  }
};
