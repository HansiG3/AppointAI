import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/env.js';
import { USER_ROLES } from '../config/constants.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { ERROR_CODES } from '../config/constants.js';

/**
 * Generate JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(
        res,
        'Validation failed',
        ERROR_CODES.VALIDATION_ERROR,
        400,
        errors.array().map((e) => e.msg)
      );
    }

    const { name, email, phone, password } = req.body;

    // Force role to USER (never accept admin role from registration)
    const role = USER_ROLES.USER;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(
        res,
        'Email already registered',
        ERROR_CODES.CONFLICT,
        409
      );
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash: password, // Will be hashed by pre-save hook
      role,
    });

    // Generate token
    const token = generateToken(user._id, user.role);

    return successResponse(
      res,
      {
        user: user.toSafeObject(),
        token,
      },
      'User registered successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return token
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(
        res,
        'Validation failed',
        ERROR_CODES.VALIDATION_ERROR,
        400,
        errors.array().map((e) => e.msg)
      );
    }

    const { email, password } = req.body;

    // Find user (include passwordHash for comparison)
    const user = await User.findOne({ email }).select('+passwordHash');

    // Generic error message for security
    if (!user) {
      return errorResponse(
        res,
        'Invalid email or password',
        ERROR_CODES.UNAUTHORIZED,
        401
      );
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return errorResponse(
        res,
        'Invalid email or password',
        ERROR_CODES.UNAUTHORIZED,
        401
      );
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return errorResponse(
        res,
        'Account is inactive',
        ERROR_CODES.FORBIDDEN,
        403
      );
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    return successResponse(res, {
      user: user.toSafeObject(),
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
export const getCurrentUser = async (req, res, next) => {
  try {
    // req.user is attached by authenticateJWT middleware
    const user = await User.findById(req.user.id);

    if (!user) {
      return errorResponse(
        res,
        'User not found',
        ERROR_CODES.NOT_FOUND,
        404
      );
    }

    return successResponse(res, user.toSafeObject());
  } catch (error) {
    next(error);
  }
};
