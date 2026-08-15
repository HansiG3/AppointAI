import crypto from 'crypto';
import Appointment from '../models/Appointment.js';

/**
 * Generate a human-friendly, unpredictable Booking ID
 * Format: APT-YYYYMMDD-XXXXXX (e.g. APT-20260815-K7M4Q2)
 */
const generateBookingId = (dateStr) => {
  // Date portion: YYYYMMDD from appointment date
  const datePart = dateStr.replace(/-/g, '');

  // 6-char cryptographically random alphanumeric suffix (uppercase)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(6);
  const suffix = Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');

  return `APT-${datePart}-${suffix}`;
};

/**
 * Generate a unique Booking ID, retrying on collision (extremely unlikely)
 */
export const generateUniqueBookingId = async (dateStr, maxRetries = 5) => {
  for (let i = 0; i < maxRetries; i++) {
    const bookingId = generateBookingId(dateStr);

    // Verify uniqueness in DB
    const exists = await Appointment.findOne({ bookingId }).lean();
    if (!exists) {
      return bookingId;
    }
  }

  throw new Error('Failed to generate unique Booking ID after multiple attempts');
};
