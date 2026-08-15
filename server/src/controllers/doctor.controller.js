import Doctor from '../models/Doctor.js';
import Specialization from '../models/Specialization.js';
import { validationResult } from 'express-validator';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { ERROR_CODES, DOCTOR_STATUS, PAGINATION } from '../config/constants.js';

/**
 * @route   GET /api/doctors
 * @desc    List/search active doctors
 * @access  Public
 */
export const getDoctors = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, 400,
        errors.array().map(e => e.msg));
    }

    const { specialization, location, name, page = 1, limit = PAGINATION.DEFAULT_LIMIT } = req.query;
    const skip = (page - 1) * limit;

    const filter = { status: DOCTOR_STATUS.ACTIVE };

    // Filter by specialization slug or ID
    if (specialization) {
      const spec = await Specialization.findOne({
        $or: [{ slug: specialization.toLowerCase() }, { _id: specialization }],
        status: 'ACTIVE',
      });
      if (spec) filter.specialization = spec._id;
      else return paginatedResponse(res, [], page, limit, 0);
    }

    if (location) filter.location = { $regex: location, $options: 'i' };
    if (name) filter.$text = { $search: name };

    const [doctors, total] = await Promise.all([
      Doctor.find(filter)
        .populate('specialization', 'name slug')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ name: 1 })
        .lean(),
      Doctor.countDocuments(filter),
    ]);

    const formatted = doctors.map(d => ({
      id: d._id,
      name: d.name,
      specialization: d.specialization,
      experience: d.experience,
      qualification: d.qualification,
      location: d.location,
    }));

    return paginatedResponse(res, formatted, page, limit, total);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/doctors/:id
 * @desc    Get one active doctor
 * @access  Public
 */
export const getDoctorById = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Invalid doctor ID', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const doctor = await Doctor.findOne({ _id: req.params.id, status: DOCTOR_STATUS.ACTIVE })
      .populate('specialization', 'name slug description');

    if (!doctor) {
      return errorResponse(res, 'Doctor not found', ERROR_CODES.NOT_FOUND, 404);
    }

    return successResponse(res, doctor.toSafeObject());
  } catch (error) {
    next(error);
  }
};
